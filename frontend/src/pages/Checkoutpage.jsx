import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Loader } from "lucide-react";
import { listingsApi } from "../api/listings";
import { paymentsApi } from "../api/payments";
import toast from "react-hot-toast";


function CheckoutForm({ listing, orderId, onSuccess }) {
  const [paying, setPaying] = useState(false);

const handleSubmit = async (e) => {
  e.preventDefault();
  setPaying(true);
  try {
    await new Promise((r) => setTimeout(r, 1500));
    console.log("calling markPaid with orderId:", orderId);
    const res = await paymentsApi.markPaid(orderId);
    console.log("markPaid response:", res.data);
    toast.success("Payment successful!");
    onSuccess(orderId);
  } catch (err) {
    console.error("markPaid error:", err);
    toast.error("Payment failed");
  } finally {
    setPaying(false);
  }
};
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="border border-gray-200 rounded-xl p-4 space-y-3">
        <input
          placeholder="Card number: 4242 4242 4242 4242"
          disabled
          className="w-full text-sm text-gray-400 bg-transparent focus:outline-none"
        />
        <div className="flex gap-3">
          <input placeholder="MM/YY" disabled className="w-full text-sm text-gray-400 bg-transparent focus:outline-none" />
          <input placeholder="CVC" disabled className="w-full text-sm text-gray-400 bg-transparent focus:outline-none" />
        </div>
      </div>
      <p className="text-xs text-gray-400 text-center">Demo mode — no real charge</p>
      <button
        type="submit"
        disabled={paying}
        className="w-full bg-black text-white py-3 rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition flex items-center justify-center gap-2"
      >
        {paying ? (
          <><Loader size={15} className="animate-spin" /> Processing...</>
        ) : (
          <><ShieldCheck size={15} /> Pay ₹{listing.reselling_price.toLocaleString()}</>
        )}
      </button>
    </form>
  );
}

export default function CheckoutPage() {
  const { id: listingId } = useParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState(null);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [agreedPrice, setAgreedPrice] = useState("");
  const [orderCreated, setOrderCreated] = useState(false);

  useEffect(() => {
    listingsApi.get(listingId)
      .then((res) => {
        setListing(res.data);
        setAgreedPrice(res.data.reselling_price);
      })
      .catch(() => toast.error("Listing not found"))
      .finally(() => setLoading(false));
  }, [listingId]);

  const handleCreateOrder = async () => {
    try {
      setLoading(true);
      const res = await paymentsApi.createOrder({
        listing_id: listingId,
        agreed_price: parseFloat(agreedPrice),
      });
      setOrder({ id: res.data.order_id });
      setOrderCreated(true);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create order");
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = (orderId) => {
    navigate(`/order/${orderId}`);
  };

  if (loading && !listing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!listing) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-xl hover:bg-gray-100 transition">
            <ArrowLeft size={18} className="text-gray-500" />
          </button>
          <h1 className="text-lg font-bold">Checkout</h1>
        </div>

        {/* Listing summary */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
          <div className="flex gap-3">
            {listing.images?.[0] ? (
              <img src={listing.images[0].cloudinary_url} alt={listing.title} className="w-16 h-16 rounded-xl object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center text-2xl">📦</div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{listing.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{listing.seller?.full_name}</p>
              <p className="text-base font-bold text-gray-900 mt-1">₹{listing.reselling_price.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Price */}
        {listing.is_negotiable && !orderCreated && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Agreed price <span className="text-gray-400">(negotiable)</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₹</span>
              <input
                type="number"
                value={agreedPrice}
                onChange={(e) => setAgreedPrice(e.target.value)}
                className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
          </div>
        )}

        {/* Payment */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          {!orderCreated ? (
            <button
              onClick={handleCreateOrder}
              disabled={loading}
              className="w-full bg-black text-white py-3 rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition"
            >
              {loading ? "Loading..." : "Proceed to Payment"}
            </button>
          ) : (
            <CheckoutForm listing={listing} orderId={order.id} onSuccess={handleSuccess} />
          )}
        </div>

        <div className="flex items-center justify-center gap-1.5 mt-4 text-xs text-gray-400">
          <ShieldCheck size={13} />
          <span>Secured by Stripe</span>
        </div>
      </div>
    </div>
  );
}