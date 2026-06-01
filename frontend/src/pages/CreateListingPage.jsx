import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, X, Sparkles, MapPin, Loader2,
  ToggleLeft, ToggleRight, CheckCircle, ChevronLeft,
} from "lucide-react";
import { listingsApi, categoriesApi } from "../api/listings";
import { useAuthStore } from "../store/authStore";
import Navbar from "../components/Navbar";
import toast from "react-hot-toast";

const CONDITIONS = [
  { value: "new", label: "New" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
];

const CATEGORY_ICONS = {
  electronics: "💻", fashion: "👗", furniture: "🪑",
  books: "📚", "sports-fitness": "⚽", appliances: "🏠",
  vehicles: "🚗", "toys-games": "🎮",
  "musical-instruments": "🎸", other: "📦",
};

export default function CreateListingPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const fileInputRef = useRef();

  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [categories, setCategories] = useState([]);
  const [aiLoading, setAiLoading] = useState(null);  // null | "description" | "defects"
  const [aiDone, setAiDone] = useState(null);         // null | "description" | "defects"
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    condition: "good",
    category_id: "",
    original_price: "",
    reselling_price: "",
    age_years: "",
    defects: "",
    is_negotiable: false,
    pickup_address: "",
    pickup_latitude: user?.latitude ?? null,
    pickup_longitude: user?.longitude ?? null,
    pickup_radius_km: 3,
  });

  useEffect(() => {
    categoriesApi.getAll().then((res) => setCategories(res.data)).catch(() => {});
  }, []);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const addImages = (files) => {
    const slots = 6 - images.length;
    if (slots <= 0) return;
    const allowed = Array.from(files).slice(0, slots);
    setImages((prev) => [...prev, ...allowed]);
    setPreviews((prev) => [...prev, ...allowed.map((f) => URL.createObjectURL(f))]);
  };

  const removeImage = (idx) => {
    URL.revokeObjectURL(previews[idx]);
    setImages((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAiPolish = async (field) => {
    const content = field === "description" ? form.description : form.defects;
    if (!content || content.trim().length < 5)
      return toast.error(`Write something in ${field} first`);

    setAiLoading(field);
    try {
      const fd = new FormData();
      fd.append("field", field);
      fd.append("content", content);
      fd.append("title", form.title || "item");
      fd.append("condition", form.condition);
      const res = await listingsApi.aiPolish(fd);
      set(field, res.data.text);
      setAiDone(field);
      toast.success(field === "description" ? "Description polished" : "Defects polished");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Polish failed — check backend terminal");
    } finally {
      setAiLoading(null);
    }
  };

  const detectLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported. Using fallback location.");
      setForm((f) => ({
        ...f,
        pickup_latitude: 19.0760, // Fallback (Mumbai Latitude)
        pickup_longitude: 72.8777, // Fallback (Mumbai Longitude)
      }));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          pickup_latitude: pos.coords.latitude,
          pickup_longitude: pos.coords.longitude,
        }));
        setLocating(false);
        toast.success("Location detected");
      },
      (err) => { 
        setLocating(false); 
        toast.error("Could not detect location: " + err.message + ". Using fallback location."); 
        // Fallback coordinates so user is not blocked
        setForm((f) => ({
          ...f,
          pickup_latitude: 19.0760,
          pickup_longitude: 72.8777,
        }));
      }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.pickup_latitude || !form.pickup_longitude)
      return toast.error("Set your pickup location first");
    if (!form.reselling_price || Number(form.reselling_price) <= 0)
      return toast.error("Enter a valid selling price");

    setSubmitting(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        condition: form.condition,
        category_id: form.category_id || null,
        original_price: form.original_price ? Number(form.original_price) : null,
        reselling_price: Number(form.reselling_price),
        age_years: form.age_years ? Number(form.age_years) : null,
        defects: form.defects || null,
        is_negotiable: form.is_negotiable,
        pickup_address: form.pickup_address || null,
        pickup_latitude: form.pickup_latitude,
        pickup_longitude: form.pickup_longitude,
        pickup_radius_km: 0,
      };

      const fd = new FormData();
      fd.append("payload", JSON.stringify(payload));
      images.forEach((img) => fd.append("images", img));

      const res = await listingsApi.create(fd);
      toast.success("Listing posted!");
      navigate(`/listing/${res.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create listing");
    } finally {
      setSubmitting(false);
    }
  };

  if (user && user.role === "buyer") {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <p className="text-4xl mb-4">🏪</p>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Become a Seller</h2>
          <p className="text-sm text-gray-500">You need a seller account to post listings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8">

        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-black mb-5 transition"
        >
          <ChevronLeft size={16} /> Back
        </button>

        <h1 className="text-xl font-bold text-gray-900 mb-6">Post a Listing</h1>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* ── Photos ── */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900">Photos</h2>
              <span className="text-xs text-gray-400">{images.length}/6</span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {previews.map((src, idx) => (
                <div
                  key={idx}
                  className="relative aspect-square rounded-xl overflow-hidden border border-gray-100 bg-gray-50"
                >
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 bg-blue-600/60 text-white rounded-full p-0.5 hover:bg-blue-600 transition"
                  >
                    <X size={10} />
                  </button>
                  {idx === 0 && (
                    <span className="absolute bottom-0 inset-x-0 text-center text-white text-[9px] bg-blue-600/50 py-0.5">
                      Cover
                    </span>
                  )}
                </div>
              ))}
              {images.length < 6 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-600 transition"
                >
                  <Plus size={18} />
                  <span className="text-[10px] mt-0.5">Add</span>
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => addImages(e.target.files)}
            />
          </div>

          {/* ── Details ── */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Details</h2>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Title *</label>
              <input
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="e.g. Nike Air Force 1 White Size 10"
                required
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {categories.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Category</label>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => set("category_id", form.category_id === cat.id ? "" : cat.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                        form.category_id === cat.id
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                      }`}
                    >
                      {CATEGORY_ICONS[cat.slug] || "📦"} {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Condition *</label>
              <div className="grid grid-cols-4 gap-2">
                {CONDITIONS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => set("condition", c.value)}
                    className={`py-2 rounded-xl text-xs font-medium border transition ${
                      form.condition === c.value
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <PolishableField
              label="Description *"
              value={form.description}
              onChange={(v) => { set("description", v); if (aiDone === "description") setAiDone(null); }}
              onPolish={() => handleAiPolish("description")}
              loading={aiLoading === "description"}
              done={aiDone === "description"}
              placeholder="Write in your own words — when you bought it, how you used it, why selling"
              required
              rows={3}
            />

            {/* Defects */}
            <PolishableField
              label="Defects / Damage"
              optional
              value={form.defects}
              onChange={(v) => { set("defects", v); if (aiDone === "defects") setAiDone(null); }}
              onPolish={() => handleAiPolish("defects")}
              loading={aiLoading === "defects"}
              done={aiDone === "defects"}
              placeholder="Any scratches, dents, missing parts? Be honest"
              rows={2}
            />
          </div>

          {/* ── Pricing ── */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Pricing</h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Original Price <span className="text-gray-300">(optional)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                  <input
                    type="number"
                    value={form.original_price}
                    onChange={(e) => set("original_price", e.target.value)}
                    placeholder="0"
                    min="0"
                    className="w-full border border-gray-200 rounded-xl pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Selling Price *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                  <input
                    type="number"
                    value={form.reselling_price}
                    onChange={(e) => set("reselling_price", e.target.value)}
                    placeholder="0"
                    min="1"
                    required
                    className="w-full border border-gray-200 rounded-xl pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Age <span className="text-gray-300">(years)</span>
                </label>
                <input
                  type="number"
                  value={form.age_years}
                  onChange={(e) => set("age_years", e.target.value)}
                  placeholder="e.g. 1.5"
                  min="0"
                  step="0.5"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-col justify-end">
                <button
                  type="button"
                  onClick={() => set("is_negotiable", !form.is_negotiable)}
                  className={`flex items-center justify-between w-full px-4 py-2.5 rounded-xl border text-sm font-medium transition ${
                    form.is_negotiable
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  <span>Negotiable</span>
                  {form.is_negotiable ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                </button>
              </div>
            </div>
          </div>

          {/* ── Pickup Location ── */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Pickup Location</h2>

            <button
              type="button"
              onClick={detectLocation}
              disabled={locating}
              className="w-full flex items-center justify-center gap-2 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-600 hover:border-gray-400 hover:text-black transition disabled:opacity-50"
            >
              {locating ? (
                <><Loader2 size={14} className="animate-spin" />Detecting...</>
              ) : form.pickup_latitude ? (
                <><MapPin size={14} className="text-emerald-600" />Location set ✓ (tap to re-detect)</>
              ) : (
                <><MapPin size={14} />Use my current location</>
              )}
            </button>

            {form.pickup_latitude && (
              <p className="text-xs text-center text-gray-400">
                📍 {form.pickup_latitude.toFixed(5)}, {form.pickup_longitude.toFixed(5)}
              </p>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Pickup Address <span className="text-gray-300">(optional)</span>
              </label>
              <input
                value={form.pickup_address}
                onChange={(e) => set("pickup_address", e.target.value)}
                placeholder="e.g. Near MP Nagar Gate 2, Bhopal"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* ── Submit ── */}
          <button
            type="submit"
            disabled={submitting || !form.pickup_latitude}
            className="w-full bg-blue-600 text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {submitting ? "Posting..." : "Post Listing"}
          </button>

          {!form.pickup_latitude && (
            <p className="text-xs text-center text-gray-400 pb-4">
              Set your pickup location to enable posting
            </p>
          )}

        </form>
      </div>
    </div>
  );
}

// ── Reusable polishable textarea ──────────────────────────────────────────────

function PolishableField({ label, optional, value, onChange, onPolish, loading, done, placeholder, required, rows }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium text-gray-500">
          {label} {optional && <span className="text-gray-300">(optional)</span>}
        </label>
        {value.trim().length >= 5 && (
          <button
            type="button"
            onClick={onPolish}
            disabled={loading}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-black transition disabled:opacity-50"
          >
            {loading
              ? <><Loader2 size={11} className="animate-spin" />Polishing...</>
              : <><Sparkles size={11} />Polish with AI</>
            }
          </button>
        )}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        rows={rows}
        className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none transition ${
          done ? "border-emerald-300 bg-emerald-50/30" : "border-gray-200"
        }`}
      />
      {done && (
        <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
          <CheckCircle size={11} /> Polished — edit freely
        </p>
      )}
    </div>
  );
}