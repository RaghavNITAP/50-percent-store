import api from "./client";

export const reviewsApi = {
  submit: (data) => api.post("/reviews", data),
  getOrderReview: (orderId) => api.get(`/reviews/order/${orderId}`),
  getUserReviews: (userId) => api.get(`/reviews/user/${userId}`),
  getMyReviews: () => api.get("/reviews/me"),
};