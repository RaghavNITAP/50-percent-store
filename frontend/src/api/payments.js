import api from "./client";

export const paymentsApi = {
  createOrder: (data) => api.post("/payments/orders", data),
  completeOrder: (orderId) => api.post(`/payments/orders/${orderId}/complete`),
  refundOrder: (orderId, data) => api.post(`/payments/orders/${orderId}/refund`, data),
  myOrders: () => api.get("/payments/orders/my"),
  getOrder: (orderId) => api.get(`/payments/orders/${orderId}`),
  markPaid: (orderId) => api.post(`/payments/orders/${orderId}/mark-paid`),
};