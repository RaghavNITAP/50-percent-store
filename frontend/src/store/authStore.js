import { create } from "zustand";
import { authApi } from "../api/auth";

export const useAuthStore = create((set) => ({
  user: null,
  loading: false,

  login: async (email, password) => {
    set({ loading: true });
    try {
      const res = await authApi.login({ email, password });
      localStorage.setItem("access_token", res.data.access_token);
      localStorage.setItem("refresh_token", res.data.refresh_token);
      const me = await authApi.me();
      set({ user: me.data, loading: false });
      return me.data;
    } finally {
      set((s) => s.loading ? { loading: false } : {});
    }
  },

  register: async (data) => {
    set({ loading: true });
    try {
      await authApi.register(data);
      const res = await authApi.login({ email: data.email, password: data.password });
      localStorage.setItem("access_token", res.data.access_token);
      localStorage.setItem("refresh_token", res.data.refresh_token);
      const me = await authApi.me();
      set({ user: me.data, loading: false });
      return me.data;
    } finally {
      set((s) => s.loading ? { loading: false } : {});
    }
  },

  loginWithGoogle: async (googleToken) => {
    set({ loading: true });
    try {
      const res = await authApi.googleLogin(googleToken);
      localStorage.setItem("access_token", res.data.access_token);
      localStorage.setItem("refresh_token", res.data.refresh_token);
      const me = await authApi.me();
      set({ user: me.data, loading: false });
      return me.data;
    } finally {
      set((s) => s.loading ? { loading: false } : {});
    }
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
