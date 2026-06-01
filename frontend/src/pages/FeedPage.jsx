import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Search, MapPin, SlidersHorizontal, X } from "lucide-react";
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

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl overflow-hidden border border-zinc-100 shadow-sm">
      <div className="aspect-square bg-zinc-100 animate-pulse" />
      <div className="p-2.5 space-y-2">
        <div className="h-3 bg-zinc-100 rounded animate-pulse" />
        <div className="h-4 bg-zinc-100 rounded w-1/2 animate-pulse" />
        <div className="h-3 bg-zinc-100 rounded w-2/3 animate-pulse" />
      </div>
    </div>
  );
}

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
          res = await listingsApi.list({ sort_by: sortBy, page, page_size: 20 });
        }
      }
      setListings(res.data.items);
      setTotal(res.data.total);
    } catch {
      toast.error("Failed to load listings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFeed(); }, [sortBy, page]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchFeed();
  };

  const clearSearch = () => {
    setSearchQuery("");
    setIsSearching(false);
    setPage(1);
    setTimeout(fetchFeed, 0);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 lg:px-8 py-4 pb-24 lg:pb-8">

        {/* Location strip */}
        {user?.locality && (
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-3">
            <MapPin size={12} className="text-blue-500" />
            <span className="font-medium">{user.locality}, {user.city}</span>
            <span className="text-zinc-300">·</span>
            <span>{user.availability_radius_km}km radius</span>
          </div>
        )}

        {!user?.latitude && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-3 text-xs text-amber-700">
            <MapPin size={13} className="flex-shrink-0" />
            <span>📍 Enable location in your <Link to="/profile" className="font-semibold underline">Profile</Link> to see items near you.</span>
          </div>
        )}

        {/* Search */}
        <form onSubmit={handleSearch} className="relative mb-4">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search anything... 'red Nike shoes', 'iPhone 13'..."
            className="w-full pl-10 pr-10 py-3 bg-white border border-zinc-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm transition"
          />
          {searchQuery && (
            <button type="button" onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition">
              <X size={16} />
            </button>
          )}
        </form>

        {/* Sort pills */}
        {!isSearching && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setSortBy(opt.value); setPage(1); }}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  sortBy === opt.value
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-200"
                    : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Results count */}
        {!loading && (
          <p className="text-xs text-zinc-400 mb-3">
            {isSearching
              ? <><span className="font-medium text-zinc-600">{total}</span> results for "<span className="font-medium text-zinc-700">{searchQuery}</span>"</>
              : <><span className="font-medium text-zinc-600">{total}</span> listings {user?.locality ? "near you" : "available"}</>
            }
          </p>
        )}

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {[...Array(10)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : listings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <span className="text-5xl mb-4">🏷️</span>
            <p className="text-zinc-700 font-semibold text-base">No listings found</p>
            <p className="text-zinc-400 text-sm mt-1">
              {isSearching ? "Try different keywords" : "Check back soon!"}
            </p>
            {isSearching && (
              <button onClick={clearSearch} className="mt-4 text-blue-600 text-sm font-medium hover:underline">
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > 20 && (
          <div className="flex justify-center items-center gap-3 mt-8">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-5 py-2 text-sm border border-zinc-200 rounded-xl disabled:opacity-40 hover:border-zinc-400 bg-white transition"
            >
              ← Previous
            </button>
            <span className="text-sm text-zinc-500 font-medium">Page {page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={listings.length < 20}
              className="px-5 py-2 text-sm border border-zinc-200 rounded-xl disabled:opacity-40 hover:border-zinc-400 bg-white transition"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
