import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";

const conditionConfig = {
  new:  { label: "New",  cls: "bg-green-50 text-green-700 border border-green-200" },
  good: { label: "Good", cls: "bg-green-50 text-green-700 border border-green-200" },
  fair: { label: "Fair", cls: "bg-amber-50 text-amber-700 border border-amber-200" },
  poor: { label: "Poor", cls: "bg-red-50 text-red-500 border border-red-200" },
};

export default function ListingCard({ listing }) {
  const primaryImage = listing.images?.find((i) => i.is_primary) || listing.images?.[0];
  const condition = conditionConfig[listing.condition] || conditionConfig.good;
  const discount = listing.original_price
    ? Math.round((1 - listing.reselling_price / listing.original_price) * 100)
    : null;

  return (
    <Link to={`/listing/${listing.id}`} className="group block">
      <div className="bg-white rounded-xl overflow-hidden border border-gray-100 shadow-[0_4px_20px_rgba(0,82,255,0.08)] transition-all duration-200 group-hover:shadow-[0_8px_30px_rgba(0,82,255,0.15)] group-hover:-translate-y-1 active:scale-[0.98]">

        {/* Image */}
        <div className="aspect-square bg-zinc-50 overflow-hidden relative">
          {primaryImage ? (
            <img
              src={primaryImage.cloudinary_url}
              alt={listing.title}
              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-4xl">📦</span>
            </div>
          )}

          {/* Discount badge — glow pill */}
          {discount && discount > 0 && (
            <span
              className="absolute top-2 left-2 bg-[#0052FF] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-lg"
              style={{ boxShadow: "0 2px 8px rgba(0,82,255,0.4)" }}
            >
              -{discount}%
            </span>
          )}

          {/* Negotiable badge — neutral */}
          {listing.is_negotiable && (
            <span className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm text-gray-500 text-[10px] font-medium px-1.5 py-0.5 rounded-lg border border-gray-300">
              Nego
            </span>
          )}
        </div>

        {/* Info */}
        <div className="p-2.5">
          {/* Title */}
          <p className="text-sm font-medium text-zinc-900 truncate capitalize leading-snug">
            {listing.title}
          </p>

          {/* Price row */}
          <div className="flex items-baseline gap-1.5 mt-1">
            <p className="text-lg font-bold text-zinc-900">
              ₹{listing.reselling_price.toLocaleString()}
            </p>
            {listing.original_price && (
              <p className="text-sm text-gray-400 line-through">
                ₹{listing.original_price.toLocaleString()}
              </p>
            )}
          </div>

          {/* Bottom row — condition chip + trust + location */}
          <div className="flex items-center justify-between mt-1.5">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${condition.cls}`}>
              {condition.label}
            </span>
            <div className="flex items-center gap-1.5 min-w-0">
              {listing.seller?.trust_score != null && (
                <span className="text-[10px] text-zinc-500 flex items-center gap-0.5">
                  <span className="text-yellow-400 font-bold">★</span>
                  {listing.seller.trust_score}
                </span>
              )}
              {(listing.seller?.locality || listing.seller?.city) && (
                <div className="flex items-center gap-0.5 text-zinc-400 min-w-0">
                  <MapPin size={10} className="flex-shrink-0" />
                  <span className="text-[10px] truncate max-w-[60px]">
                    {listing.seller.locality || listing.seller.city}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
