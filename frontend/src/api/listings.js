import api from "./client";

export const listingsApi = {
  create: (formData) =>
    api.post("/listings", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  get: (id) => api.get(`/listings/${id}`),
  list: (params) => api.get("/listings", { params }),
  update: (id, data) => api.patch(`/listings/${id}`, data),
  delete: (id) => api.delete(`/listings/${id}`),
  myListings: (params) => api.get("/listings/me/listings", { params }),
  addImages: (id, formData) =>
    api.post(`/listings/${id}/images`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  aiPolish: (formData) =>
    api.post("/listings/ai-polish", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

export const categoriesApi = {
  getAll: () => api.get("/listings/categories"),
};

export const feedApi = {
  getFeed: (params) => api.get("/feed", { params }),
  getMyFeed: (params) => api.get("/feed/my", { params }),
};

export const searchApi = {
  search: (params) => api.get("/search", { params }),
};