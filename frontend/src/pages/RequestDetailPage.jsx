import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, MapPin, Clock, Tag, CheckCircle, RefreshCw, Trash2 } from "lucide-react";
import { requestsApi } from "../api/requests";
import { useAuthStore } from "../store/authStore";
import Navbar from "../components/Navbar";
import toast from "react-hot-toast";

function timeLeft(expiresAt) {
  const diff = new Date(expiresAt).getTime() - Date.now();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Expiring soon";
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

const CONDITION_LABELS = {
  new: "Brand New only",
  good: "Good or better",
  fair: "Fair or better",
  any: "Any condition",
};

const STATUS_STYLES = {
  open: "bg-green-50 text-green-700 border border-green-200",
  fulfilled: "bg-zinc-100 text-zinc-500 border border-zinc-200",
  closed: "bg-red-50 text-red-500 border border-red-200",
};

export default function RequestDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [req, setReq] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const isOwner = user && req && user.id === req.requester?.id;

  useEffect(() => {
    requestsApi.getById(id)
      .then((r) => setReq(r.data))
      .catch(() => toast.error("Request not found"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleFulfill = async () => {
    if (!window.confirm("Mark this request as fulfilled?")) return;
    setActing(true);
    try {
      const r = await requestsApi.fulfill(id);
      setReq(r.data);
      toast.success("Marked as fulfilled!");
    } catch { toast.error("Failed to update"); }
    finally { setActing(false); }
  };

  const handleRenew = async () => {
    setActing(true);
    try {
      const r = await requestsApi.renew(id);
      setReq(r.data);
      toast.success("Extended by 14 days!");
    } catch { toast.error("Failed to renew"); }
    finally { setActing(false); }
  };

  const handleClose = async () => {
    if (!window.confirm("Close and remove this request?")) return;
    setActing(true);
    try {
      await requestsApi.close(id);
      toast.success("Request closed");
      navigate("/requests");
    } catch { toast.error("Failed to close"); }
    finally { setActing(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="max-w-lg mx-auto px-4 py-6 space-y-3 animate-pulse">
          <div className="h-6 bg-zinc-100 rounded w-2/3" />
          <div className="h-4 bg-zinc-100 rounded w-full" />
          <div className="h-4 bg-zinc-100 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (!req) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="text-center py-20 text-zinc-500">Request not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-lg mx-auto px-4 py-5 pb-28 lg:pb-10">

        {/* Back */}
        <Link to="/requests" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 mb-4 transition">
          <ArrowLeft size={15} /> Back to requests
        </Link>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5">

          {/* Status + category */}
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[req.status]}`}>
              {req.status}
            </span>
            {req.category && (
              <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                {req.category.icon} {req.category.name}
              </span>
            )}
          </div>

          <h1 className="text-lg font-bold text-zinc-900 leading-snug">{req.title}</h1>

          {req.description && (
            <p className="text-sm text-zinc-600 mt-2 leading-relaxed">{req.description}</p>
          )}

          {/* Details grid */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            {(req.min_budget || req.max_budget) && (
              <div className="bg-zinc-50 rounded-xl p-3">
                <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wide">Budget</p>
                <p className="text-sm font-bold text-zinc-900 mt-0.5">
                  {req.min_budget ? `₹${req.min_budget.toLocaleString()} – ` : "Up to "}
                  ₹{req.max_budget?.toLocaleString() || "flexible"}
                </p>
              </div>
            )}

            <div className="bg-zinc-50 rounded-xl p-3">
              <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wide">Condition</p>
              <p className="text-sm font-semibold text-zinc-900 mt-0.5">{CONDITION_LABELS[req.condition_preference]}</p>
            </div>

            {req.pincode && (
              <div className="bg-zinc-50 rounded-xl p-3">
                <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wide">Area</p>
                <p className="text-sm font-semibold text-zinc-900 mt-0.5 flex items-center gap-1">
                  <MapPin size={12} className="text-zinc-400" /> {req.pincode}
                  <span className="text-zinc-400 font-normal">· {req.radius_km} km radius</span>
                </p>
              </div>
            )}

            <div className="bg-zinc-50 rounded-xl p-3">
              <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wide">Expires</p>
              <p className="text-sm font-semibold text-zinc-900 mt-0.5 flex items-center gap-1">
                <Clock size={12} className="text-zinc-400" /> {timeLeft(req.expires_at)}
              </p>
              <p className="text-[10px] text-zinc-400 mt-0.5">{formatDate(req.expires_at)}</p>
            </div>
          </div>

          {/* Requester */}
          <div className="flex items-center gap-2.5 mt-4 pt-4 border-t border-zinc-50">
            <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-sm font-semibold text-zinc-500">
              {req.requester?.full_name?.[0]?.toUpperCase() || "?"}
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-800">{req.requester?.full_name}</p>
              <p className="text-[10px] text-zinc-400">Posted {formatDate(req.created_at)}</p>
            </div>
          </div>
        </div>

        {/* Owner actions */}
        {isOwner && req.status === "open" && (
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleFulfill}
              disabled={acting}
              className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2.5 rounded-xl transition disabled:opacity-50"
            >
              <CheckCircle size={15} /> Found it!
            </button>
            <button
              onClick={handleRenew}
              disabled={acting}
              className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-xl transition disabled:opacity-50"
            >
              <RefreshCw size={15} /> Renew 14 days
            </button>
            <button
              onClick={handleClose}
              disabled={acting}
              className="p-2.5 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition disabled:opacity-50"
            >
              <Trash2 size={15} />
            </button>
          </div>
        )}

        {isOwner && req.status !== "open" && (
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleRenew}
              disabled={acting}
              className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-xl transition disabled:opacity-50"
            >
              <RefreshCw size={15} /> Reopen (14 more days)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
