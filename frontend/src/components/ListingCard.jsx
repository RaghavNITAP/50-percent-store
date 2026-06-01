import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";

const conditionConfig = {
  new:  { label: "New",  cls: "bg-emerald-50 text-emerald-700" },
  good: { label: "Good", cls: "bg-blue-50 text-blue-600" },
  fair: { label: "Fair", cls: "bg-amber-50 text-amber-700" },
  poor: { label: "Poor", cls: "bg-red-50 text-red-600" },
};

export default function ListingCard({ listing }) {
  const primaryImage = listing.images?.find((i) => i.is_primary) || listing.images?.[0];
  const condition = conditionConfig[listing.condition] || conditionConfig.good;
  const discount = listing.original_price
    ? Math.round((1 - listing.reselling_price / listing.original_price) * 100)
    : null;

  return (
    <Link to={`/listing/${listing.id}`} className="group block">
      <div
        className="bg-white rounded-xl overflow-hidden border border-zinc-100 transition-all duration-200"
        style={{
          boxShadow: "var(--shadow-sm)",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "var(--shadow-md)")}
        onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "var(--shadow-sm)")}
      >
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

          {/* Discount badge */}
          {discount && discount > 0 && (
            <span className="absolute top-2 left-2 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-lg">
              -{discount}%
            </span>
          )}

          {/* Negotiable badge */}
          {listing.is_negotiable && (
            <span className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm text-zinc-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-lg border border-zinc-200">
              Nego
            </span>
          )}
        </div>

        {/* Info */}
        <div className="p-2.5">
          <p className="text-sm font-semibold text-zinc-900 truncate leading-snug">
            {listing.title}
          </p>

          <div className="flex items-baseline gap-1.5 mt-1">
            <p className="text-base font-bold text-zinc-900">
              ₹{listing.reselling_price.toLocaleString()}
            </p>
            {listing.original_price && (
              <p className="text-xs text-zinc-400 line-through">
                ₹{listing.original_price.toLocaleString()}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between mt-1.5">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${condition.cls}`}>
              {condition.label}
            </span>
            {(listing.seller?.locality || listing.seller?.city) && (
              <div className="flex items-center gap-0.5 text-zinc-400 min-w-0">
                <MapPin size={10} className="flex-shrink-0" />
                <span className="text-[10px] truncate max-w-[72px]">
                  {listing.seller.locality || listing.seller.city}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
