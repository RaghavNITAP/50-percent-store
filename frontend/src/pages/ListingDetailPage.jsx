import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  MapPin, Tag, Eye, Calendar, AlertCircle,
  ChevronLeft, ChevronRight, MessageCircle,
  ShoppingBag, Star, Clock, Wrench
} from "lucide-react";
import { listingsApi } from "../api/listings";
import { chatApi } from "../api/chat";
import { useAuthStore } from "../store/authStore";
import Navbar from "../components/Navbar";
import toast from "react-hot-toast";

const conditionColors = {
  new: "bg-emerald-50 text-emerald-700 border-emerald-100",
  good: "bg-blue-50 text-blue-700 border-blue-100",
  fair: "bg-amber-50 text-amber-700 border-amber-100",
  poor: "bg-red-50 text-red-700 border-red-100",
};

const conditionLabel = {
  new: "Brand New",
  good: "Good Condition",
  fair: "Fair Condition",
  poor: "Poor Condition",
};

export default function ListingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState(0);
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await listingsApi.get(id);
        setListing(res.data);
        // set primary image as first
        const primaryIdx = res.data.images?.findIndex((i) => i.is_primary);
        if (primaryIdx > 0) setActiveImg(primaryIdx);
      } catch {
        toast.error("Listing not found");
        navigate("/");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [id]);

  const handleChat = async () => {
    if (!user) return navigate("/login");
    if (user.id === listing.seller.id) return toast.error("This is your own listing");
    setChatLoading(true);
    try {
      const message = window.prompt(`Message to send with your inquiry:`, `Hi! Is "${listing.title}" still available?`);
if (!message) return;

const res = await chatApi.startConversation({
  listing_id: listing.id,
  initial_message: message,
});
      navigate(`/chat/${res.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not start chat");
    } finally {
      setChatLoading(false);
    }
  };

  const handleBuy = () => {
    if (!user) return navigate("/login");
    if (user.id === listing.seller.id) return toast.error("You can't buy your own listing");
    navigate(`/checkout/${listing.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="aspect-square bg-gray-100 rounded-2xl animate-pulse" />
            <div className="space-y-4">
              <div className="h-6 bg-gray-100 rounded animate-pulse" />
              <div className="h-10 bg-gray-100 rounded animate-pulse w-1/2" />
              <div className="h-4 bg-gray-100 rounded animate-pulse" />
              <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!listing) return null;

  const images = listing.images?.sort((a, b) => a.display_order - b.display_order) || [];
  const isSeller = user?.id === listing.seller.id;
  const isActive = listing.status === "active";
  const discount = listing.original_price
    ? Math.round((1 - listing.reselling_price / listing.original_price) * 100)
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-black mb-5 transition"
        >
          <ChevronLeft size={16} />
          Back
        </button>

        <div className="grid md:grid-cols-2 gap-8">

          {/* ── Images ── */}
          <div>
            <div className="aspect-square bg-white rounded-2xl overflow-hidden border border-gray-100 relative">
              {images.length > 0 ? (
                <img
                  src={images[activeImg]?.cloudinary_url}
                  alt={listing.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-7xl">📦</span>
                </div>
              )}

              {/* Nav arrows */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={() => setActiveImg((i) => (i - 1 + images.length) % images.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-white border border-gray-100 rounded-full p-1.5 shadow-sm hover:bg-gray-50 transition"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => setActiveImg((i) => (i + 1) % images.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-white border border-gray-100 rounded-full p-1.5 shadow-sm hover:bg-gray-50 transition"
                  >
                    <ChevronRight size={16} />
                  </button>
                </>
              )}

              {/* Status badge */}
              {listing.status !== "active" && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-2xl">
                  <span className="bg-white text-black font-bold px-4 py-2 rounded-full uppercase text-sm tracking-wide">
                    {listing.status}
                  </span>
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                {images.map((img, idx) => (
                  <button
                    key={img.id}
                    onClick={() => setActiveImg(idx)}
                    className={`flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition ${
                      activeImg === idx ? "border-black" : "border-transparent"
                    }`}
                  >
                    <img src={img.cloudinary_url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Details ── */}
          <div className="flex flex-col gap-5">

            {/* Title + badges */}
            <div>
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-xl font-bold text-gray-900 leading-snug">{listing.title}</h1>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${conditionColors[listing.condition]}`}>
                    {conditionLabel[listing.condition]}
                  </span>
                  {listing.is_negotiable && (
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-gray-900 text-white">
                      Negotiable
                    </span>
                  )}
                </div>
              </div>

              {/* Price */}
              <div className="flex items-baseline gap-3 mt-3">
                <span className="text-3xl font-bold text-gray-900">
                  ₹{listing.reselling_price.toLocaleString()}
                </span>
                {listing.original_price && (
                  <>
                    <span className="text-base text-gray-400 line-through">
                      ₹{listing.original_price.toLocaleString()}
                    </span>
                    {discount && (
                      <span className="text-sm font-semibold text-emerald-600">
                        {discount}% off
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap gap-3 text-sm text-gray-500">
              <span className="flex items-center gap-1.5">
                <Eye size={14} />
                {listing.view_count} views
              </span>
              {listing.age_years != null && (
                <span className="flex items-center gap-1.5">
                  <Clock size={14} />
                  {listing.age_years === 0 ? "< 1 year old" : `${listing.age_years} yr${listing.age_years !== 1 ? "s" : ""} old`}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Calendar size={14} />
                Listed {new Date(listing.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </span>
            </div>

            {/* AI quality score */}
            {listing.ai_quality_score != null && (
              <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-gray-500">AI Quality Score</span>
                  <span className="text-sm font-bold text-gray-900">{listing.ai_quality_score}/100</span>
                </div>
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-black rounded-full transition-all"
                    style={{ width: `${listing.ai_quality_score}%` }}
                  />
                </div>
              </div>
            )}

            {/* Seller */}
            <div className="flex items-center gap-3 py-4 border-t border-b border-gray-100">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-semibold text-gray-700 text-sm flex-shrink-0">
                {listing.seller.avatar_url ? (
                  <img src={listing.seller.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  listing.seller.full_name?.[0]?.toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{listing.seller.full_name}</p>
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <MapPin size={11} />
                  {listing.seller.locality}{listing.seller.city && `, ${listing.seller.city}`}
                </p>
              </div>
            </div>

            {/* Pickup location */}
            {listing.pickup_address && (
              <div className="flex items-start gap-2 text-sm text-gray-600">
                <MapPin size={15} className="mt-0.5 flex-shrink-0 text-gray-400" />
                <div>
                  <span className="font-medium text-gray-700">Pickup: </span>
                  {listing.pickup_address}
                  <span className="text-gray-400 ml-1">· {listing.pickup_radius_km}km radius</span>
                </div>
              </div>
            )}

            {/* CTA buttons */}
            {!isSeller && isActive && (
              <div className="flex gap-3 mt-auto pt-2">
                <button
                  onClick={handleChat}
                  disabled={chatLoading}
                  className="flex-1 flex items-center justify-center gap-2 border border-gray-200 text-gray-700 py-3 rounded-xl text-sm font-medium hover:border-gray-400 hover:text-black transition disabled:opacity-50"
                >
                  <MessageCircle size={16} />
                  {chatLoading ? "Starting chat..." : "Chat with Seller"}
                </button>
                <button
                  onClick={handleBuy}
                  className="flex-1 flex items-center justify-center gap-2 bg-black text-white py-3 rounded-xl text-sm font-medium hover:bg-gray-800 transition"
                >
                  <ShoppingBag size={16} />
                  Buy Now
                </button>
              </div>
            )}

            {isSeller && (
              <div className="flex gap-3 mt-auto pt-2">
                <button
                  onClick={() => navigate(`/listing/${listing.id}/edit`)}
                  className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-xl text-sm font-medium hover:border-gray-400 transition"
                >
                  Edit Listing
                </button>
              </div>
            )}

            {!isActive && !isSeller && (
              <p className="text-sm text-gray-400 text-center pt-2">
                This listing is no longer available.
              </p>
            )}
          </div>
        </div>

        {/* ── Description + Defects ── */}
        <div className="mt-8 grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Description</h2>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
              {listing.description}
            </p>
          </div>

          {listing.defects && (
            <div className="bg-amber-50 rounded-2xl border border-amber-100 p-5">
              <h2 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
                <AlertCircle size={14} />
                Known Defects
              </h2>
              <p className="text-sm text-amber-700 leading-relaxed">
                {listing.defects}
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}