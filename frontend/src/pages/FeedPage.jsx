import { useState, useEffect } from "react";
import { Search, MapPin } from "lucide-react";
import { feedApi, searchApi, listingsApi } from "../api/listings";
import { useAuthStore } from "../store/authStore";
import Navbar from "../components/Navbar";
import ListingCard from "../components/ListingCard";
import toast from "react-hot-toast";

const SORT_OPTIONS = [
  { value: "recent", label: "Recent" },
  { value: "price_asc", label: "Price ↑" },
  { value: "price_desc", label: "Price ↓" },
  { value: "nearest", label: "Nearest" },
];

export default function FeedPage() {
  const user = useAuthStore((s) => s.user);
  const [listings, setListings] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [page, setPage] = useState(1);
  const [isSearching, setIsSearching] = useState(false);

const fetchFeed = async () => {
  setLoading(true);
  try {
    let res;
    if (searchQuery.trim()) {
      setIsSearching(true);
      res = await searchApi.search({
        q: searchQuery,
        lat: user?.latitude,
        lon: user?.longitude,
        page,
        page_size: 20,
      });
    } else {
      setIsSearching(false);
      if (user?.latitude) {
        res = await feedApi.getMyFeed({ sort_by: sortBy, page, page_size: 20 });
} else {
  res = await listingsApi.list({
    sort_by: sortBy,
    page,
    page_size: 20,
  });
}
    }
    setListings(res.data.items);
    setTotal(res.data.total);
  } catch (err) {
    toast.error("Failed to load listings");
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    fetchFeed();
  }, [sortBy, page]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchFeed();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-6">
        {user?.locality && (
          <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-4">
            <MapPin size={14} />
            <span>{user.locality}, {user.city}</span>
            <span className="text-gray-300">·</span>
            <span>{user.availability_radius_km}km radius</span>
          </div>
        )}

        <form onSubmit={handleSearch} className="relative mb-5">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search anything... 'red Nike shoes under 500'"
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
        </form>

        {!isSearching && (
          <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setSortBy(opt.value); setPage(1); }}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                  sortBy === opt.value
                    ? "bg-black text-white border-black"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {!loading && (
          <p className="text-xs text-gray-400 mb-4">
            {total} {isSearching ? `results for "${searchQuery}"` : "listings near you"}
          </p>
        )}

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden border border-gray-100">
                <div className="aspect-square bg-gray-100 animate-pulse" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-gray-100 rounded animate-pulse" />
                  <div className="h-4 bg-gray-100 rounded w-1/2 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">🏷️</p>
            <p className="text-gray-500 text-sm">No listings found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}

        {total > 20 && (
          <div className="flex justify-center gap-2 mt-8">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 text-sm border border-gray-200 rounded-xl disabled:opacity-40 hover:border-gray-400 transition"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-sm text-gray-500">Page {page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={listings.length < 20}
              className="px-4 py-2 text-sm border border-gray-200 rounded-xl disabled:opacity-40 hover:border-gray-400 transition"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
