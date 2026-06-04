import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Loader2, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import { listingsApi, categoriesApi } from "../api/listings";
import { locationsApi } from "../api/locations";
import { useAuthStore } from "../store/authStore";
import Navbar from "../components/Navbar";
import toast from "react-hot-toast";

const CONDITIONS = [
  { value: "new", label: "New" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
];

const STATUSES = [
  { value: "active", label: "Active" },
  { value: "sold", label: "Mark as Sold" },
];

export default function EditListingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    condition: "good",
    category_id: "",
    original_price: "",
    reselling_price: "",
    age_months: "",
    defects: "",
    is_negotiable: false,
    pickup_address: "",
    pincode: "",
    status: "active",
  });

  useEffect(() => {
    categoriesApi.getAll().then((res) => setCategories(res.data)).catch(() => {});
    listingsApi.get(id)
      .then((res) => {
        const l = res.data;
        if (l.seller?.id !== user?.id) {
          toast.error("Not your listing");
          navigate("/");
          return;
        }
        setForm({
          title: l.title || "",
          description: l.description || "",
          condition: l.condition || "good",
          category_id: l.category_id || "",
          original_price: l.original_price ?? "",
          reselling_price: l.reselling_price ?? "",
          age_months: l.age_years != null ? Math.round(l.age_years * 12) : "",
          defects: l.defects || "",
          is_negotiable: l.is_negotiable || false,
          pickup_address: l.pickup_address || "",
          pincode: l.pincode || "",
          status: l.status || "active",
        });
      })
      .catch(() => { toast.error("Listing not found"); navigate("/"); })
      .finally(() => setLoading(false));
  }, [id]);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.reselling_price || Number(form.reselling_price) <= 0)
      return toast.error("Enter a valid selling price");
    setSubmitting(true);
    try {
      const updatePayload = {
        title: form.title,
        description: form.description,
        condition: form.condition,
        category_id: form.category_id || null,
        original_price: form.original_price ? Number(form.original_price) : null,
        reselling_price: Number(form.reselling_price),
        age_years: form.age_months ? Number(form.age_months) / 12 : null,
        defects: form.defects || null,
        is_negotiable: form.is_negotiable,
        pickup_address: form.pickup_address || null,
        status: form.status,
      };

      // If pincode provided, resolve it to update the pickup location
      if (form.pincode && /^\d{6}$/.test(form.pincode)) {
        try {
          const geoRes = await locationsApi.resolvePincode(form.pincode);
          updatePayload.pickup_latitude = geoRes.data.latitude;
          updatePayload.pickup_longitude = geoRes.data.longitude;
          updatePayload.pincode = form.pincode;
        } catch {
          setSubmitting(false);
          return toast.error("Invalid pincode. Please check and try again.");
        }
      }

      await listingsApi.update(id, updatePayload);
      toast.success("Listing updated!");
      navigate(`/listing/${id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update listing");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this listing permanently?")) return;
    setDeleting(true);
    try {
      await listingsApi.delete(id);
      toast.success("Listing deleted");
      navigate("/");
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Loader2 size={24} className="animate-spin text-gray-400" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-black mb-5 transition">
          <ChevronLeft size={16} /> Back
        </button>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900">Edit Listing</h1>
          <button onClick={handleDelete} disabled={deleting} className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-xl transition disabled:opacity-50">
            {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            Delete
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Details */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Details</h2>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Title *</label>
              <input value={form.title} onChange={(e) => set("title", e.target.value)} required
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            {categories.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Category</label>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <button key={cat.id} type="button" onClick={() => set("category_id", form.category_id === cat.id ? "" : cat.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${form.category_id === cat.id ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Condition *</label>
              <div className="grid grid-cols-4 gap-2">
                {CONDITIONS.map((c) => (
                  <button key={c.value} type="button" onClick={() => set("condition", c.value)}
                    className={`py-2 rounded-xl text-xs font-medium border transition ${form.condition === c.value ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Description *</label>
              <textarea value={form.description} onChange={(e) => set("description", e.target.value)} required rows={3}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Defects <span className="text-gray-300">(optional)</span></label>
              <textarea value={form.defects} onChange={(e) => set("defects", e.target.value)} rows={2}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Pricing</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Original Price <span className="text-gray-300">(optional)</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                  <input type="number" value={form.original_price} onChange={(e) => set("original_price", e.target.value)} placeholder="0" min="0"
                    className="w-full border border-gray-200 rounded-xl pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Selling Price *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                  <input type="number" value={form.reselling_price} onChange={(e) => set("reselling_price", e.target.value)} placeholder="0" min="1" required
                    className="w-full border border-gray-200 rounded-xl pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Age (months)</label>
                <input type="number" value={form.age_months} onChange={(e) => set("age_months", e.target.value)} placeholder="e.g. 6" min="0" step="1"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex flex-col justify-end">
                <button type="button" onClick={() => set("is_negotiable", !form.is_negotiable)}
                  className={`flex items-center justify-between w-full px-4 py-2.5 rounded-xl border text-sm font-medium transition ${form.is_negotiable ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>
                  <span>Negotiable</span>
                  {form.is_negotiable ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                </button>
              </div>
            </div>

            {/* Pincode */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Pickup Pincode <span className="text-gray-300">(optional — updates location)</span>
              </label>
              <input
                type="text"
                value={form.pincode}
                onChange={(e) => set("pincode", e.target.value)}
                placeholder="e.g. 462011"
                maxLength={6}
                inputMode="numeric"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Status */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Status</h2>
            <div className="grid grid-cols-2 gap-2">
              {STATUSES.map((s) => (
                <button key={s.value} type="button" onClick={() => set("status", s.value)}
                  className={`py-2.5 rounded-xl text-xs font-medium border transition ${form.status === s.value ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" disabled={submitting}
            className="w-full bg-blue-600 text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition">
            {submitting ? "Saving..." : "Save Changes"}
          </button>

        </form>
      </div>
    </div>
  );
}
