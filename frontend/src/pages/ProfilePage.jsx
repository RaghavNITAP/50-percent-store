import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  User, MapPin, Package, ShoppingBag,
  Star, ChevronRight, LogOut, Edit2, Check, X, Loader2
} from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { authApi } from "../api/auth";
import { listingsApi } from "../api/listings";
import { paymentsApi } from "../api/payments";
import { reviewsApi } from "../api/reviews";
import Navbar from "../components/Navbar";
import toast from "react-hot-toast";

const TABS = [
  { id: "listings", label: "Listings", icon: Package },
  { id: "orders",   label: "Orders",   icon: ShoppingBag },
  { id: "reviews",  label: "Reviews",  icon: Star },
];

const conditionColors = {
  new:  "bg-emerald-50 text-emerald-700",
  good: "bg-blue-50 text-blue-600",
  fair: "bg-amber-50 text-amber-700",
  poor: "bg-red-50 text-red-600",
};

const statusColors = {
  pending:   "bg-yellow-50 text-yellow-700",
  paid:      "bg-blue-50 text-blue-700",
  completed: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-red-50 text-red-600",
  refunded:  "bg-zinc-50 text-zinc-500",
};

export default function ProfilePage() {
  const user     = useAuthStore((s) => s.user);
  const logout   = useAuthStore((s) => s.logout);
  const fetchMe  = useAuthStore((s) => s.fetchMe);
  const navigate = useNavigate();

  const [tab,     setTab]     = useState("listings");
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [locating, setLocating] = useState(false);

  const [editForm, setEditForm] = useState({
    full_name: "", city: "", locality: "", availability_radius_km: 5,
    latitude: null, longitude: null,
  });

  const [listings,   setListings]   = useState([]);
  const [orders,     setOrders]     = useState([]);
  const [reviews,    setReviews]    = useState([]);
  const [tabLoading, setTabLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setEditForm({
        full_name: user.full_name || "",
        city: user.city || "",
        locality: user.locality || "",
        availability_radius_km: user.availability_radius_km || 5,
        latitude: user.latitude || null,
        longitude: user.longitude || null,
      });
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setTabLoading(true);
    if (tab === "listings") {
      listingsApi.myListings({ page: 1, page_size: 20 })
        .then((r) => setListings(r.data.items))
        .catch(() => toast.error("Failed to load listings"))
        .finally(() => setTabLoading(false));
    } else if (tab === "orders") {
      paymentsApi.myOrders()
        .then((r) => setOrders(r.data))
        .catch(() => toast.error("Failed to load orders"))
        .finally(() => setTabLoading(false));
    } else {
      reviewsApi.getMyReviews()
        .then((r) => setReviews(r.data))
        .catch(() => toast.error("Failed to load reviews"))
        .finally(() => setTabLoading(false));
    }
  }, [tab, user]);

  const detectLocation = () => {
    if (!navigator.geolocation) return toast.error("Geolocation not supported");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setEditForm((f) => ({ ...f, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
        setLocating(false);
        toast.success("Location updated");
      },
      (err) => { setLocating(false); toast.error("Could not detect location: " + err.message); }
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await authApi.updateMe({
        full_name: editForm.full_name || undefined,
        city: editForm.city || undefined,
        locality: editForm.locality || undefined,
        availability_radius_km: editForm.availability_radius_km,
        latitude: editForm.latitude || undefined,
        longitude: editForm.longitude || undefined,
      });
      await fetchMe();
      setEditing(false);
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 lg:px-8 py-6 pb-24 lg:pb-10">
        <div className="lg:flex lg:gap-8 lg:items-start">

          {/* ── Left sidebar: Profile card ── */}
          <div className="lg:w-72 lg:flex-shrink-0 mb-5 lg:mb-0 lg:sticky lg:top-20">
            <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5">

              {/* Avatar + name */}
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-2xl bg-zinc-100 flex items-center justify-center text-2xl font-bold text-zinc-500 flex-shrink-0 overflow-hidden">
                  {user.avatar_url
                    ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                    : user.full_name?.[0]?.toUpperCase()
                  }
                </div>
                <div className="min-w-0">
                  <h1 className="text-base font-bold text-zinc-900 truncate">{user.full_name}</h1>
                  <p className="text-xs text-zinc-400 truncate mt-0.5">{user.email}</p>
                  <span className={`inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full font-medium ${
                    user.role === "both"   ? "bg-purple-50 text-purple-700"
                    : user.role === "seller" ? "bg-blue-50 text-blue-700"
                    : "bg-zinc-100 text-zinc-600"
                  }`}>
                    {user.role === "both" ? "Buyer & Seller"
                      : user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                  </span>
                </div>
              </div>

              {/* Location */}
              {!editing && (
                <div className="flex items-center gap-1.5 text-xs text-zinc-400 mb-4">
                  <MapPin size={12} />
                  {user.locality || user.city
                    ? <span>{user.locality}{user.city && `, ${user.city}`} · {user.availability_radius_km}km</span>
                    : <button onClick={() => setEditing(true)} className="text-amber-500 hover:underline">Add location</button>
                  }
                </div>
              )}

              {/* Edit form */}
              {editing ? (
                <div className="space-y-3 mb-4">
                  <input
                    value={editForm.full_name}
                    onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
                    placeholder="Full name"
                    className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={editForm.city}
                      onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))}
                      placeholder="City"
                      className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      value={editForm.locality}
                      onChange={(e) => setEditForm((f) => ({ ...f, locality: e.target.value }))}
                      placeholder="Locality"
                      className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button type="button" onClick={detectLocation} disabled={locating}
                    className={`w-full flex items-center justify-center gap-2 border rounded-xl py-2 text-sm transition disabled:opacity-50 ${
                      editForm.latitude ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-zinc-200 text-zinc-600 hover:border-zinc-400"
                    }`}>
                    {locating ? <><Loader2 size={13} className="animate-spin" />Detecting...</>
                      : editForm.latitude ? <><MapPin size={13} />Location set ✓</>
                      : <><MapPin size={13} />Detect my location</>}
                  </button>
                  <div>
                    <div className="flex justify-between text-xs text-zinc-500 mb-1">
                      <span>Discovery Radius</span>
                      <span className="font-semibold text-zinc-800">{editForm.availability_radius_km}km</span>
                    </div>
                    <input
                      type="range" min="1" max="50" step="1"
                      value={editForm.availability_radius_km}
                      onChange={(e) => setEditForm((f) => ({ ...f, availability_radius_km: Number(e.target.value) }))}
                      className="w-full accent-blue-600"
                    />
                  </div>
                </div>
              ) : null}

              {/* Actions */}
              <div className="flex gap-2">
                {editing ? (
                  <>
                    <button
                      onClick={handleSave} disabled={saving}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
                    >
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      Save
                    </button>
                    <button
                      onClick={() => setEditing(false)}
                      className="flex-1 flex items-center justify-center gap-1.5 border border-zinc-200 text-zinc-600 py-2 rounded-xl text-sm hover:border-zinc-400 transition"
                    >
                      <X size={14} /> Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setEditing(true)}
                      className="flex-1 flex items-center justify-center gap-1.5 border border-zinc-200 text-zinc-600 py-2 rounded-xl text-sm hover:border-zinc-400 transition"
                    >
                      <Edit2 size={13} /> Edit
                    </button>
                    <button
                      onClick={logout}
                      className="flex-1 flex items-center justify-center gap-1.5 border border-zinc-200 text-zinc-500 py-2 rounded-xl text-sm hover:border-red-200 hover:text-red-500 transition"
                    >
                      <LogOut size={13} /> Logout
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ── Right: Tabs + Content ── */}
          <div className="flex-1 min-w-0">
            {/* Tabs */}
            <div className="flex gap-1 bg-white rounded-2xl border border-zinc-100 shadow-sm p-1 mb-4">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all ${
                    tab === t.id
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-zinc-500 hover:text-zinc-800"
                  }`}
                >
                  <t.icon size={13} />
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {tabLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 size={24} className="animate-spin text-zinc-300" />
              </div>
            ) : (
              <>
                {/* Listings */}
                {tab === "listings" && (
                  <div className="space-y-2">
                    {listings.length === 0 ? (
                      <Empty icon="🏷️" title="No listings yet" sub="Post something to get started" action={{ label: "Post a Listing", to: "/sell" }} />
                    ) : (
                      listings.map((l) => (
                        <Link key={l.id} to={`/listing/${l.id}`}
                          className="flex items-center gap-3 bg-white rounded-2xl border border-zinc-100 shadow-sm p-3 hover:border-zinc-300 hover:shadow-md transition-all">
                          {l.images?.[0] ? (
                            <img
                              src={l.images.find((i) => i.is_primary)?.cloudinary_url || l.images[0].cloudinary_url}
                              alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-xl bg-zinc-100 flex items-center justify-center text-2xl flex-shrink-0">📦</div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-zinc-900 truncate">{l.title}</p>
                            <p className="text-base font-bold text-zinc-900 mt-0.5">₹{l.reselling_price.toLocaleString()}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${conditionColors[l.condition]}`}>{l.condition}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${l.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>{l.status}</span>
                            </div>
                          </div>
                          <ChevronRight size={16} className="text-zinc-300 flex-shrink-0" />
                        </Link>
                      ))
                    )}
                  </div>
                )}

                {/* Orders */}
                {tab === "orders" && (
                  <div className="space-y-2">
                    {orders.length === 0 ? (
                      <Empty icon="🛍️" title="No orders yet" sub="Buy something from the feed" action={{ label: "Browse Feed", to: "/" }} />
                    ) : (
                      orders.map((o) => (
                        <Link key={o.id} to={`/order/${o.id}`}
                          className="flex items-center justify-between bg-white rounded-2xl border border-zinc-100 shadow-sm p-4 hover:border-zinc-300 hover:shadow-md transition-all">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[o.status] || statusColors.pending}`}>
                                {o.status.charAt(0).toUpperCase() + o.status.slice(1)}
                              </span>
                              {o.status === "completed" && (
                                <Link to={`/review/${o.id}`} onClick={(e) => e.stopPropagation()}
                                  className="text-xs text-zinc-400 hover:text-blue-600 underline transition">
                                  Leave review
                                </Link>
                              )}
                            </div>
                            <p className="text-sm font-bold text-zinc-900">₹{o.agreed_price.toLocaleString()}</p>
                            <p className="text-xs text-zinc-400 mt-0.5 font-mono">{o.id.slice(0, 8)}...</p>
                          </div>
                          <ChevronRight size={16} className="text-zinc-300 flex-shrink-0" />
                        </Link>
                      ))
                    )}
                  </div>
                )}

                {/* Reviews */}
                {tab === "reviews" && (
                  <div className="space-y-2">
                    {reviews.length === 0 ? (
                      <Empty icon="⭐" title="No reviews yet" sub="Reviews appear after completed orders" />
                    ) : (
                      reviews.map((r) => (
                        <div key={r.id} className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center text-xs font-semibold text-zinc-500">
                                {r.reviewer?.full_name?.[0]?.toUpperCase() || "?"}
                              </div>
                              <span className="text-sm font-medium text-zinc-900">{r.reviewer?.full_name}</span>
                            </div>
                            <div className="flex gap-0.5">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star key={s} size={13} className={s <= r.rating ? "text-amber-400 fill-amber-400" : "text-zinc-200"} />
                              ))}
                            </div>
                          </div>
                          {r.comment && <p className="text-sm text-zinc-600 leading-relaxed">"{r.comment}"</p>}
                          <p className="text-xs text-zinc-400 mt-2">
                            {new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Empty({ icon, title, sub, action }) {
  return (
    <div className="text-center py-16 bg-white rounded-2xl border border-zinc-100 shadow-sm">
      <p className="text-4xl mb-3">{icon}</p>
      <p className="text-sm font-semibold text-zinc-700">{title}</p>
      <p className="text-xs text-zinc-400 mt-1 mb-4">{sub}</p>
      {action && (
        <Link to={action.to} className="inline-block px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700 transition">
          {action.label}
        </Link>
      )}
    </div>
  );
}