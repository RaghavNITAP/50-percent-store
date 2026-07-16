import { Link, useLocation } from "react-router-dom";
import { Plus, MessageCircle, User, Home, ClipboardList } from "lucide-react";
import { useAuthStore } from "../store/authStore";

export default function Navbar() {
  const user = useAuthStore((s) => s.user);
  const unreadCount = useAuthStore((s) => s.unreadCount);
  const { pathname } = useLocation();

  const isActive = (path) => pathname === path;

  const iconClass = (path) =>
    `p-2 rounded-xl transition-all duration-150 ${
      isActive(path)
        ? "text-blue-600 bg-blue-50"
        : "text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50"
    }`;

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-zinc-100 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 lg:px-8 h-14 flex items-center justify-between">

        {/* Logo */}
        <Link to="/" className="flex-shrink-0">
          <img src="/logo.png" alt="50% Store" className="h-9 w-auto object-contain" />
        </Link>

        {/* Desktop nav */}
        <div className="hidden lg:flex items-center gap-1">
          {/* Always visible */}
          <Link to="/" className={iconClass("/")}><Home size={20} /></Link>
          <Link to="/requests" className={iconClass("/requests")}><ClipboardList size={20} /></Link>

          {user ? (
            <>
              <Link to="/chat" className={`relative ${iconClass("/chat")}`}>
                <MessageCircle size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </Link>
              <Link to="/profile" className={iconClass("/profile")}><User size={20} /></Link>
              {user.role !== "buyer" && (
                <Link
                  to="/sell"
                  className="ml-2 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors"
                >
                  <Plus size={15} strokeWidth={2.5} />
                  Sell
                </Link>
              )}
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="ml-2 px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 transition"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="ml-1 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
              >
                Get started
              </Link>
            </>
          )}
        </div>

      </div>
    </nav>
  );
}
