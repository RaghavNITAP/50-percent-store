import { Link, useNavigate } from "react-router-dom";
import { Search, Plus, MessageCircle, User } from "lucide-react";
import { useAuthStore } from "../store/authStore";

export default function Navbar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-100">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="font-bold text-lg tracking-tight">
          50<span className="text-gray-400">%</span>
        </Link>

        <div className="flex items-center gap-1">
          <Link
            to="/search"
            className="p-2 rounded-xl text-gray-500 hover:text-black hover:bg-gray-50 transition"
          >
            <Search size={20} />
          </Link>

          {user?.role !== "buyer" && (
            <Link
              to="/sell"
              className="flex items-center gap-1.5 bg-black text-white px-3 py-1.5 rounded-xl text-sm font-medium hover:bg-gray-800 transition"
            >
              <Plus size={15} />
              Sell
            </Link>
          )}

          <Link
            to="/chat"
            className="p-2 rounded-xl text-gray-500 hover:text-black hover:bg-gray-50 transition"
          >
            <MessageCircle size={20} />
          </Link>

          <Link
            to="/profile"
            className="p-2 rounded-xl text-gray-500 hover:text-black hover:bg-gray-50 transition"
          >
            <User size={20} />
          </Link>
        </div>
      </div>
    </nav>
  );
}
