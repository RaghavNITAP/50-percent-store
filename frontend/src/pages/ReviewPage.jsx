import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Star, ChevronLeft, CheckCircle } from "lucide-react";
import { reviewsApi } from "../api/reviews";
import { paymentsApi } from "../api/payments";
import { listingsApi } from "../api/listings";
import { useAuthStore } from "../store/authStore";
import Navbar from "../components/Navbar";
import toast from "react-hot-toast";

const STAR_LABELS = {
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Great",
  5: "Excellent",
};

export default function ReviewPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [order, setOrder] = useState(null);
  const [listing, setListing] = useState(null);
  const [existingReview, setExistingReview] = useState(null);
  const [loading, setLoading] = useState(true);

  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const orderRes = await paymentsApi.getOrder(orderId);
        const o = orderRes.data;
        setOrder(o);

        // Check if already reviewed
        try {
          const reviewRes = await reviewsApi.getOrderReview(orderId);
          setExistingReview(reviewRes.data);
          setRating(reviewRes.data.rating);
          setComment(reviewRes.data.comment || "");
        } catch {
          // No review yet — that's fine
        }

        // Fetch listing for context
        try {
          const listingRes = await listingsApi.get(o.listing_id);
          setListing(listingRes.data);
        } catch {
          // Fine if it fails
        }
      } catch {
        toast.error("Order not found");
        navigate("/");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [orderId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) return toast.error("Select a star rating");
    setSubmitting(true);
    try {
      await reviewsApi.submit({
        order_id: orderId,
        rating,
        comment: comment.trim() || null,
      });
      setDone(true);
      toast.success("Review submitted!");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-black rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  // Order not completed
  if (order && order.status !== "completed") {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <p className="text-4xl mb-3">🔒</p>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Not yet</h2>
          <p className="text-sm text-gray-500">
            You can only leave a review after the order is marked as completed.
          </p>
          <button
            onClick={() => navigate(-1)}
            className="mt-6 px-5 py-2.5 bg-black text-white rounded-xl text-sm font-medium"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Already reviewed — show submitted review
  if (existingReview && !done) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-md mx-auto px-4 py-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-black mb-5 transition"
          >
            <ChevronLeft size={16} /> Back
          </button>

          <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
            <CheckCircle size={40} className="text-emerald-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-gray-900 mb-1">Review Submitted</h2>
            <p className="text-sm text-gray-500 mb-5">You already reviewed this order.</p>

            <div className="flex justify-center gap-1 mb-3">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  size={24}
                  className={s <= existingReview.rating ? "text-amber-400 fill-amber-400" : "text-gray-200"}
                />
              ))}
            </div>

            {existingReview.comment && (
              <p className="text-sm text-gray-600 italic">"{existingReview.comment}"</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Submitted successfully
  if (done) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <CheckCircle size={48} className="text-emerald-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Thank you!</h2>
          <p className="text-sm text-gray-500 mb-6">Your review helps the community.</p>
          <div className="flex justify-center gap-1 mb-6">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                size={28}
                className={s <= rating ? "text-amber-400 fill-amber-400" : "text-gray-200"}
              />
            ))}
          </div>
          <button
            onClick={() => navigate("/profile")}
            className="bg-black text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-gray-800 transition"
          >
            View Profile
          </button>
        </div>
      </div>
    );
  }

  const activeRating = hovered || rating;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-md mx-auto px-4 py-8">

        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-black mb-5 transition"
        >
          <ChevronLeft size={16} /> Back
        </button>

        <h1 className="text-xl font-bold text-gray-900 mb-6">Leave a Review</h1>

        {/* Order context */}
        {listing && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 mb-4">
            {listing.images?.[0] ? (
              <img
                src={listing.images.find((i) => i.is_primary)?.cloudinary_url || listing.images[0].cloudinary_url}
                alt=""
                className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center text-2xl flex-shrink-0">
                📦
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{listing.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Sold by {listing.seller?.full_name} · ₹{order.agreed_price.toLocaleString()}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Star rating */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <p className="text-sm font-semibold text-gray-900 text-center mb-5">
              How was your experience?
            </p>

            <div className="flex justify-center gap-2 mb-3">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setRating(s)}
                  onMouseEnter={() => setHovered(s)}
                  onMouseLeave={() => setHovered(0)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    size={36}
                    className={`transition-colors ${
                      s <= activeRating
                        ? "text-amber-400 fill-amber-400"
                        : "text-gray-200"
                    }`}
                  />
                </button>
              ))}
            </div>

            {activeRating > 0 && (
              <p className="text-center text-sm font-medium text-gray-600">
                {STAR_LABELS[activeRating]}
              </p>
            )}
          </div>

          {/* Comment */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Comment <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="How was the seller? Was the item as described?"
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || rating === 0}
            className="w-full bg-black text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 transition"
          >
            {submitting ? "Submitting..." : "Submit Review"}
          </button>
        </form>

      </div>
    </div>
  );
}