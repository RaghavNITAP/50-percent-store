import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Loader2 } from "lucide-react";
import { requestsApi } from "../api/requests";
import { categoriesApi } from "../api/listings";
import { useAuthStore } from "../store/authStore";
import Navbar from "../components/Navbar";
import toast from "react-hot-toast";

const CONDITIONS = [
  { value: "any",  label: "Any condition" },
  { value: "new",  label: "Brand New only" },
  { value: "good", label: "Good or better" },
  { value: "fair", label: "Fair or better" },
];

export default function CreateRequestPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [aiInput, setAiInput] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    category_id: "",
    max_budget: "",
    condition_preference: "any",
    pincode: user?.pincode || "",
    radius_km: 10,
  });

  useEffect(() => {
    categoriesApi.getAll().then((r) => setCategories(r.data)).catch(() => {});
  }, []);

  const set = (field, val) => setForm((f) => ({ ...f, [field]: val }));

  const handleAiPolish = async () => {
    if (!aiInput.trim()) return toast.error("Describe what you need first");
    setPolishing(true);
    try {
      const res = await requestsApi.aiPolish(aiInput);
      if (res.data.title) set("title", res.data.title);
      if (res.data.description) set("description", res.data.description);
      toast.success("AI filled in the details!");
    } catch {
      toast.error("AI polish failed, fill manually");
    } finally {
      setPolishing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error("Title is required");
    if (!form.pincode || form.pincode.length !== 6) return toast.error("Enter a valid 6-digit pincode");

    setLoading(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        category_id: form.category_id || null,
        max_budget: form.max_budget ? parseFloat(form.max_budget) : null,
        condition_preference: form.condition_preference,
        pincode: form.pincode,
        radius_km: parseFloat(form.radius_km),
      };
      await requestsApi.create(payload);
      toast.success("Request posted!");
      navigate("/requests");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to post request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-lg mx-auto px-4 py-6 pb-28 lg:pb-10">

        <div className="mb-5">
          <h1 className="text-lg font-bold text-zinc-900">Post a Request</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Tell sellers what you're looking for. Active for 14 days.</p>
        </div>

        {/* AI assist */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-4 mb-5">
          <p className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1.5">
            <Sparkles size={13} /> Describe naturally — AI fills the form for you
          </p>
          <div className="flex gap-2">
            <input
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAiPolish()}
              placeholder="e.g. cricket bat size 6 under ₹2000 good condition..."
              className="flex-1 px-3 py-2 text-sm rounded-xl border border-blue-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/30"
            />
            <button
              type="button"
              onClick={handleAiPolish}
              disabled={polishing || !aiInput.trim()}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-2 rounded-xl transition flex-shrink-0"
            >
              {polishing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {polishing ? "..." : "Fill"}
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5 space-y-4">

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
              What are you looking for? <span className="text-red-500">*</span>
            </label>
            <input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. iPhone 13, cricket bat size 6..."
              maxLength={200}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
              Details <span className="text-zinc-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Any specific requirements, brand preferences, size..."
              rows={3}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition resize-none"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
              Category <span className="text-zinc-400 font-normal">(optional)</span>
            </label>
            <select
              value={form.category_id}
              onChange={(e) => set("category_id", e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
          </div>

          {/* Budget */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
              Max budget <span className="text-zinc-400 font-normal">(optional)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-zinc-400">₹</span>
              <input
                type="number"
                value={form.max_budget}
                onChange={(e) => set("max_budget", e.target.value)}
                placeholder="0"
                min={0}
                className="w-full pl-8 pr-3.5 py-2.5 text-sm rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
              />
            </div>
          </div>

          {/* Condition */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Condition preference</label>
            <div className="grid grid-cols-2 gap-2">
              {CONDITIONS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => set("condition_preference", c.value)}
                  className={`px-3 py-2 text-xs rounded-xl border font-medium transition ${
                    form.condition_preference === c.value
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300 hover:bg-white"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
              Your pincode <span className="text-red-500">*</span>
            </label>
            <input
              value={form.pincode}
              onChange={(e) => set("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="6-digit pincode"
              inputMode="numeric"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
            />
          </div>

          {/* Radius */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
              Show to sellers within <span className="font-bold text-blue-600">{form.radius_km} km</span>
            </label>
            <input
              type="range"
              min={1}
              max={50}
              value={form.radius_km}
              onChange={(e) => set("radius_km", e.target.value)}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-[10px] text-zinc-400 mt-1">
              <span>1 km</span><span>50 km</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition text-sm"
          >
            {loading ? "Posting..." : "Post Request"}
          </button>
        </form>
      </div>
    </div>
  );
}
