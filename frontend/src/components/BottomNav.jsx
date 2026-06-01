import { Link, useLocation } from "react-router-dom";
import { Home, MessageCircle, Plus, User } from "lucide-react";
import { useAuthStore } from "../store/authStore";

const HIDDEN_PATHS = [
  /^\/login/,
  /^\/register/,
  /^\/sell/,
  /^\/chat\/.+/,
  /^\/checkout\/.+/,
  /^\/order\/.+/,
  /^\/review\/.+/,
  /^\/listing\/.+\/edit/,
];

export default function BottomNav() {
  const { pathname } = useLocation();
  const user = useAuthStore((s) => s.user);

  if (!user) return null;
  if (HIDDEN_PATHS.some((re) => re.test(pathname))) return null;

  const active = (path) => pathname === path;
  const isSeller = user.role !== "buyer";

  const tab = (path) =>
    `flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors duration-150 ${
      active(path) ? "text-blue-600" : "text-zinc-400 hover:text-zinc-600"
    }`;

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
          <MessageCircle size={22} strokeWidth={active("/chat") ? 2.5 : 1.8} />
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
