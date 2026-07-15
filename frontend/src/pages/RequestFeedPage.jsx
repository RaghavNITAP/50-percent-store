import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, RefreshCw, Plus, Tag, MapPin, X } from "lucide-react";
import { requestsApi } from "../api/requests";
import { categoriesApi } from "../api/listings";
import { useAuthStore } from "../store/authStore";
import Navbar from "../components/Navbar";
import toast from "react-hot-toast";

const CONDITIONS = [
  { value: "", label: "Any condition" },
  { value: "new", label: "Brand New" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "any", label: "Flexible" },
];

function timeLeft(expiresAt) {
  const diff = new Date(expiresAt).getTime() - Date.now();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Expiring soon";
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

function RequestCard({ req }) {
  return (
    <Link
      to={`/requests/${req.id}`}
      className="block bg-white border border-zinc-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-zinc-200 transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-900 truncate">{req.title}</p>
          {req.category && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full mt-1">
              {req.category.icon} {req.category.name}
            </span>
          )}
          {req.description && (
            <p className="text-xs text-zinc-500 mt-1.5 line-clamp-2">{req.description}</p>
          )}
        </div>
        <div className="flex-shrink-0 text-right">
          {req.max_budget && (
            <p className="text-sm font-bold text-zinc-900">
              ₹{req.min_budget ? `${req.min_budget.toLocaleString()}–` : ""}
              {req.max_budget.toLocaleString()}
            </p>
          )}
          <p className="text-[10px] text-zinc-400 mt-0.5">{timeLeft(req.expires_at)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-50">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center text-[10px] font-semibold text-zinc-500">
            {req.requester?.full_name?.[0]?.toUpperCase() || "?"}
          </div>
          <span className="text-xs text-zinc-500">{req.requester?.full_name}</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-zinc-400">
          {req.pincode && (
            <span className="flex items-center gap-0.5">
              <MapPin size={10} /> {req.pincode}
            </span>
          )}
          {req.condition_preference !== "any" && (
            <span className="capitalize bg-zinc-50 px-1.5 py-0.5 rounded-full">
              {req.condition_preference}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white border border-zinc-100 rounded-2xl p-4 animate-pulse">
      <div className="h-4 bg-zinc-100 rounded w-2/3 mb-2" />
      <div className="h-3 bg-zinc-100 rounded w-full mb-1" />
      <div className="h-3 bg-zinc-100 rounded w-1/2" />
    </div>
  );
}

export default function RequestFeedPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const [requests, setRequests] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categories, setCategories] = useState([]);

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [maxBudget, setMaxBudget] = useState("");
  const [condition, setCondition] = useState("");

  const getParams = useCallback(() => {
    const p = { page: 1, page_size: 20 };
    if (search) p.search = search;
    if (categoryId) p.category_id = categoryId;
    if (maxBudget) p.max_budget = maxBudget;
    if (condition) p.condition_preference = condition;

    // Pass user location if available
    if (user?.latitude) { p.lat = user.latitude; p.lon = user.longitude; p.radius_km = user.availability_radius_km || 10; }

    return p;
  }, [search, categoryId, maxBudget, condition, user]);

  const load = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await requestsApi.getFeed(getParams());
      setRequests(res.data.items);
      setTotal(res.data.total);
    } catch {
      toast.error("Failed to load requests");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getParams]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => load(true), 30000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    categoriesApi.getAll().then((r) => setCategories(r.data)).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-5 pb-28 lg:pb-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-bold text-zinc-900">Request Board</h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              {total > 0 ? `${total} open requests near you` : "What are people looking for?"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="p-2 rounded-xl border border-zinc-200 text-zinc-500 hover:bg-zinc-50 transition disabled:opacity-50"
            >
              <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
            </button>
            {user && (
              <Link
                to="/requests/new"
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-xl transition"
              >
                <Plus size={14} />
                Post Request
              </Link>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Search requests..."
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-zinc-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="text-xs border border-zinc-200 rounded-lg px-2.5 py-1.5 bg-white text-zinc-700 focus:outline-none flex-shrink-0"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>

          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            className="text-xs border border-zinc-200 rounded-lg px-2.5 py-1.5 bg-white text-zinc-700 focus:outline-none flex-shrink-0"
          >
            {CONDITIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>

          <input
            type="number"
            value={maxBudget}
            onChange={(e) => setMaxBudget(e.target.value)}
            placeholder="Max budget ₹"
            className="text-xs border border-zinc-200 rounded-lg px-2.5 py-1.5 bg-white text-zinc-700 focus:outline-none w-28 flex-shrink-0"
          />

          {(categoryId || condition || maxBudget || search) && (
            <button
              onClick={() => { setCategoryId(""); setCondition(""); setMaxBudget(""); setSearch(""); }}
              className="text-xs text-red-500 hover:text-red-700 px-2 flex-shrink-0"
            >
              Clear
            </button>
          )}
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-20">
            <Tag size={36} className="mx-auto text-zinc-200 mb-3" />
            <p className="text-zinc-500 text-sm font-medium">No requests found</p>
            <p className="text-zinc-400 text-xs mt-1">Be the first to post what you're looking for</p>
            {user && (
              <Link to="/requests/new" className="inline-flex items-center gap-1.5 mt-4 bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-blue-700 transition">
                <Plus size={15} /> Post a Request
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => <RequestCard key={req.id} req={req} />)}
          </div>
        )}
      </div>
    </div>
  );
}
