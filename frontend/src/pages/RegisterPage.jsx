import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { GoogleLogin } from "@react-oauth/google";
import { Loader2 } from "lucide-react";
import { locationsApi } from "../api/locations";
import toast from "react-hot-toast";

export default function RegisterPage() {
  const [form, setForm] = useState({
    full_name: "", email: "", password: "", role: "both",
    city: "", locality: "", pincode: "",
    latitude: null, longitude: null, availability_radius_km: 5,
  });
  const [resolving, setResolving] = useState(false);
  const register = useAuthStore((s) => s.register);
  const loading = useAuthStore((s) => s.loading);
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();

    let submitData = { ...form };

    // Resolve pincode to lat/lon before submitting
    if (form.pincode) {
      if (!/^\d{6}$/.test(form.pincode)) {
        return toast.error("Pincode must be exactly 6 digits");
      }
      setResolving(true);
      try {
        const res = await locationsApi.resolvePincode(form.pincode);
        submitData.latitude = res.data.latitude;
        submitData.longitude = res.data.longitude;
      } catch {
        return toast.error("Invalid pincode. Please check and try again.");
      } finally {
        setResolving(false);
      }
    }

    try {
      await register(submitData);
      toast.success("Account created!");
      navigate("/");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Registration failed");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <img src="/logo.png" alt="50% Store" className="h-16 w-auto object-contain mb-8" />

      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-zinc-100 p-7">
        <h1 className="text-xl font-bold text-zinc-900 mb-0.5">Create account</h1>
        <p className="text-zinc-400 text-sm mb-6">Join 50% Store today</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1.5">Full name</label>
            <input name="full_name" value={form.full_name} onChange={handleChange}
              className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              placeholder="Rahul Sharma" required />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1.5">Email</label>
            <input name="email" type="email" value={form.email} onChange={handleChange}
              className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              placeholder="you@example.com" required />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1.5">Password</label>
            <input name="password" type="password" value={form.password} onChange={handleChange}
              className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              placeholder="min 8 characters" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1.5">City</label>
              <input name="city" value={form.city} onChange={handleChange}
                className="w-full border border-zinc-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="Bhopal" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1.5">Locality</label>
              <input name="locality" value={form.locality} onChange={handleChange}
                className="w-full border border-zinc-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="MP Nagar" />
            </div>
          </div>

          {/* Pincode */}
          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1.5">
              Pincode <span className="text-zinc-400 font-normal">(for nearby listings)</span>
            </label>
            <input
              name="pincode"
              value={form.pincode}
              onChange={handleChange}
              placeholder="e.g. 462011"
              maxLength={6}
              inputMode="numeric"
              className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>

          {/* Discovery Radius */}
          <div>
            <div className="flex justify-between text-xs text-zinc-500 mb-1">
              <span className="font-semibold text-zinc-600">Discovery Radius</span>
              <span className="font-bold text-zinc-800">{form.availability_radius_km}km</span>
            </div>
            <input type="range" min="1" max="50" step="1"
              value={form.availability_radius_km}
              onChange={(e) => setForm((f) => ({ ...f, availability_radius_km: Number(e.target.value) }))}
              className="w-full accent-blue-600" />
            <div className="flex justify-between text-xs text-zinc-400 mt-0.5">
              <span>1km</span><span>50km</span>
            </div>
          </div>

          <button type="submit" disabled={loading || resolving}
            className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition shadow-sm shadow-blue-200 mt-2">
            {resolving ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Verifying pincode...
              </span>
            ) : loading ? "Creating account..." : "Create account"}
          </button>

          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-zinc-100" />
            <span className="text-xs text-zinc-400">or</span>
            <div className="flex-1 h-px bg-zinc-100" />
          </div>

          <div className="flex justify-center">
            <GoogleLogin
              ux_mode="redirect"
              login_uri={`${import.meta.env.VITE_API_URL || "https://50-percent-store-production.up.railway.app"}/auth/google/callback`}
              onError={() => toast.error("Google login failed")}
              width="340"
              theme="outline"
              size="large"
              text="continue_with"
              shape="rectangular"
            />
          </div>
        </form>

        <p className="text-center text-sm text-zinc-400 mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-blue-600 font-semibold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
