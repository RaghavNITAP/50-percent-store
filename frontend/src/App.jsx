import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useAuthStore } from "./store/authStore";
import BottomNav from "./components/BottomNav";
import InstallBanner from "./components/InstallBanner";

import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import FeedPage from "./pages/FeedPage";
import ListingDetailPage from "./pages/ListingDetailPage";
import CreateListingPage from "./pages/CreateListingPage";
import ChatListPage from "./pages/ChatListPage";
import ChatPage from "./pages/ChatPage";
import CheckoutPage from "./pages/Checkoutpage";
import OrderPage from "./pages/Orderpage";
import ReviewPage from "./pages/ReviewPage";
import ProfilePage from "./pages/ProfilePage";
import EditListingPage from "./pages/EditListingPage";

function PrivateRoute({ children }) {
  const token = localStorage.getItem("access_token");
  return token ? children : <Navigate to="/login" />;
}

export default function App() {
  const fetchMe = useAuthStore((s) => s.fetchMe);

  useEffect(() => {
    if (localStorage.getItem("access_token")) {
      fetchMe();
    }
  }, []);

  return (
    <BrowserRouter>
      <Toaster
        position="top-center"
        toastOptions={{
          style: { fontSize: "14px", borderRadius: "12px", fontFamily: "Inter, sans-serif" },
        }}
      />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={<PrivateRoute><FeedPage /></PrivateRoute>} />
        <Route path="/listing/:id" element={<PrivateRoute><ListingDetailPage /></PrivateRoute>} />
        <Route path="/sell" element={<PrivateRoute><CreateListingPage /></PrivateRoute>} />
        <Route path="/chat" element={<PrivateRoute><ChatListPage /></PrivateRoute>} />
        <Route path="/chat/:id" element={<PrivateRoute><ChatPage /></PrivateRoute>} />
        <Route path="/checkout/:id" element={<PrivateRoute><CheckoutPage /></PrivateRoute>} />
        <Route path="/order/:id" element={<PrivateRoute><OrderPage /></PrivateRoute>} />
        <Route path="/review/:orderId" element={<PrivateRoute><ReviewPage /></PrivateRoute>} />
        <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
        <Route path="/listing/:id/edit" element={<PrivateRoute><EditListingPage /></PrivateRoute>} />
      </Routes>
      <BottomNav />
      <InstallBanner />
    </BrowserRouter>
  );
}
