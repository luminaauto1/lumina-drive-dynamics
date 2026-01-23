import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FloatingWhatsApp from "@/components/FloatingWhatsApp";
import ScrollToTop from "@/components/ScrollToTop";
import Index from "./pages/Index";
import Inventory from "./pages/Inventory";
import VehicleDetail from "./pages/VehicleDetail";
import SellYourCar from "./pages/SellYourCar";
import Wishlist from "./pages/Wishlist";
import Compare from "./pages/Compare";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Calculator from "./pages/Calculator";
import FinanceApplication from "./pages/FinanceApplication";
import Sourcing from "./pages/Sourcing";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminInventoryPage from "./pages/admin/AdminInventoryPage";
import AdminLeads from "./pages/admin/AdminLeads";
import AdminFinance from "./pages/admin/AdminFinance";
import AdminDealRoom from "./pages/admin/AdminDealRoom";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminAftersales from "./pages/admin/AdminAftersales";
import AdminCreateApplication from "./pages/admin/AdminCreateApplication";
import UpdatePassword from "./pages/UpdatePassword";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import SystemFix from "./pages/SystemFix";
import ProtectedRoute from "./components/ProtectedRoute";
import NotFound from "./pages/NotFound";
import SecureDocumentUpload from "./pages/public/SecureDocumentUpload";

const queryClient = new QueryClient();

// Layout wrapper to hide navbar/footer on admin and public routes
const AppLayout = () => {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isPublicRoute = location.pathname.startsWith('/upload-documents');

  return (
    <>
      <ScrollToTop />
      {!isAdminRoute && !isPublicRoute && <Navbar />}
      <main>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/vehicle/:id" element={<VehicleDetail />} />
          <Route path="/sell-your-car" element={<SellYourCar />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/calculator" element={<Calculator />} />
          <Route path="/finance-application" element={<FinanceApplication />} />
          <Route path="/sourcing" element={<Sourcing />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/system-fix" element={<SystemFix />} />
          {/* Public Document Upload Route */}
          <Route path="/upload-documents/:token" element={<SecureDocumentUpload />} />
          {/* Admin Routes */}
          <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/inventory" element={<ProtectedRoute requireAdmin><AdminInventoryPage /></ProtectedRoute>} />
          <Route path="/admin/leads" element={<ProtectedRoute requireAdmin><AdminLeads /></ProtectedRoute>} />
          <Route path="/admin/finance" element={<ProtectedRoute requireAdmin><AdminFinance /></ProtectedRoute>} />
          <Route path="/admin/finance/create" element={<ProtectedRoute requireAdmin><AdminCreateApplication /></ProtectedRoute>} />
          <Route path="/admin/finance/:id" element={<ProtectedRoute requireAdmin><AdminDealRoom /></ProtectedRoute>} />
          <Route path="/admin/aftersales" element={<ProtectedRoute requireAdmin><AdminAftersales /></ProtectedRoute>} />
          <Route path="/admin/analytics" element={<ProtectedRoute requireAdmin><AdminAnalytics /></ProtectedRoute>} />
          <Route path="/admin/settings" element={<ProtectedRoute requireAdmin><AdminSettings /></ProtectedRoute>} />
          <Route path="/update-password" element={<UpdatePassword />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      {!isAdminRoute && !isPublicRoute && <Footer />}
      {!isAdminRoute && !isPublicRoute && <FloatingWhatsApp />}
    </>
  );
};

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppLayout />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
