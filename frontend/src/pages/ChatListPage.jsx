import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, ChevronRight } from "lucide-react";
import { chatApi } from "../api/chat";
import { useAuthStore } from "../store/authStore";
import Navbar from "../components/Navbar";
import toast from "react-hot-toast";

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ChatListPage() {
  const user = useAuthStore((s) => s.user);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    chatApi.getConversations()
      .then((res) => setConversations(res.data))
      .catch(() => toast.error("Failed to load conversations"))
      .finally(() => setLoading(false));
  }, []);

  const getOtherParticipant = (conv) =>
    conv.participants.find((p) => p.id !== user?.id) || conv.participants[0];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-lg mx-auto px-4 py-6">
        <h1 className="text-lg font-bold mb-5">Messages</h1>

        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-11 h-11 rounded-full bg-gray-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-100 rounded w-1/3" />
                    <div className="h-3 bg-gray-100 rounded w-2/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-20">
            <MessageCircle size={40} className="mx-auto text-gray-200 mb-3" />
            <p className="text-gray-500 text-sm">No conversations yet</p>
            <p className="text-gray-400 text-xs mt-1">Start chatting from a listing page</p>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((conv) => {
              const other = getOtherParticipant(conv);
              return (
                <Link
                  key={conv.id}
                  to={`/chat/${conv.id}`}
                  className="flex items-center gap-3 bg-white rounded-2xl p-4 border border-gray-100 hover:border-gray-300 transition group"
                >
                  {/* Avatar */}
                  <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 text-sm font-semibold text-gray-500">
                    {other?.full_name?.[0]?.toUpperCase() || "?"}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {other?.full_name || "Unknown"}
                      </p>
                      <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                        {conv.last_message_at ? timeAgo(conv.last_message_at) : ""}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {conv.listing?.title || "General inquiry"}
                    </p>
                  </div>

                  {/* Unread + arrow */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {conv.unread_count > 0 && (
                      <span className="bg-black text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-medium">
                        {conv.unread_count}
                      </span>
                    )}
                    <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 transition" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
