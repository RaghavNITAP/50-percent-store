import { useState, useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, MapPin, X, SlidersHorizontal } from "lucide-react";
import { feedApi, searchApi, listingsApi, categoriesApi } from "../api/listings";
import { useAuthStore } from "../store/authStore";
import Navbar from "../components/Navbar";
import ListingCard from "../components/ListingCard";
import toast from "react-hot-toast";

const SORT_OPTIONS = [
  { value: "recent",     label: "Recent" },
  { value: "price_asc",  label: "Price ↑" },
  { value: "price_desc", label: "Price ↓" },
  { value: "nearest",    label: "Nearest" },
];

const CONDITIONS = [
  { value: "",     label: "Any" },
  { value: "new",  label: "Brand New" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
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

const EMPTY_FILTERS = { condition: "", is_negotiable: null, min_price: "", max_price: "", category_id: "" };

export default function FeedPage() {
  const user = useAuthStore((s) => s.user);

  const [searchParams, setSearchParams] = useSearchParams();
  const qFromUrl = searchParams.get("q") || "";

  const [inputValue, setInputValue]   = useState(qFromUrl);
  const [sortBy,     setSortBy]       = useState("recent");
  const [page,       setPage]         = useState(1);
  const [listings,   setListings]     = useState([]);
  const [total,      setTotal]        = useState(0);
  const [loading,    setLoading]      = useState(true);
  const [categories, setCategories]   = useState([]);

  // ── Client-side filters (only active during search) ───────────────────────
  const [filters,     setFilters]     = useState(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);

  const isSearching = !!qFromUrl;

  // Sync input when URL changes (logo click clears ?q=)
  useEffect(() => { setInputValue(qFromUrl); }, [qFromUrl]);

  // Fetch categories once
  useEffect(() => {
    categoriesApi.getAll()
      .then((res) => setCategories(res.data))
      .catch(() => {});
  }, []);

  // Reset filters + close panel when leaving search mode
  useEffect(() => {
    if (!isSearching) {
      setFilters(EMPTY_FILTERS);
      setShowFilters(false);
    }
  }, [isSearching]);

  // ── Fetch whenever URL search param / sort / page / user changes ──────────
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        let res;
        if (qFromUrl.trim()) {
          res = await searchApi.search({
            q: qFromUrl.trim(),
            ...(user?.latitude && {
              lat: user.latitude,
              lon: user.longitude,
              radius_km: user.availability_radius_km,
            }),
            page,
            page_size: 60, // fetch more so client filters have enough to work with
          });
        } else if (user?.latitude) {
          res = await feedApi.getMyFeed({ sort_by: sortBy, page, page_size: 20 });
        } else {
          res = await listingsApi.list({ sort_by: sortBy, page, page_size: 20 });
        }
        if (!cancelled) {
          setListings(res.data.items);
          setTotal(res.data.total);
        }
      } catch {
        if (!cancelled) toast.error("Failed to load listings");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [qFromUrl, sortBy, page, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Client-side filter application ───────────────────────────────────────
  const filteredListings = useMemo(() => {
    if (!isSearching) return listings;
    return listings.filter((l) => {
      if (filters.condition && l.condition !== filters.condition) return false;
      if (filters.is_negotiable !== null && l.is_negotiable !== filters.is_negotiable) return false;
      if (filters.min_price !== "" && l.reselling_price < Number(filters.min_price)) return false;
      if (filters.max_price !== "" && l.reselling_price > Number(filters.max_price)) return false;
      if (filters.category_id && String(l.category_id) !== filters.category_id) return false;
      return true;
    });
  }, [listings, filters, isSearching]);

  const activeFilterCount = [
    filters.condition,
    filters.is_negotiable !== null,
    filters.min_price !== "",
    filters.max_price !== "",
    filters.category_id,
  ].filter(Boolean).length;

  const clearFilters = () => setFilters(EMPTY_FILTERS);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    const trimmed = inputValue.trim();
    trimmed ? setSearchParams({ q: trimmed }) : setSearchParams({});
  };

  const clearSearch = () => {
    setInputValue("");
    setPage(1);
    setSearchParams({});
  };

  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 lg:px-8 py-4 pb-24 lg:pb-8">

        {/* Location strip */}
        {(user?.pincode || user?.locality) && (
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-3">
            <MapPin size={12} className="text-blue-500" />
            <span className="font-medium">
              {user.locality
                ? `${user.locality}${user.city ? `, ${user.city}` : ""}`
                : `📍 ${user.pincode}`}
            </span>
            <span className="text-zinc-300">·</span>
            <span>{user.availability_radius_km}km radius</span>
          </div>
        )}

        {!user?.latitude && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-3 text-xs text-amber-700">
            <MapPin size={13} className="flex-shrink-0" />
            <span>📍 Add your pincode in <Link to="/profile" className="font-semibold underline">Profile</Link> to see items near you.</span>
          </div>
        )}

        {/* Search bar */}
        <form onSubmit={handleSearch} className="relative mb-2">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search anything... 'red Nike shoes', 'iPhone 13'..."
            className="w-full pl-10 pr-10 py-3 bg-white border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0052FF]/20 focus:border-[#0052FF]/40 shadow-sm transition"
          />
          {inputValue && (
            <button type="button" onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition">
              <X size={16} />
            </button>
          )}
        </form>

        {/* Filter toggle — only during search */}
        {isSearching && (
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl border transition ${
                showFilters || activeFilterCount > 0
                  ? "bg-[#0052FF] text-white border-[#0052FF]"
                  : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
              }`}
            >
              <SlidersHorizontal size={13} />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-0.5 bg-white text-blue-600 rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="text-xs text-zinc-400 hover:text-red-500 transition">
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* Filter panel */}
        {isSearching && showFilters && (
          <div className="bg-white border border-zinc-100 rounded-2xl shadow-sm p-4 mb-4 space-y-4">

            {/* Condition */}
            <div>
              <p className="text-xs font-semibold text-zinc-500 mb-2">Condition</p>
              <div className="flex gap-1.5 flex-wrap">
                {CONDITIONS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setFilter("condition", c.value)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                      filters.condition === c.value
                        ? "bg-[#0052FF] text-white border-[#0052FF] shadow-[0_2px_12px_rgba(0,82,255,0.35)]"
                        : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:border-zinc-400"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category */}
            {categories.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-zinc-500 mb-2">Category</p>
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  <button
                    onClick={() => setFilter("category_id", "")}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                      !filters.category_id
                        ? "bg-[#0052FF] text-white border-[#0052FF] shadow-[0_2px_12px_rgba(0,82,255,0.35)]"
                        : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:border-zinc-400"
                    }`}
                  >
                    Any
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setFilter("category_id", String(cat.id))}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                        filters.category_id === String(cat.id)
                          ? "bg-[#0052FF] text-white border-[#0052FF] shadow-[0_2px_12px_rgba(0,82,255,0.35)]"
                          : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:border-zinc-400"
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Negotiable */}
            <div>
              <p className="text-xs font-semibold text-zinc-500 mb-2">Price</p>
              <div className="flex gap-2 items-center mb-3">
                {[
                  { label: "Any", value: null },
                  { label: "Negotiable", value: true },
                ].map((opt) => (
                  <button
                    key={String(opt.value)}
                    onClick={() => setFilter("is_negotiable", opt.value)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                      filters.is_negotiable === opt.value
                        ? "bg-[#0052FF] text-white border-[#0052FF] shadow-[0_2px_12px_rgba(0,82,255,0.35)]"
                        : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:border-zinc-400"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Price range */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">₹</span>
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.min_price}
                    onChange={(e) => setFilter("min_price", e.target.value)}
                    className="w-full pl-6 pr-3 py-2 text-xs border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min={0}
                  />
                </div>
                <span className="text-zinc-300 text-xs">—</span>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">₹</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.max_price}
                    onChange={(e) => setFilter("max_price", e.target.value)}
                    className="w-full pl-6 pr-3 py-2 text-xs border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min={0}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sort pills — only when not searching */}
        {!isSearching && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setSortBy(opt.value); setPage(1); }}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  sortBy === opt.value
                    ? "bg-[#0052FF] text-white border-[#0052FF] shadow-[0_2px_12px_rgba(0,82,255,0.35)]"
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
            {isSearching ? (
              <>
                <span className="font-medium text-zinc-600">{filteredListings.length}</span>
                {activeFilterCount > 0 && <span> of {listings.length}</span>}
                {" "}results for "<span className="font-medium text-zinc-700">{qFromUrl}</span>"
              </>
            ) : (
              <><span className="font-medium text-zinc-600">{total}</span> listings {user?.locality ? "near you" : "available"}</>
            )}
          </p>
        )}

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {[...Array(10)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filteredListings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <span className="text-5xl mb-4">🏷️</span>
            <p className="text-zinc-700 font-semibold text-base">No listings found</p>
            <p className="text-zinc-400 text-sm mt-1">
              {activeFilterCount > 0 ? "Try adjusting your filters" : isSearching ? "Try different keywords" : "Check back soon!"}
            </p>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="mt-4 text-blue-600 text-sm font-medium hover:underline">
                Clear filters
              </button>
            )}
            {isSearching && activeFilterCount === 0 && (
              <button onClick={clearSearch} className="mt-4 text-blue-600 text-sm font-medium hover:underline">
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredListings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}

        {/* Pagination — only on feed, not on filtered search */}
        {!isSearching && total > 20 && (
          <div className="flex justify-center items-center gap-3 mt-8">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="px-5 py-2 text-sm border border-zinc-200 rounded-xl disabled:opacity-40 hover:border-zinc-400 bg-white transition">
              ← Previous
            </button>
            <span className="text-sm text-zinc-500 font-medium">Page {page}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={listings.length < 20}
              className="px-5 py-2 text-sm border border-zinc-200 rounded-xl disabled:opacity-40 hover:border-zinc-400 bg-white transition">
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
