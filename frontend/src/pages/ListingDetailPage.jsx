import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  MapPin, Eye, Calendar, AlertCircle,
  ChevronLeft, ChevronRight, MessageCircle,
  ShoppingBag, Clock, ArrowLeft
} from "lucide-react";
import { listingsApi } from "../api/listings";
import { chatApi } from "../api/chat";
import { useAuthStore } from "../store/authStore";
import Navbar from "../components/Navbar";
import toast from "react-hot-toast";

const conditionConfig = {
  new:  { label: "Brand New",      cls: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  good: { label: "Good Condition", cls: "bg-blue-50 text-blue-700 border-blue-100" },
  fair: { label: "Fair Condition", cls: "bg-amber-50 text-amber-700 border-amber-100" },
  poor: { label: "Poor Condition", cls: "bg-red-50 text-red-700 border-red-100" },
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
    const load = async () => {
      try {
        const res = await listingsApi.get(id);
        setListing(res.data);
        const primaryIdx = res.data.images?.findIndex((i) => i.is_primary);
        if (primaryIdx > 0) setActiveImg(primaryIdx);
      } catch {
        toast.error("Listing not found");
        navigate("/");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleChat = async () => {
    if (!user) return navigate("/login");
    if (user.id === listing.seller.id) return toast.error("This is your own listing");
    setChatLoading(true);
    try {
      const message = window.prompt(
        `Message to send with your inquiry:`,
        `Hi! Is "${listing.title}" still available?`
      );
      if (!message) return;
      const res = await chatApi.startConversation({ listing_id: listing.id, initial_message: message });
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
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="max-w-5xl mx-auto px-4 lg:px-8 py-6">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
            <div className="aspect-square bg-zinc-100 rounded-2xl animate-pulse" />
            <div className="space-y-5">
              <div className="h-7 bg-zinc-100 rounded-xl animate-pulse" />
              <div className="h-10 bg-zinc-100 rounded-xl animate-pulse w-1/2" />
              <div className="h-4 bg-zinc-100 rounded animate-pulse" />
              <div className="h-4 bg-zinc-100 rounded animate-pulse w-3/4" />
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
  const condition = conditionConfig[listing.condition] || conditionConfig.good;
  const discount = listing.original_price
    ? Math.round((1 - listing.reselling_price / listing.original_price) * 100)
    : null;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      {/* Mobile: bottom CTA bar spacer */}
      <div className="pb-28 lg:pb-0">
        <div className="max-w-5xl mx-auto px-4 lg:px-8 py-4 lg:py-8">

          {/* Back */}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 mb-5 transition group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            Back
          </button>

          <div className="lg:grid lg:grid-cols-2 lg:gap-12 lg:items-start">

            {/* ── Images ── */}
            <div className="lg:sticky lg:top-20">
              {/* Main image */}
              <div className="aspect-square bg-white rounded-2xl overflow-hidden border border-zinc-100 shadow-sm relative">
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

                {/* Arrow nav */}
                {images.length > 1 && (
                  <>
                    <button
                      onClick={() => setActiveImg((i) => (i - 1 + images.length) % images.length)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur-sm border border-zinc-100 rounded-full p-2 shadow-sm hover:bg-white transition"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      onClick={() => setActiveImg((i) => (i + 1) % images.length)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur-sm border border-zinc-100 rounded-full p-2 shadow-sm hover:bg-white transition"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </>
                )}

                {/* Sold overlay */}
                {!isActive && (
                  <div className="absolute inset-0 bg-zinc-900/50 backdrop-blur-[1px] flex items-center justify-center rounded-2xl">
                    <span className="bg-white text-zinc-900 font-bold px-5 py-2 rounded-full uppercase text-sm tracking-wider shadow-lg">
                      {listing.status}
                    </span>
                  </div>
                )}

                {/* Discount pill */}
                {discount && discount > 0 && (
                  <div className="absolute top-3 left-3 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-lg shadow">
                    -{discount}%
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
                      className={`flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                        activeImg === idx ? "border-blue-600 shadow-sm" : "border-transparent opacity-60 hover:opacity-100"
                      }`}
                    >
                      <img src={img.cloudinary_url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── Info ── */}
            <div className="mt-6 lg:mt-0 flex flex-col gap-5">

              {/* Title + badges */}
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h1 className="text-xl lg:text-2xl font-bold text-zinc-900 leading-snug">{listing.title}</h1>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${condition.cls}`}>
                      {condition.label}
                    </span>
                    {listing.is_negotiable && (
                      <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-zinc-900 text-white">
                        Negotiable
                      </span>
                    )}
                  </div>
                </div>

                {/* Price */}
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold text-zinc-900">
                    ₹{listing.reselling_price.toLocaleString()}
                  </span>
                  {listing.original_price && (
                    <>
                      <span className="text-base text-zinc-400 line-through">
                        ₹{listing.original_price.toLocaleString()}
                      </span>
                      {discount && (
                        <span className="text-sm font-semibold text-emerald-600">{discount}% off</span>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Meta */}
              <div className="flex flex-wrap gap-3 text-sm text-zinc-500">
                <span className="flex items-center gap-1.5">
                  <Eye size={14} />{listing.view_count} views
                </span>
                {listing.age_years != null && (
                  <span className="flex items-center gap-1.5">
                    <Clock size={14} />
                    {listing.age_years === 0 ? "< 1 year old" : `${listing.age_years} yr${listing.age_years !== 1 ? "s" : ""} old`}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Calendar size={14} />
                  {new Date(listing.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </span>
              </div>

              {/* AI Score */}
              {listing.ai_quality_score != null && (
                <div className="bg-slate-50 border border-zinc-100 rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-zinc-500">AI Quality Score</span>
                    <span className="text-sm font-bold text-zinc-900">{listing.ai_quality_score}/100</span>
                  </div>
                  <div className="h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all"
                      style={{ width: `${listing.ai_quality_score}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Seller */}
              <div className="flex items-center gap-3 py-4 border-t border-b border-zinc-100">
                <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center font-semibold text-zinc-700 text-sm flex-shrink-0 overflow-hidden">
                  {listing.seller.avatar_url
                    ? <img src={listing.seller.avatar_url} alt="" className="w-full h-full object-cover" />
                    : listing.seller.full_name?.[0]?.toUpperCase()
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-900">{listing.seller.full_name}</p>
                  <p className="text-xs text-zinc-400 flex items-center gap-1 mt-0.5">
                    <MapPin size={11} />
                    {listing.seller.locality}{listing.seller.city && `, ${listing.seller.city}`}
                  </p>
                </div>
              </div>

              {/* Pickup */}
              {listing.pickup_address && (
                <div className="flex items-start gap-2 text-sm text-zinc-600">
                  <MapPin size={15} className="mt-0.5 flex-shrink-0 text-zinc-400" />
                  <div>
                    <span className="font-medium text-zinc-700">Pickup: </span>
                    {listing.pickup_address}
                    <span className="text-zinc-400 ml-1">· {listing.pickup_radius_km}km radius</span>
                  </div>
                </div>
              )}

              {/* Description */}
              <div className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-zinc-900 mb-2">Description</h2>
                <p className="text-sm text-zinc-600 leading-relaxed whitespace-pre-line">{listing.description}</p>
              </div>

              {/* Defects */}
              {listing.defects && (
                <div className="bg-amber-50 rounded-2xl border border-amber-100 p-4">
                  <h2 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
                    <AlertCircle size={14} />
                    Known Defects
                  </h2>
                  <p className="text-sm text-amber-700 leading-relaxed">{listing.defects}</p>
                </div>
              )}

              {/* Desktop CTA */}
              <div className="hidden lg:block">
                {!isSeller && isActive && (
                  <div className="flex gap-3">
                    <button
                      onClick={handleChat}
                      disabled={chatLoading}
                      className="flex-1 flex items-center justify-center gap-2 border border-zinc-200 text-zinc-700 py-3 rounded-xl text-sm font-medium hover:border-zinc-400 hover:text-zinc-900 transition disabled:opacity-50"
                    >
                      <MessageCircle size={16} />
                      {chatLoading ? "Starting..." : "Chat with Seller"}
                    </button>
                    <button
                      onClick={handleBuy}
                      className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 transition shadow-sm shadow-blue-200"
                    >
                      <ShoppingBag size={16} />
                      Buy Now
                    </button>
                  </div>
                )}
                {isSeller && (
                  <button
                    onClick={() => navigate(`/listing/${listing.id}/edit`)}
                    className="w-full border border-zinc-200 text-zinc-700 py-3 rounded-xl text-sm font-medium hover:border-zinc-400 transition"
                  >
                    Edit Listing
                  </button>
                )}
                {!isActive && !isSeller && (
                  <p className="text-sm text-zinc-400 text-center py-3">This listing is no longer available.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile fixed CTA bar */}
      {!isSeller && isActive && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-zinc-100 px-4 py-3 flex gap-3" style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}>
          <button
            onClick={handleChat}
            disabled={chatLoading}
            className="flex-1 flex items-center justify-center gap-2 border border-zinc-200 text-zinc-700 py-3 rounded-xl text-sm font-medium hover:border-zinc-400 transition disabled:opacity-50"
          >
            <MessageCircle size={16} />
            {chatLoading ? "Starting..." : "Chat"}
          </button>
          <button
            onClick={handleBuy}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 transition shadow-sm shadow-blue-200"
          >
            <ShoppingBag size={16} />
            Buy ₹{listing.reselling_price.toLocaleString()}
          </button>
        </div>
      )}

      {isSeller && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-zinc-100 px-4 py-3" style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}>
          <button
            onClick={() => navigate(`/listing/${listing.id}/edit`)}
            className="w-full border border-zinc-200 text-zinc-700 py-3 rounded-xl text-sm font-medium hover:border-zinc-400 transition"
          >
            Edit Listing
          </button>
        </div>
      )}
    </div>
  );
}