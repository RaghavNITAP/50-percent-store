import { Link } from "react-router-dom";
import { MapPin, Tag } from "lucide-react";

const conditionColors = {
  new: "bg-emerald-50 text-emerald-700",
  good: "bg-blue-50 text-blue-700",
  fair: "bg-amber-50 text-amber-700",
  poor: "bg-red-50 text-red-700",
};

export default function ListingCard({ listing }) {
  const primaryImage = listing.images?.find((i) => i.is_primary) || listing.images?.[0];

  return (
    <Link to={`/listing/${listing.id}`} className="group block">
      <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-gray-300 hover:shadow-md transition-all duration-200">
        {/* Image */}
        <div className="aspect-square bg-gray-50 overflow-hidden relative">
          {primaryImage ? (
            <img
              src={primaryImage.cloudinary_url}
              alt={listing.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-4xl">📦</span>
            </div>
          )}
          {listing.is_negotiable && (
            <span className="absolute top-2 right-2 bg-black text-white text-xs px-2 py-1 rounded-full">
              Nego
            </span>
          )}
        </div>

        {/* Info */}
        <div className="p-3">
          <p className="text-sm font-semibold text-gray-900 truncate">{listing.title}</p>

          <div className="flex items-center justify-between mt-1">
            <p className="text-base font-bold text-gray-900">₹{listing.reselling_price.toLocaleString()}</p>
            {listing.original_price && (
              <p className="text-xs text-gray-400 line-through">₹{listing.original_price.toLocaleString()}</p>
            )}
          </div>

          <div className="flex items-center justify-between mt-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${conditionColors[listing.condition]}`}>
              {listing.condition}
            </span>
            <div className="flex items-center gap-1 text-gray-400">
              <MapPin size={11} />
              <span className="text-xs truncate max-w-[80px]">{listing.seller?.locality || listing.seller?.city}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
