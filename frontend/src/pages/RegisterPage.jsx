import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useGoogleLogin } from "@react-oauth/google";
import { MapPin, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

export default function RegisterPage() {
  const [form, setForm] = useState({
    full_name: "", email: "", password: "", role: "buyer", city: "", locality: "",
    latitude: null, longitude: null, availability_radius_km: 5,
  });
  const [locating, setLocating] = useState(false);
  const register = useAuthStore((s) => s.register);
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);
  const loading = useAuthStore((s) => s.loading);
  const navigate = useNavigate();

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        await loginWithGoogle(tokenResponse.access_token);
        navigate("/");
      } catch {
        toast.error("Google login failed");
      }
    },
    onError: () => toast.error("Google login cancelled"),
  });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const detectLocation = () => {
    if (!navigator.geolocation) return toast.error("Geolocation not supported");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({ ...f, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
        setLocating(false);
        toast.success("Location detected");
      },
      (err) => { setLocating(false); toast.error("Could not detect location: " + err.message); }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await register(form);
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

          {/* GPS */}
          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1.5">
              Location <span className="text-zinc-400 font-normal">(optional — for nearby listings)</span>
            </label>
            <button type="button" onClick={detectLocation} disabled={locating}
              className={`w-full flex items-center justify-center gap-2 border rounded-xl py-2.5 text-sm transition disabled:opacity-50 ${
                form.latitude ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-zinc-200 text-zinc-600 hover:border-zinc-400"
              }`}>
              {locating ? <><Loader2 size={14} className="animate-spin" />Detecting...</>
                : form.latitude ? <><MapPin size={14} />Location set ✓</>
                : <><MapPin size={14} />Detect my location</>}
            </button>
          </div>

          {/* Radius slider */}
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

          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-2">I want to</label>
            <div className="grid grid-cols-3 gap-2">
              {[{ value: "buyer", label: "Buy" }, { value: "seller", label: "Sell" }, { value: "both", label: "Both" }].map((r) => (
                <button key={r.value} type="button" onClick={() => setForm({ ...form, role: r.value })}
                  className={`py-2.5 rounded-xl text-sm font-medium border transition ${
                    form.role === r.value
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-200"
                      : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
                  }`}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition shadow-sm shadow-blue-200 mt-2">
            {loading ? "Creating account..." : "Create account"}
          </button>

          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-zinc-100" />
            <span className="text-xs text-zinc-400">or</span>
            <div className="flex-1 h-px bg-zinc-100" />
          </div>

          <button
            type="button"
            onClick={() => handleGoogleLogin()}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 border border-zinc-200 bg-white text-zinc-700 py-3 rounded-xl text-sm font-medium hover:border-zinc-400 hover:bg-zinc-50 transition disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.8 2.5 30.2 0 24 0 14.7 0 6.8 5.5 2.9 13.6l7.8 6C12.5 13.1 17.8 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.4c-.5 2.8-2.1 5.2-4.5 6.8l7 5.4C43.1 37 46.1 31.2 46.1 24.5z"/>
              <path fill="#FBBC05" d="M10.7 28.6A14.8 14.8 0 0 1 9.5 24c0-1.6.3-3.2.8-4.6l-7.8-6A23.9 23.9 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l8.1-6.1z"/>
              <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7-5.4c-2 1.4-4.6 2.2-8.2 2.2-6.2 0-11.5-4.2-13.4-9.8l-8.1 6.1C6.7 42.4 14.7 48 24 48z"/>
            </svg>
            Continue with Google
          </button>
        </form>

        <p className="text-center text-sm text-zinc-400 mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-blue-600 font-semibold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
