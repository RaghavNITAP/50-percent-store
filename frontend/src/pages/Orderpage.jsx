import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { CheckCircle, Loader, MapPin } from "lucide-react";
import { paymentsApi } from "../api/payments";
import toast from "react-hot-toast";

const STATUS_LABELS = {
  pending: { label: "Pending", color: "text-yellow-600 bg-yellow-50" },
  paid: { label: "Paid", color: "text-blue-600 bg-blue-50" },
  completed: { label: "Completed", color: "text-emerald-600 bg-emerald-50" },
  cancelled: { label: "Cancelled", color: "text-red-600 bg-red-50" },
  refunded: { label: "Refunded", color: "text-gray-600 bg-gray-50" },
};

export default function OrderPage() {
  const { id: orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    paymentsApi.getOrder(orderId)
      .then((res) => setOrder(res.data))
      .catch(() => toast.error("Order not found"))
      .finally(() => setLoading(false));
  }, [orderId]);

  const handleComplete = async () => {
    setCompleting(true);
    try {
      const res = await paymentsApi.completeOrder(orderId);
      setOrder(res.data);
      toast.success("Order marked as complete!");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to complete order");
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!order) return null;

  const status = STATUS_LABELS[order.status] || STATUS_LABELS.pending;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto px-4 py-10">
        {/* Success icon */}
        <div className="text-center mb-8">
          <CheckCircle size={48} className="mx-auto text-emerald-500 mb-3" />
          <h1 className="text-xl font-bold text-gray-900">Order Confirmed</h1>
          <p className="text-sm text-gray-500 mt-1">Your payment was successful</p>
        </div>

        {/* Order details */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Status</span>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${status.color}`}>
              {status.label}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Amount paid</span>
            <span className="text-sm font-bold">₹{order.agreed_price.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Order ID</span>
            <span className="text-xs text-gray-400 font-mono">{order.id.slice(0, 8)}...</span>
          </div>
        </div>

        {/* Pickup reminder */}
        {order.status === "paid" && (
          <div className="bg-blue-50 rounded-2xl p-4 mb-4">
            <div className="flex gap-2">
              <MapPin size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900">Coordinate pickup with seller</p>
                <p className="text-xs text-blue-600 mt-0.5">
                  Once you've received the item, mark the order as complete.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {order.status === "paid" && (
            <button
              onClick={handleComplete}
              disabled={completing}
              className="w-full bg-black text-white py-3 rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition"
            >
              {completing ? "Confirming..." : "I received the item ✓"}
            </button>
          )}

          {order.status === "completed" && (
            <Link
              to={`/review/${orderId}`}
              className="block w-full text-center bg-black text-white py-3 rounded-xl text-sm font-medium hover:bg-gray-800 transition"
            >
              Leave a Review
            </Link>
          )}

          <Link
            to="/"
            className="block w-full text-center border border-gray-200 text-gray-700 py-3 rounded-xl text-sm font-medium hover:border-gray-400 transition"
          >
            Back to Feed
          </Link>
        </div>
      </div>
    </div>
  );
}