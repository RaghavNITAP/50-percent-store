from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone
import stripe
import os
import uuid

from database import get_db
from models import Order, OrderStatus, Listing, ListingStatus, User
from schemas.payments import OrderCreate, OrderOut, PaymentIntentOut, RefundRequest
from core.dependencies import get_current_user, get_current_buyer

router = APIRouter(prefix="/payments", tags=["Payments"])

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
PLATFORM_FEE_PERCENT = 0.0   # 0% for now — flip to e.g. 0.05 for 5% later


# ─── Create order + payment intent ───────────────────────────────────────────

@router.post("/orders", response_model=PaymentIntentOut, status_code=201)
async def create_order(
    payload: OrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_buyer),
):
    # Get listing
    listing_result = await db.execute(
        select(Listing).where(Listing.id == payload.listing_id)
    )
    listing = listing_result.scalar_one_or_none()

    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing.status != ListingStatus.active:
        raise HTTPException(status_code=400, detail="Listing is not available")
    if listing.seller_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot buy your own listing")

    # Validate agreed price
    if payload.agreed_price <= 0:
        raise HTTPException(status_code=400, detail="Invalid price")

    platform_fee = round(payload.agreed_price * PLATFORM_FEE_PERCENT, 2)
    # Convert INR to EUR for Stripe (1 EUR ≈ 90 INR, adjust as needed)
    amount_eur_cents = max(50, int(payload.agreed_price * 0.011 * 100))  # minimum 50 cents

    try:
        intent = stripe.PaymentIntent.create(
            amount=amount_eur_cents,
            currency="eur",
            metadata={
                "listing_id": str(listing.id),
                "buyer_id": str(current_user.id),
                "seller_id": str(listing.seller_id),
            },
        )
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e.user_message))

    # Create order
    order = Order(
        id=uuid.uuid4(),
        listing_id=listing.id,
        buyer_id=current_user.id,
        seller_id=listing.seller_id,
        agreed_price=payload.agreed_price,
        platform_fee=platform_fee,
        status=OrderStatus.pending,
        stripe_payment_intent_id=intent.id,
    )
    db.add(order)
    await db.commit()
    return PaymentIntentOut(
        order_id=str(order.id),
        client_secret=intent.client_secret,
        amount=amount_eur_cents,
        currency="eur",
    )


# ─── Stripe webhook ───────────────────────────────────────────────────────────

@router.post("/webhook", status_code=200)
async def stripe_webhook(
    request: Request,
    stripe_signature: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    body = await request.body()

    if WEBHOOK_SECRET:
        try:
            event = stripe.Webhook.construct_event(body, stripe_signature, WEBHOOK_SECRET)
        except stripe.error.SignatureVerificationError:
            raise HTTPException(status_code=400, detail="Invalid signature")
    else:
        import json
        event = stripe.Event.construct_from(json.loads(body), stripe.api_key)

    if event.type == "payment_intent.succeeded":
        intent = event.data.object
        await _handle_payment_success(intent.id, intent.get("charges", {}).get("data", [{}])[0].get("id"), db)

    elif event.type == "payment_intent.payment_failed":
        intent = event.data.object
        await _handle_payment_failed(intent.id, db)

    elif event.type == "charge.refunded":
        charge = event.data.object
        await _handle_refund(charge.payment_intent, db)

    return {"status": "ok"}


async def _handle_payment_success(payment_intent_id: str, charge_id: str, db: AsyncSession):
    result = await db.execute(
        select(Order).where(Order.stripe_payment_intent_id == payment_intent_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        return

    order.status = OrderStatus.paid
    order.stripe_charge_id = charge_id

    # Mark listing as sold
    listing_result = await db.execute(
        select(Listing).where(Listing.id == order.listing_id)
    )
    listing = listing_result.scalar_one_or_none()
    if listing:
        listing.status = ListingStatus.sold
        listing.sold_at = datetime.now(timezone.utc)

    await db.commit()


async def _handle_payment_failed(payment_intent_id: str, db: AsyncSession):
    result = await db.execute(
        select(Order).where(Order.stripe_payment_intent_id == payment_intent_id)
    )
    order = result.scalar_one_or_none()
    if order:
        order.status = OrderStatus.cancelled
        await db.commit()


async def _handle_refund(payment_intent_id: str, db: AsyncSession):
    result = await db.execute(
        select(Order).where(Order.stripe_payment_intent_id == payment_intent_id)
    )
    order = result.scalar_one_or_none()
    if order:
        order.status = OrderStatus.refunded
        await db.commit()


# ─── Mark order complete (buyer confirms pickup) ──────────────────────────────

@router.post("/orders/{order_id}/complete", response_model=OrderOut)
async def complete_order(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.buyer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only buyer can complete order")
    if order.status != OrderStatus.paid:
        raise HTTPException(status_code=400, detail="Order must be paid first")

    order.status = OrderStatus.completed
    order.completed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(order)
    return order
# ─── Dev: mark order as paid after client-side confirmation ──────────────────
    @router.post("/orders/{order_id}/mark-paid", response_model=OrderOut)
    async def mark_paid(
        order_id: UUID,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user),
    ):
        result = await db.execute(select(Order).where(Order.id == order_id))
        order = result.scalar_one_or_none()
        if not order or order.buyer_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not your order")
        if order.status != OrderStatus.pending:
            return order
        order.status = OrderStatus.paid
        listing_result = await db.execute(
            select(Listing).where(Listing.id == order.listing_id)
        )
        listing = listing_result.scalar_one_or_none()
        if listing:
            listing.status = ListingStatus.sold
            listing.sold_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(order)
    return order
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.buyer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only buyer can complete order")
    if order.status != OrderStatus.paid:
        raise HTTPException(status_code=400, detail="Order must be paid first")

    order.status = OrderStatus.completed
    order.completed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(order)
    return order


# ─── Refund ───────────────────────────────────────────────────────────────────

@router.post("/orders/{order_id}/refund", response_model=OrderOut)
async def refund_order(
    order_id: UUID,
    payload: RefundRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.buyer_id != current_user.id and order.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your order")
    if order.status not in (OrderStatus.paid, OrderStatus.completed):
        raise HTTPException(status_code=400, detail="Order cannot be refunded")
    if not order.stripe_charge_id:
        raise HTTPException(status_code=400, detail="No charge to refund")

    try:
        stripe.Refund.create(
            charge=order.stripe_charge_id,
            reason="requested_by_customer",
            metadata={"reason": payload.reason or ""},
        )
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e.user_message))

    order.status = OrderStatus.refunded
    await db.commit()
    await db.refresh(order)
    return order


# ─── My orders ────────────────────────────────────────────────────────────────

@router.get("/orders/my", response_model=List[OrderOut])
async def my_orders(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Order)
        .where(
            (Order.buyer_id == current_user.id)
        )
        .order_by(Order.created_at.desc())
    )
    return result.scalars().all()

# ─── Dev: mark order as paid after client-side confirmation ──────────────────
@router.post("/orders/{order_id}/mark-paid", response_model=OrderOut)
async def mark_paid(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order or order.buyer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your order")
    if order.status != OrderStatus.pending:
        return order
    order.status = OrderStatus.paid
    listing_result = await db.execute(
        select(Listing).where(Listing.id == order.listing_id)
    )
    listing = listing_result.scalar_one_or_none()
    if listing:
        listing.status = ListingStatus.sold
        listing.sold_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(order)
    return order
# ─── Single order ─────────────────────────────────────────────────────────────

@router.get("/orders/{order_id}", response_model=OrderOut)
async def get_order(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.buyer_id != current_user.id and order.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your order")

    return order
