import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FloatingWhatsApp from "@/components/FloatingWhatsApp";
import ScrollToTop from "@/components/ScrollToTop";
import ErrorBoundary from "@/components/ErrorBoundary";
import ProtectedRoute from "./components/ProtectedRoute";
import { Loader2 } from "lucide-react";
import Index from "./pages/Index"; // home stays eager for instant first paint
import { useUTMTracking } from "@/hooks/useUTMTracking";
import { usePixelPageView } from "@/hooks/usePixelPageView";

// Every other route is lazy-loaded so the initial public bundle stays small —
// admin/finance/PDF/signature/chart code only downloads when that page opens.
const Inventory = lazy(() => import("./pages/Inventory"));
const VehicleDetail = lazy(() => import("./pages/VehicleDetail"));
const SellYourCar = lazy(() => import("./pages/SellYourCar"));
const Wishlist = lazy(() => import("./pages/Wishlist"));
const Compare = lazy(() => import("./pages/Compare"));
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const Calculator = lazy(() => import("./pages/Calculator"));
const FinanceApplication = lazy(() => import("./pages/FinanceApplication"));
const Sourcing = lazy(() => import("./pages/Sourcing"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const Refer = lazy(() => import("./pages/Refer"));
const UpdatePassword = lazy(() => import("./pages/UpdatePassword"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SecureDocumentUpload = lazy(() => import("./pages/public/SecureDocumentUpload"));
const ClientHandover = lazy(() => import("./pages/ClientHandover"));
const JuristicCapture = lazy(() => import("./pages/public/JuristicCapture"));

const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminInventoryPage = lazy(() => import("./pages/admin/AdminInventoryPage"));
const AdminFinance = lazy(() => import("./pages/admin/AdminFinance"));
const AdminDealRoom = lazy(() => import("./pages/admin/AdminDealRoom"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminSettingPage = lazy(() => import("./pages/admin/AdminSettingPage"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminAftersales = lazy(() => import("./pages/admin/AdminAftersales"));
const AdminCreateApplication = lazy(() => import("./pages/admin/AdminCreateApplication"));
const AdminQuoteGenerator = lazy(() => import("./pages/admin/AdminQuoteGenerator"));
const AdminOTP = lazy(() => import("./pages/admin/AdminOTP"));
const AdminReports = lazy(() => import("./pages/admin/AdminReports"));
const AdminLeadAnalytics = lazy(() => import("./pages/admin/AdminLeadAnalytics"));
const AdminExtraIncomes = lazy(() => import("./pages/admin/AdminExtraIncomes"));
const AdminCarsToBuy = lazy(() => import("./pages/admin/AdminCarsToBuy"));
const AdminPartnerPayout = lazy(() => import("./pages/admin/AdminPartnerPayout"));
const AdminNetwork = lazy(() => import("./pages/admin/AdminNetwork"));
const AdminContacts = lazy(() => import("./pages/admin/AdminContacts"));
const AdminReferrals = lazy(() => import("./pages/admin/AdminReferrals"));
// AdminCRM retired from routing (CRM nav removed; legacy URLs redirect to Pipeline).
// Component file kept in the codebase to avoid collateral breakage.
const ClientProfile = lazy(() => import("./pages/admin/ClientProfile"));
const AdminDocumentsHub = lazy(() => import("./pages/admin/AdminDocumentsHub"));
const AdminJuristic = lazy(() => import("./pages/admin/AdminJuristic"));
const AdminVendors = lazy(() => import("./pages/admin/AdminVendors"));
const AdminInvoiceCreator = lazy(() => import("./pages/admin/AdminInvoiceCreator"));
const AdminExport = lazy(() => import("./pages/admin/AdminExport"));
const AdminPipelineV2 = lazy(() => import("./pages/admin/AdminPipelineV2"));
const AdminDealDesk = lazy(() => import("./pages/admin/AdminDealDesk"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

const RouteFallback = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
  </div>
);

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
        <Suspense fallback={<RouteFallback />}>
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
            <Route path="/admin/inventory" element={<ProtectedRoute section="inventory"><AdminInventoryPage /></ProtectedRoute>} />
            {/* Pipeline + CRM Sheet replaced by the unified CRM. Old paths still
                resolve (login landing + existing links) and render the new CRM. */}
            {/* CRM retired from nav — the Pipeline manages client flow. Legacy CRM
                URLs redirect to the Pipeline (AdminCRM kept unrouted-as-component). */}
            <Route path="/admin/leads" element={<Navigate to="/admin/pipeline-v2" replace />} />
            <Route path="/admin/contacts" element={<ProtectedRoute requireSuperAdmin><AdminContacts /></ProtectedRoute>} />
            <Route path="/admin/finance" element={<ProtectedRoute section="finance"><AdminFinance /></ProtectedRoute>} />
            <Route path="/admin/finance/create" element={<ProtectedRoute section="finance"><AdminCreateApplication /></ProtectedRoute>} />
            <Route path="/admin/finance/:id" element={<ProtectedRoute section="finance"><AdminDealRoom /></ProtectedRoute>} />
            <Route path="/admin/pipeline-v2" element={<ProtectedRoute section="pipeline_v2"><AdminPipelineV2 /></ProtectedRoute>} />
            <Route path="/admin/quotes" element={<ProtectedRoute section="quotes"><AdminQuoteGenerator /></ProtectedRoute>} />
            <Route path="/admin/otp" element={<ProtectedRoute section="finance"><AdminOTP /></ProtectedRoute>} />
            {/* Deal Ledger folded into Deal Desk — redirect old URL. Gated for
                either legacy deal_ledger holders or deal_desk holders so neither
                gets bounced before the redirect to /admin/deal-desk fires. */}
            <Route path="/admin/aftersales" element={<ProtectedRoute sections={["deal_ledger", "deal_desk"]}><AdminAftersales /></ProtectedRoute>} />
            <Route path="/admin/reports" element={<ProtectedRoute section="reports"><AdminReports /></ProtectedRoute>} />
            <Route path="/admin/vendors" element={<ProtectedRoute section="vendors"><AdminVendors /></ProtectedRoute>} />
            <Route path="/admin/invoices" element={<ProtectedRoute section="invoices"><AdminInvoiceCreator /></ProtectedRoute>} />
            <Route path="/admin/reports/lead-analytics" element={<ProtectedRoute section="reports"><AdminLeadAnalytics /></ProtectedRoute>} />
            <Route path="/admin/extra-incomes" element={<ProtectedRoute section="extra_incomes"><AdminExtraIncomes /></ProtectedRoute>} />
            <Route path="/admin/cars-to-buy" element={<ProtectedRoute section="cars_to_buy"><AdminCarsToBuy /></ProtectedRoute>} />
            <Route path="/admin/analytics" element={<ProtectedRoute section="analytics"><AdminAnalytics /></ProtectedRoute>} />
            <Route path="/admin/export" element={<ProtectedRoute section="export"><AdminExport /></ProtectedRoute>} />
            {/* Deal Desk is now the single home for the old Deal Ledger too, so
                legacy deal_ledger holders retain access to the merged view. */}
            <Route path="/admin/deal-desk" element={<ProtectedRoute sections={["deal_desk", "deal_ledger"]}><AdminDealDesk /></ProtectedRoute>} />
            <Route path="/admin/settings" element={<ProtectedRoute requireSuperAdmin><AdminSettings /></ProtectedRoute>} />
            {/* Each setting renders on its own page at /admin/settings/<key>
                (incl. /admin/settings/email — Email Templates). Same super-admin
                gate as the index; the page also re-checks per-setting gating. */}
            <Route path="/admin/settings/:key" element={<ProtectedRoute requireSuperAdmin><AdminSettingPage /></ProtectedRoute>} />
            <Route path="/admin/reports/partner-payout/:dealId" element={<ProtectedRoute section="reports"><AdminPartnerPayout /></ProtectedRoute>} />
            <Route path="/admin/network" element={<ProtectedRoute section="network"><AdminNetwork /></ProtectedRoute>} />
            <Route path="/admin/referrals" element={<ProtectedRoute section="referrals"><AdminReferrals /></ProtectedRoute>} />
            <Route path="/admin/juristic" element={<ProtectedRoute section="juristic"><AdminJuristic /></ProtectedRoute>} />
            <Route path="/admin/clients/:id" element={<ProtectedRoute requireSuperAdmin><ClientProfile /></ProtectedRoute>} />
            <Route path="/admin/documents" element={<ProtectedRoute section="documents"><AdminDocumentsHub /></ProtectedRoute>} />
            <Route path="/admin/crm-sheet" element={<Navigate to="/admin/pipeline-v2" replace />} />
            <Route path="/admin/crm" element={<Navigate to="/admin/pipeline-v2" replace />} />
            <Route path="/update-password" element={<UpdatePassword />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      {!isAdminRoute && !isPublicRoute && <Footer />}
      {!isAdminRoute && !isPublicRoute && <FloatingWhatsApp />}
    </>
  );
};

const App = () => (
  <ErrorBoundary>
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
  </ErrorBoundary>
);

export default App;
