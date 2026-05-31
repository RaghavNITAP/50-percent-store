from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, update
from sqlalchemy.orm import selectinload
from typing import List
from uuid import UUID
import uuid
import json
from datetime import datetime, timezone
from uuid import UUID as PyUUID
from database import get_db, AsyncSessionLocal
from models import (
    Conversation, ConversationParticipant, Message,
    MessageType, Listing, User
)
from schemas.chat import (
    ConversationCreate, ConversationOut, MessageOut, MessageList
)
from core.dependencies import get_current_user
from core.security import decode_access_token
from core.ws_manager import manager

router = APIRouter(prefix="/chat", tags=["Chat"])


def conversation_query():
    return (
        select(Conversation)
        .options(
            selectinload(Conversation.participants).selectinload(ConversationParticipant.user),
            selectinload(Conversation.listing).selectinload(Listing.images),
        )
    )


# ─── Start or get conversation ────────────────────────────────────────────────

@router.post("/conversations", response_model=ConversationOut, status_code=201)
async def start_conversation(
    payload: ConversationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Get listing + seller
    listing_result = await db.execute(
        select(Listing).where(Listing.id == payload.listing_id)
    )
    listing = listing_result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    if listing.seller_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot chat with yourself")

    # Check if conversation already exists between these two for this listing
    existing = await db.execute(
        select(Conversation)
        .join(ConversationParticipant, ConversationParticipant.conversation_id == Conversation.id)
        .where(
            Conversation.listing_id == payload.listing_id,
            ConversationParticipant.user_id == current_user.id,
        )
    )
    conv = existing.scalar_one_or_none()

    if not conv:
        conv = Conversation(
            id=uuid.uuid4(),
            listing_id=payload.listing_id,
            last_message_at=datetime.now(timezone.utc),
        )
        db.add(conv)
        await db.flush()

        db.add(ConversationParticipant(
            id=uuid.uuid4(), conversation_id=conv.id, user_id=current_user.id
        ))
        db.add(ConversationParticipant(
            id=uuid.uuid4(), conversation_id=conv.id, user_id=listing.seller_id
        ))

        # Send initial message
        db.add(Message(
            id=uuid.uuid4(),
            conversation_id=conv.id,
            sender_id=current_user.id,
            content=payload.initial_message,
            message_type=MessageType.text,
        ))
        await db.commit()

    result = await db.execute(
        conversation_query().where(Conversation.id == conv.id)
    )
    conv = result.scalar_one()

    # Get unread count for current user
    unread_result = await db.execute(
        select(ConversationParticipant).where(
            ConversationParticipant.conversation_id == conv.id,
            ConversationParticipant.user_id == current_user.id,
        )
    )
    participant = unread_result.scalar_one_or_none()

    return _build_conv_out(conv, participant)


# ─── My conversations ─────────────────────────────────────────────────────────

@router.get("/conversations", response_model=List[ConversationOut])
async def my_conversations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        conversation_query()
        .join(ConversationParticipant, ConversationParticipant.conversation_id == Conversation.id)
        .where(ConversationParticipant.user_id == current_user.id)
        .order_by(Conversation.last_message_at.desc())
    )
    conversations = result.scalars().all()

    out = []
    for conv in conversations:
        participant_result = await db.execute(
            select(ConversationParticipant).where(
                ConversationParticipant.conversation_id == conv.id,
                ConversationParticipant.user_id == current_user.id,
            )
        )
        participant = participant_result.scalar_one_or_none()
        out.append(_build_conv_out(conv, participant))

    return out


# ─── Messages in a conversation ───────────────────────────────────────────────

@router.get("/conversations/{conversation_id}/messages", response_model=MessageList)
async def get_messages(
    conversation_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify participant
    part_result = await db.execute(
        select(ConversationParticipant).where(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == current_user.id,
        )
    )
    if not part_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a participant")

    total = (await db.execute(
        select(func.count()).select_from(Message)
        .where(Message.conversation_id == conversation_id)
    )).scalar()

    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    messages = result.scalars().all()

    # Mark as read
    await db.execute(
        update(Message)
        .where(
            Message.conversation_id == conversation_id,
            Message.sender_id != current_user.id,
            Message.is_read == False,
        )
        .values(is_read=True)
    )
    await db.execute(
        update(ConversationParticipant)
        .where(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == current_user.id,
        )
        .values(unread_count=0)
    )
    await db.commit()

    return MessageList(
        items=list(reversed(messages)),
        total=total,
        page=page,
        page_size=page_size,
    )


# ─── WebSocket ────────────────────────────────────────────────────────────────

@router.websocket("/ws/{conversation_id}")
async def websocket_chat(
    websocket: WebSocket,
    conversation_id: str,
    token: str = Query(...),
):
    # Auth via token query param (WS can't send headers easily)
    payload = decode_access_token(token)
    if not payload:
        await websocket.close(code=4001)
        return

    user_id = payload.get("sub")

    async with AsyncSessionLocal() as db:
        # Verify participant
        part_result = await db.execute(
            select(ConversationParticipant)
            .where(
                ConversationParticipant.conversation_id == PyUUID(conversation_id),
                ConversationParticipant.user_id == PyUUID(user_id),
            )
        )
        if not part_result.scalar_one_or_none():
            await websocket.close(code=4003)
            return

        user_result = await db.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one()

    await manager.connect(websocket, conversation_id)

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await manager.send_personal(websocket, {"error": "Invalid JSON"})
                continue

            content = data.get("content", "").strip()
            msg_type = data.get("type", "text")
            offer_amount = data.get("offer_amount")

            if not content:
                continue

            # Save to DB
            async with AsyncSessionLocal() as db:
                msg = Message(
                    id=uuid.uuid4(),
                    conversation_id=conversation_id,
                    sender_id=user_id,
                    content=content,
                    message_type=msg_type,
                    offer_amount=offer_amount,
                )
                db.add(msg)

                # Update last_message_at + unread counts for other participants
                await db.execute(
                    update(Conversation)
                    .where(Conversation.id == conversation_id)
                    .values(last_message_at=datetime.now(timezone.utc))
                )
                await db.execute(
                    update(ConversationParticipant)
                    .where(
                        ConversationParticipant.conversation_id == conversation_id,
                        ConversationParticipant.user_id != user_id,
                    )
                    .values(unread_count=ConversationParticipant.unread_count + 1)
                )
                await db.commit()

            # Broadcast to all in conversation
            out = {
                "id": str(msg.id),
                "conversation_id": conversation_id,
                "sender_id": str(user_id),
                "sender_name": user.full_name,
                "content": content,
                "message_type": msg_type,
                "offer_amount": offer_amount,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await manager.broadcast(conversation_id, out)

    except WebSocketDisconnect:
        manager.disconnect(websocket, conversation_id)


# ─── Helper ───────────────────────────────────────────────────────────────────

def _build_conv_out(conv: Conversation, participant: ConversationParticipant) -> ConversationOut:
    participants = [p.user for p in conv.participants if p.user]
    return ConversationOut(
        id=conv.id,
        listing_id=conv.listing_id,
        listing=conv.listing,
        participants=participants,
        last_message_at=conv.last_message_at,
        unread_count=participant.unread_count if participant else 0,
        created_at=conv.created_at,
    )