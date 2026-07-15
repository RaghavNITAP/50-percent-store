import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, MessageCircle, Plus, User, LogIn } from "lucide-react";
import { useAuthStore } from "../store/authStore";

const HIDDEN_PATHS = [
  /^\/login/,
  /^\/register/,
  /^\/sell/,
  /^\/listing\/.+/,   // has its own fixed CTA bar
  /^\/chat\/.+/,
  /^\/checkout\/.+/,
  /^\/order\/.+/,
  /^\/review\/.+/,
];

export default function BottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const unreadCount = useAuthStore((s) => s.unreadCount);
  const fetchUnreadCount = useAuthStore((s) => s.fetchUnreadCount);

  useEffect(() => {
    if (!user) return;
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (HIDDEN_PATHS.some((re) => re.test(pathname))) return null;

  const active = (path) => pathname === path;

  const tab = (path) =>
    `flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors duration-150 ${
      active(path) ? "text-blue-600" : "text-zinc-400 hover:text-zinc-600"
    }`;

  // ── Guest nav ──────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-zinc-100"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-stretch h-16">
          <Link to="/" className={tab("/")}>
            <Home size={22} strokeWidth={active("/") ? 2.5 : 1.8} />
            <span className="text-[10px] font-medium">Home</span>
          </Link>

          {/* Sign in CTA — prominent centre button */}
          <button
            onClick={() => navigate("/login")}
            className="flex flex-col items-center justify-center flex-1"
          >
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200/60 -mt-5">
              <LogIn size={20} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="text-[10px] font-medium text-blue-600 mt-0.5">Sign in</span>
          </button>

          <button onClick={() => navigate("/register")} className={tab(null)}>
            <User size={22} strokeWidth={1.8} />
            <span className="text-[10px] font-medium">Register</span>
          </button>
        </div>
      </nav>
    );
  }

  // ── Authenticated nav ──────────────────────────────────────────────────────
  const isSeller = user.role !== "buyer";

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-zinc-100"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-stretch h-16">
        <Link to="/" className={tab("/")}>
          <Home size={22} strokeWidth={active("/") ? 2.5 : 1.8} />
          <span className="text-[10px] font-medium">Home</span>
        </Link>

        <Link to="/chat" className={tab("/chat")}>
          <div className="relative">
            <MessageCircle size={22} strokeWidth={active("/chat") ? 2.5 : 1.8} />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </div>
          <span className="text-[10px] font-medium">Messages</span>
        </Link>

        {isSeller && (
          <Link to="/sell" className="flex flex-col items-center justify-center flex-1">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200/60 -mt-5">
              <Plus size={22} className="text-white" strokeWidth={2.5} />
            </div>
          </Link>
        )}

        <Link to="/profile" className={tab("/profile")}>
          <User size={22} strokeWidth={active("/profile") ? 2.5 : 1.8} />
          <span className="text-[10px] font-medium">Profile</span>
        </Link>
      </div>
    </nav>
  );
}
