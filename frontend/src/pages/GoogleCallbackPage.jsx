import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import toast from "react-hot-toast";

export default function GoogleCallbackPage() {
  const navigate = useNavigate();
  const fetchMe = useAuthStore((s) => s.fetchMe);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const at = params.get("at");
    const rt = params.get("rt");
    const error = params.get("error");

    if (error) {
      toast.error("Google login failed. Please try again.");
      navigate("/login");
      return;
    }

    if (at && rt) {
      localStorage.setItem("access_token", at);
      localStorage.setItem("refresh_token", rt);
      fetchMe().then(() => navigate("/")).catch(() => navigate("/login"));
    } else {
      navigate("/login");
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-zinc-500 font-medium">Signing you in with Google...</p>
    </div>
  );
}
