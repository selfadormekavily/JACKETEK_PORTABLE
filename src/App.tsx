import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import ScrollToTop from "@/components/ScrollToTop";
import ThreadDyes from "@/components/ThreadDyes";
import AuthProvider from "@/features/auth/AuthProvider";
import I18nProvider from "@/i18n/I18nProvider";
import CartProvider from "@/features/cart/CartProvider";
import { ROUTES } from "@/lib/routes";
import LandingPage from "@/pages/LandingPage";
import NotFoundPage from "@/pages/NotFoundPage";

// Split the configurator into its own chunk; it will carry Three.js later.
const DesignPage = lazy(() => import("@/pages/DesignPage"));
const CartPage = lazy(() => import("@/pages/CartPage"));
const AuthPage = lazy(() => import("@/pages/AuthPage"));
const CheckoutPage = lazy(() => import("@/pages/CheckoutPage"));
const OrderConfirmedPage = lazy(() => import("@/pages/OrderConfirmedPage"));
const MyGroupsPage = lazy(() => import("@/pages/MyGroupsPage"));
const GroupPage = lazy(() => import("@/pages/GroupPage"));
const GroupJoinPage = lazy(() => import("@/pages/GroupJoinPage"));
const AdminOrdersPage = lazy(() => import("@/pages/AdminOrdersPage"));
const AdminOrderPage = lazy(() => import("@/pages/AdminOrderPage"));

export default function App() {
  return (
    <I18nProvider>
    <BrowserRouter>
      <AuthProvider>
      <CartProvider>
        <ScrollToTop />
        <ThreadDyes />
        <Suspense fallback={<div className="min-h-screen bg-jk-canvas" />}>
          <Routes>
            <Route path={ROUTES.home} element={<LandingPage />} />
            <Route path={ROUTES.design} element={<DesignPage />} />
            <Route path={ROUTES.cart} element={<CartPage />} />
            <Route path={ROUTES.auth} element={<AuthPage />} />
            <Route path={ROUTES.checkout} element={<CheckoutPage />} />
            <Route path={`${ROUTES.order}/:orderId`} element={<OrderConfirmedPage />} />
            <Route path={ROUTES.groups} element={<MyGroupsPage />} />
            <Route path={`${ROUTES.groups}/:groupId`} element={<GroupPage />} />
            <Route path={`${ROUTES.join}/:token`} element={<GroupJoinPage />} />
            <Route path={ROUTES.admin} element={<Navigate to={ROUTES.adminOrders} replace />} />
            <Route path={ROUTES.adminOrders} element={<AdminOrdersPage />} />
            <Route path={`${ROUTES.adminOrders}/:orderId`} element={<AdminOrderPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </CartProvider>
      </AuthProvider>
    </BrowserRouter>
    </I18nProvider>
  );
}
