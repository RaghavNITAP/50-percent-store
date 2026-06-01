import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import toast from "react-hot-toast";

export default function RegisterPage() {
  const [form, setForm] = useState({
    full_name: "", email: "", password: "", role: "buyer", city: "", locality: "",
  });
  const register = useAuthStore((s) => s.register);
  const loading = useAuthStore((s) => s.loading);
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

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
      {/* Logo */}
      <img src="/logo.png" alt="50% Store" className="h-16 w-auto object-contain mb-8" />

      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-zinc-100 p-7">
        <h1 className="text-xl font-bold text-zinc-900 mb-0.5">Create account</h1>
        <p className="text-zinc-400 text-sm mb-6">Join 50% Store today</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1.5">Full name</label>
            <input
              name="full_name" value={form.full_name} onChange={handleChange}
              className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              placeholder="Rahul Sharma" required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1.5">Email</label>
            <input
              name="email" type="email" value={form.email} onChange={handleChange}
              className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              placeholder="you@example.com" required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1.5">Password</label>
            <input
              name="password" type="password" value={form.password} onChange={handleChange}
              className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              placeholder="min 8 characters" required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1.5">City</label>
              <input
                name="city" value={form.city} onChange={handleChange}
                className="w-full border border-zinc-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="Bhopal"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1.5">Locality</label>
              <input
                name="locality" value={form.locality} onChange={handleChange}
                className="w-full border border-zinc-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="MP Nagar"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-2">I want to</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "buyer",  label: "Buy" },
                { value: "seller", label: "Sell" },
                { value: "both",   label: "Both" },
              ].map((r) => (
                <button
                  key={r.value} type="button"
                  onClick={() => setForm({ ...form, role: r.value })}
                  className={`py-2.5 rounded-xl text-sm font-medium border transition ${
                    form.role === r.value
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-200"
                      : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition shadow-sm shadow-blue-200 mt-2"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-zinc-400 mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-blue-600 font-semibold hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
