import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Send, Tag } from "lucide-react";
import { chatApi } from "../api/chat";
import { useAuthStore } from "../store/authStore";
import toast from "react-hot-toast";

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ChatPage() {
  const { id: conversationId } = useParams();
  const user = useAuthStore((s) => s.user);
  const resetUnreadCount = useAuthStore((s) => s.resetUnreadCount);
  const [messages, setMessages] = useState([]);
  const [conversation, setConversation] = useState(null);
  const [input, setInput] = useState("");
  const [offerMode, setOfferMode] = useState(false);
  const [offerAmount, setOfferAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const wsRef = useRef(null);
  const bottomRef = useRef(null);

  // Load messages + reset unread badge
  useEffect(() => {
    chatApi.getMessages(conversationId, { page: 1, page_size: 50 })
      .then((res) => {
        setMessages(res.data.items);
        resetUnreadCount(); // local reset so badge clears immediately
      })
      .catch(() => toast.error("Failed to load messages"))
      .finally(() => setLoading(false));

    chatApi.getConversations()
      .then((res) => {
        const conv = res.data.find((c) => c.id === conversationId);
        setConversation(conv);
      });
  }, [conversationId]);

  // WebSocket
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const WS_URL = API_URL.replace("https://", "wss://").replace("http://", "ws://");
const ws = new WebSocket(`${WS_URL}/chat/ws/${conversationId}?token=${token}`);
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.error) return;
      setMessages((prev) => [...prev, {
        id: msg.id,
        conversation_id: msg.conversation_id,
        sender_id: msg.sender_id,
        content: msg.content,
        message_type: msg.message_type,
        offer_amount: msg.offer_amount,
        is_read: false,
        created_at: msg.created_at,
        _sender_name: msg.sender_name,
      }]);
    };

// ws.onerror = () => {};  // silence false errors
// ws.onclose = (e) => {
//   if (e.code !== 1000 && e.code !== 1001) {
//     toast.error("Connection lost");
//   }
// };
    wsRef.current = ws;

    return () => ws.close();
  }, [conversationId]);

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      toast.error("Not connected");
      return;
    }

    const content = offerMode
      ? `Offering ₹${offerAmount}`
      : input.trim();

    if (!content) return;

    wsRef.current.send(JSON.stringify({
      type: offerMode ? "offer" : "text",
      content,
      offer_amount: offerMode ? parseFloat(offerAmount) : null,
    }));

    setInput("");
    setOfferAmount("");
    setOfferMode(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const otherParticipant = conversation?.participants?.find((p) => p.id !== user?.id);

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <Link to="/chat" className="p-1.5 rounded-xl hover:bg-gray-50 transition">
          <ArrowLeft size={18} className="text-gray-500" />
        </Link>

        <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-500">
          {otherParticipant?.full_name?.[0]?.toUpperCase() || "?"}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {otherParticipant?.full_name || "Chat"}
          </p>
          {conversation?.listing && (
            <Link
              to={`/listing/${conversation.listing.id}`}
              className="text-xs text-gray-400 hover:text-black transition truncate block"
            >
              {conversation.listing.title} · ₹{conversation.listing.reselling_price?.toLocaleString()}
            </Link>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-gray-400">Loading...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-gray-400">Start the conversation</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === user?.id;
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-1`}>
                  {msg.message_type === "offer" ? (
                    <div className={`rounded-2xl px-4 py-3 border-2 ${
                      isMe ? "border-blue-600 bg-blue-600 text-white" : "border-gray-200 bg-gray-50"
                    }`}>
                      <div className="flex items-center gap-2">
                        <Tag size={14} />
                        <span className="text-sm font-semibold">
                          {msg.offer_amount
                            ? `₹${msg.offer_amount.toLocaleString()}`
                            : msg.content}
                        </span>
                      </div>
                      <p className={`text-xs mt-0.5 ${isMe ? "text-gray-300" : "text-gray-400"}`}>
                        Price offer
                      </p>
                    </div>
                  ) : (
                    <div className={`rounded-2xl px-4 py-2.5 text-sm ${
                      isMe
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-900"
                    }`}>
                      {msg.content}
                    </div>
                  )}
                  <span className="text-xs text-gray-400 px-1">
                    {formatTime(msg.created_at)}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Offer mode banner */}
      {offerMode && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center gap-2">
          <Tag size={14} className="text-gray-500" />
          <input
            type="number"
            value={offerAmount}
            onChange={(e) => setOfferAmount(e.target.value)}
            placeholder="Enter offer amount in ₹"
            className="flex-1 text-sm bg-transparent focus:outline-none"
            autoFocus
          />
          <button
            onClick={() => setOfferMode(false)}
            className="text-xs text-gray-400 hover:text-black"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-100 flex items-end gap-2">
        <button
          onClick={() => setOfferMode(!offerMode)}
          className={`p-2 rounded-xl border transition flex-shrink-0 ${
            offerMode ? "border-blue-600 bg-blue-600 text-white" : "border-gray-200 text-gray-400 hover:border-gray-400"
          }`}
          title="Make an offer"
        >
          <Tag size={16} />
        </button>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message..."
          rows={1}
          disabled={offerMode}
          className="flex-1 resize-none border border-gray-200 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40 max-h-32"
        />

        <button
          onClick={sendMessage}
          disabled={offerMode ? !offerAmount : !input.trim()}
          className="p-2.5 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 disabled:opacity-40 transition flex-shrink-0"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
