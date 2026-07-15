import api from "./client";

export const requestsApi = {
  create: (data) => api.post("/requests", data),
  getFeed: (params) => api.get("/requests/feed", { params }),
  getMyRequests: (params) => api.get("/requests/me", { params }),
  getById: (id) => api.get(`/requests/${id}`),
  update: (id, data) => api.patch(`/requests/${id}`, data),
  fulfill: (id) => api.post(`/requests/${id}/fulfill`),
  renew: (id) => api.post(`/requests/${id}/renew`),
  close: (id) => api.delete(`/requests/${id}`),
};
