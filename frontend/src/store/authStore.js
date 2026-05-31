import { create } from "zustand";
import { authApi } from "../api/auth";

export const useAuthStore = create((set) => ({
  user: null,
  loading: false,

  login: async (email, password) => {
    set({ loading: true });
    const res = await authApi.login({ email, password });
    localStorage.setItem("access_token", res.data.access_token);
    localStorage.setItem("refresh_token", res.data.refresh_token);
    const me = await authApi.me();
    set({ user: me.data, loading: false });
    return me.data;
  },

  register: async (data) => {
    set({ loading: true });
    await authApi.register(data);
    const res = await authApi.login({ email: data.email, password: data.password });
    localStorage.setItem("access_token", res.data.access_token);
    localStorage.setItem("refresh_token", res.data.refresh_token);
    const me = await authApi.me();
    set({ user: me.data, loading: false });
    return me.data;
  },

  fetchMe: async () => {
    try {
      const res = await authApi.me();
      set({ user: res.data });
    } catch {
      set({ user: null });
    }
  },

  logout: () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    set({ user: null });
    window.location.href = "/login";
  },

  setUser: (user) => set({ user }),
}));
