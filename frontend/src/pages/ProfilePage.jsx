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
  { id: "listings", label: "My Listings", icon: Package },
  { id: "orders", label: "My Orders", icon: ShoppingBag },
  { id: "reviews", label: "Reviews", icon: Star },
];

const conditionColors = {
  new: "bg-emerald-50 text-emerald-700",
  good: "bg-blue-50 text-blue-700",
  fair: "bg-amber-50 text-amber-700",
  poor: "bg-red-50 text-red-700",
};

const statusColors = {
  pending: "bg-yellow-50 text-yellow-700",
  paid: "bg-blue-50 text-blue-700",
  completed: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-red-50 text-red-700",
  refunded: "bg-gray-50 text-gray-600",
};

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const navigate = useNavigate();

  const [tab, setTab] = useState("listings");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form
  const [editForm, setEditForm] = useState({
    full_name: "",
    city: "",
    locality: "",
    availability_radius_km: 5,
  });

  // Tab data
  const [listings, setListings] = useState([]);
  const [orders, setOrders] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [tabLoading, setTabLoading] = useState(false);

  // Sync edit form with user
  useEffect(() => {
    if (user) {
      setEditForm({
        full_name: user.full_name || "",
        city: user.city || "",
        locality: user.locality || "",
        availability_radius_km: user.availability_radius_km || 5,
      });
    }
  }, [user]);

  // Load tab data
  useEffect(() => {
    if (!user) return;
    setTabLoading(true);

    if (tab === "listings") {
      listingsApi.myListings({ page: 1, page_size: 20 })
        .then((res) => setListings(res.data.items))
        .catch(() => toast.error("Failed to load listings"))
        .finally(() => setTabLoading(false));
    } else if (tab === "orders") {
      paymentsApi.myOrders()
        .then((res) => setOrders(res.data))
        .catch(() => toast.error("Failed to load orders"))
        .finally(() => setTabLoading(false));
    } else if (tab === "reviews") {
      reviewsApi.getMyReviews()
        .then((res) => setReviews(res.data))
        .catch(() => toast.error("Failed to load reviews"))
        .finally(() => setTabLoading(false));
    }
  }, [tab, user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await authApi.updateMe({
        full_name: editForm.full_name || undefined,
        city: editForm.city || undefined,
        locality: editForm.locality || undefined,
        availability_radius_km: editForm.availability_radius_km,
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
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* ── Profile Card ── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-xl font-bold text-gray-500 flex-shrink-0">
                {user.avatar_url
                  ? <img src={user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                  : user.full_name?.[0]?.toUpperCase()
                }
              </div>
              <div>
                <h1 className="text-base font-bold text-gray-900">{user.full_name}</h1>
                <p className="text-xs text-gray-400 mt-0.5">{user.email}</p>
                <span className={`inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full font-medium ${
                  user.role === "both" ? "bg-purple-50 text-purple-700"
                  : user.role === "seller" ? "bg-blue-50 text-blue-700"
                  : "bg-gray-100 text-gray-600"
                }`}>
                  {user.role === "both" ? "Buyer & Seller" : user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!editing ? (
                <button
                  onClick={() => setEditing(true)}
                  className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-black transition"
                >
                  <Edit2 size={15} />
                </button>
              ) : (
                <div className="flex gap-1.5">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="p-2 rounded-xl bg-black text-white hover:bg-gray-800 transition disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:border-gray-400 transition"
                  >
                    <X size={15} />
                  </button>
                </div>
              )}
              <button
                onClick={logout}
                className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:border-red-200 hover:text-red-500 transition"
              >
                <LogOut size={15} />
              </button>
            </div>
          </div>

          {/* Edit fields */}
          {editing ? (
            <div className="mt-5 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
                <input
                  value={editForm.full_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">City</label>
                  <input
                    value={editForm.city}
                    onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))}
                    placeholder="e.g. Bhopal"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Locality</label>
                  <input
                    value={editForm.locality}
                    onChange={(e) => setEditForm((f) => ({ ...f, locality: e.target.value }))}
                    placeholder="e.g. MP Nagar"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1.5">
                  <label className="text-xs font-medium text-gray-500">Discovery Radius</label>
                  <span className="text-xs font-bold text-gray-900">{editForm.availability_radius_km} km</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="50"
                  step="1"
                  value={editForm.availability_radius_km}
                  onChange={(e) => setEditForm((f) => ({ ...f, availability_radius_km: Number(e.target.value) }))}
                  className="w-full accent-black"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>1 km</span>
                  <span>50 km</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex items-center gap-1.5 text-xs text-gray-400">
              <MapPin size={12} />
              {user.locality || user.city
                ? <span>{user.locality}{user.city && `, ${user.city}`} · {user.availability_radius_km}km radius</span>
                : <span className="text-amber-500">Location not set — <button onClick={() => setEditing(true)} className="underline">add it</button></span>
              }
            </div>
          )}
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 bg-white rounded-2xl border border-gray-100 p-1 mb-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition ${
                tab === t.id
                  ? "bg-black text-white"
                  : "text-gray-500 hover:text-black"
              }`}
            >
              <t.icon size={13} />
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab Content ── */}
        {tabLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={24} className="animate-spin text-gray-300" />
          </div>
        ) : (
          <>
            {/* My Listings */}
            {tab === "listings" && (
              <div className="space-y-2">
                {listings.length === 0 ? (
                  <Empty
                    icon="🏷️"
                    title="No listings yet"
                    sub="Post something to get started"
                    action={{ label: "Post a Listing", to: "/sell" }}
                  />
                ) : (
                  listings.map((l) => (
                    <Link
                      key={l.id}
                      to={`/listing/${l.id}`}
                      className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 p-3 hover:border-gray-300 transition"
                    >
                      {l.images?.[0] ? (
                        <img
                          src={l.images.find((i) => i.is_primary)?.cloudinary_url || l.images[0].cloudinary_url}
                          alt=""
                          className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center text-2xl flex-shrink-0">📦</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{l.title}</p>
                        <p className="text-base font-bold text-gray-900 mt-0.5">₹{l.reselling_price.toLocaleString()}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${conditionColors[l.condition]}`}>
                            {l.condition}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            l.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
                          }`}>
                            {l.status}
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
                    </Link>
                  ))
                )}
              </div>
            )}

            {/* My Orders */}
            {tab === "orders" && (
              <div className="space-y-2">
                {orders.length === 0 ? (
                  <Empty icon="🛍️" title="No orders yet" sub="Buy something from the feed" action={{ label: "Browse Feed", to: "/" }} />
                ) : (
                  orders.map((o) => (
                    <Link
                      key={o.id}
                      to={`/order/${o.id}`}
                      className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 p-4 hover:border-gray-300 transition"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[o.status] || statusColors.pending}`}>
                            {o.status.charAt(0).toUpperCase() + o.status.slice(1)}
                          </span>
                          {o.status === "completed" && (
                            <Link
                              to={`/review/${o.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-gray-400 hover:text-black underline transition"
                            >
                              Leave review
                            </Link>
                          )}
                        </div>
                        <p className="text-sm font-bold text-gray-900">₹{o.agreed_price.toLocaleString()}</p>
                        <p className="text-xs text-gray-400 mt-0.5 font-mono">{o.id.slice(0, 8)}...</p>
                      </div>
                      <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
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
                    <div key={r.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-500">
                            {r.reviewer?.full_name?.[0]?.toUpperCase() || "?"}
                          </div>
                          <span className="text-sm font-medium text-gray-900">{r.reviewer?.full_name}</span>
                        </div>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              size={13}
                              className={s <= r.rating ? "text-amber-400 fill-amber-400" : "text-gray-200"}
                            />
                          ))}
                        </div>
                      </div>
                      {r.comment && (
                        <p className="text-sm text-gray-600 leading-relaxed">"{r.comment}"</p>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
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
  );
}

// ── Empty state helper ────────────────────────────────────────────────────────

function Empty({ icon, title, sub, action }) {
  return (
    <div className="text-center py-16">
      <p className="text-4xl mb-3">{icon}</p>
      <p className="text-sm font-medium text-gray-700">{title}</p>
      <p className="text-xs text-gray-400 mt-1 mb-4">{sub}</p>
      {action && (
        <Link
          to={action.to}
          className="inline-block px-4 py-2 bg-black text-white text-xs font-medium rounded-xl hover:bg-gray-800 transition"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}