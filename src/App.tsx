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
import AdminFinance from "./pages/admin/AdminFinance";
import AdminDealRoom from "./pages/admin/AdminDealRoom";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminAftersales from "./pages/admin/AdminAftersales";
import AdminCreateApplication from "./pages/admin/AdminCreateApplication";
import AdminQuoteGenerator from "./pages/admin/AdminQuoteGenerator";
import AdminReports from "./pages/admin/AdminReports";
import AdminLeadAnalytics from "./pages/admin/AdminLeadAnalytics";
import AdminExtraIncomes from "./pages/admin/AdminExtraIncomes";
import AdminCarsToBuy from "./pages/admin/AdminCarsToBuy";
import AdminPartnerPayout from "./pages/admin/AdminPartnerPayout";
import AdminNetwork from "./pages/admin/AdminNetwork";
import AdminContacts from "./pages/admin/AdminContacts";
import AdminReferrals from "./pages/admin/AdminReferrals";
import AdminEmailSettings from "./pages/admin/AdminEmailSettings";
import AdminCRM from "./pages/admin/AdminCRM";
import ClientProfile from "./pages/admin/ClientProfile";
import AdminDocumentsHub from "./pages/admin/AdminDocumentsHub";
import UpdatePassword from "./pages/UpdatePassword";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import ClientHandover from "./pages/ClientHandover";
import TermsOfService from "./pages/TermsOfService";
import SystemFix from "./pages/admin/SystemFix";
import AdminJuristic from "./pages/admin/AdminJuristic";
import Refer from "./pages/Refer";

import ProtectedRoute from "./components/ProtectedRoute";
import NotFound from "./pages/NotFound";
import SecureDocumentUpload from "./pages/public/SecureDocumentUpload";
import JuristicCapture from "./pages/public/JuristicCapture";
import { useUTMTracking } from "@/hooks/useUTMTracking";
import { usePixelPageView } from "@/hooks/usePixelPageView";

const queryClient = new QueryClient();

// Layout wrapper to hide navbar/footer on admin and public routes
const AppLayout = () => {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isPublicRoute = location.pathname.startsWith('/upload-documents') || location.pathname.startsWith('/handover') || location.pathname.startsWith('/juristic');

  // Global UTM capture — runs on every route change, persists to sessionStorage
  useUTMTracking();

  // Isolated ad-pixel PageView (Meta + TikTok). Never touches the database.
  usePixelPageView();

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
          <Route path="/refer" element={<Refer />} />
          
          {/* Public Routes */}
          <Route path="/upload-documents/:token" element={<SecureDocumentUpload />} />
          <Route path="/handover/:dealId" element={<ClientHandover />} />
          <Route path="/juristic/:token" element={<JuristicCapture />} />
          {/* Admin Routes */}
          <Route path="/admin" element={<ProtectedRoute requireSuperAdmin><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/inventory" element={<ProtectedRoute requireAdmin><AdminInventoryPage /></ProtectedRoute>} />
          {/* Pipeline + CRM Sheet replaced by the unified CRM. Old paths still
              resolve (login landing + existing links) and render the new CRM. */}
          <Route path="/admin/leads" element={<ProtectedRoute requireAdmin><AdminCRM /></ProtectedRoute>} />
          <Route path="/admin/contacts" element={<ProtectedRoute requireSuperAdmin><AdminContacts /></ProtectedRoute>} />
          <Route path="/admin/finance" element={<ProtectedRoute requireAdmin><AdminFinance /></ProtectedRoute>} />
          <Route path="/admin/finance/create" element={<ProtectedRoute requireAdmin><AdminCreateApplication /></ProtectedRoute>} />
          <Route path="/admin/finance/:id" element={<ProtectedRoute requireSuperAdmin allowFAndI><AdminDealRoom /></ProtectedRoute>} />
          <Route path="/admin/quotes" element={<ProtectedRoute requireAdmin><AdminQuoteGenerator /></ProtectedRoute>} />
          <Route path="/admin/aftersales" element={<ProtectedRoute requireSuperAdmin><AdminAftersales /></ProtectedRoute>} />
          <Route path="/admin/reports" element={<ProtectedRoute requireSuperAdmin allowAccountant><AdminReports /></ProtectedRoute>} />
          <Route path="/admin/reports/lead-analytics" element={<ProtectedRoute requireSuperAdmin><AdminLeadAnalytics /></ProtectedRoute>} />
          <Route path="/admin/extra-incomes" element={<ProtectedRoute requireSuperAdmin><AdminExtraIncomes /></ProtectedRoute>} />
          <Route path="/admin/cars-to-buy" element={<ProtectedRoute requireSuperAdmin><AdminCarsToBuy /></ProtectedRoute>} />
          <Route path="/admin/analytics" element={<ProtectedRoute requireSuperAdmin><AdminAnalytics /></ProtectedRoute>} />
           <Route path="/admin/settings" element={<ProtectedRoute requireSuperAdmin><AdminSettings /></ProtectedRoute>} />
           <Route path="/admin/settings/email" element={<ProtectedRoute requireSuperAdmin><AdminEmailSettings /></ProtectedRoute>} />
          <Route path="/admin/reports/partner-payout/:dealId" element={<ProtectedRoute requireSuperAdmin><AdminPartnerPayout /></ProtectedRoute>} />
          <Route path="/admin/network" element={<ProtectedRoute requireSuperAdmin><AdminNetwork /></ProtectedRoute>} />
          <Route path="/admin/referrals" element={<ProtectedRoute requireSuperAdmin><AdminReferrals /></ProtectedRoute>} />
          <Route path="/admin/juristic" element={<ProtectedRoute requireSuperAdmin><AdminJuristic /></ProtectedRoute>} />
          <Route path="/admin/clients/:id" element={<ProtectedRoute requireSuperAdmin><ClientProfile /></ProtectedRoute>} />
          <Route path="/admin/documents" element={<ProtectedRoute requireSuperAdmin><AdminDocumentsHub /></ProtectedRoute>} />
          <Route path="/admin/crm-sheet" element={<ProtectedRoute requireAdmin blockStandardFAndI><AdminCRM /></ProtectedRoute>} />
          <Route path="/admin/crm" element={<ProtectedRoute requireAdmin><AdminCRM /></ProtectedRoute>} />
          <Route path="/update-password" element={<UpdatePassword />} />
          <Route path="/system-fix" element={<ProtectedRoute requireSuperAdmin><SystemFix /></ProtectedRoute>} />
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
