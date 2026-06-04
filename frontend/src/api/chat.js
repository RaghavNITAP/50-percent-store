import api from "./client";

export const chatApi = {
  startConversation: (data) => api.post("/chat/conversations", data),
  getConversations: () => api.get("/chat/conversations"),
  getMessages: (conversationId, params) =>
    api.get(`/chat/conversations/${conversationId}/messages`, { params }),
  getUnreadCount: () => api.get("/chat/unread-count"),
};