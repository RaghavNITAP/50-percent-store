import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
});
// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto logout on 401 — but ONLY when a session was active (token existed).
// A 401 from the /auth/login endpoint itself means wrong credentials;
// that must be handled by the component, not redirect here.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      const hadToken = !!localStorage.getItem("access_token");
      if (hadToken) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.location.href = "/login";
      }
      // No token → credential failure → let the calling component handle it
    }
    return Promise.reject(error);
  }
);


export default api;
