import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';

// Route Guards (Stateless, Isolated)
import CustomerRoute from './components/CustomerRoute';
import WorkerRoute from './components/WorkerRoute';
import AdminRoute from './components/AdminRoute';

// Layout Components (Dedicated per Portal)
import CustomerLayout from './components/CustomerLayout';
import WorkerLayout from './components/WorkerLayout';
import AdminLayout from './components/AdminLayout';

// Public Landing Page (Role Chooser)
const LandingPage = lazy(() => import('./pages/LandingPage'));

// Customer Portal Pages
const CustomerLogin = lazy(() => import('./pages/CustomerLogin'));
const Signup = lazy(() => import('./pages/Signup'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const CustomerDashboard = lazy(() => import('./pages/CustomerDashboard'));
const ServiceBrowse = lazy(() => import('./pages/ServiceBrowse'));
const Browse = lazy(() => import('./pages/Browse')); // Restored Old Browse Experts UI
const BookingForm = lazy(() => import('./pages/BookingForm'));
const Booking = lazy(() => import('./pages/Booking'));
const BookingStatus = lazy(() => import('./pages/BookingStatus'));
const PaymentPage = lazy(() => import('./pages/PaymentPage'));
const MyBookings = lazy(() => import('./pages/MyBookings'));
const WalletPage = lazy(() => import('./pages/WalletPage'));
const CustomerPaymentHistory = lazy(() => import('./pages/CustomerPaymentHistory'));
const ProfileSettings = lazy(() => import('./pages/ProfileSettings'));

// Worker (Service Provider) Portal Pages
const WorkerLogin = lazy(() => import('./pages/WorkerLogin'));
const WorkerSignup = lazy(() => import('./pages/WorkerSignup'));
const WorkerPending = lazy(() => import('./pages/WorkerPending'));
const WorkerRejected = lazy(() => import('./pages/WorkerRejected'));
const WorkerForgotPassword = lazy(() => import('./pages/WorkerForgotPassword'));
const HandymanDashboard = lazy(() => import('./pages/HandymanDashboard'));

// Admin Portal Pages
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const AdminAnalytics = lazy(() => import('./pages/AdminAnalytics'));

// Public Information Pages
const About = lazy(() => import('./pages/About'));
const Contact = lazy(() => import('./pages/Contact'));
const HowItWorks = lazy(() => import('./pages/HowItWorks'));
const Careers = lazy(() => import('./pages/Careers'));
const HelpCenter = lazy(() => import('./pages/HelpCenter'));
const Terms = lazy(() => import('./pages/Terms'));
const Privacy = lazy(() => import('./pages/Privacy'));
const SEOLandingPage = lazy(() => import('./pages/SEOLandingPage'));

// Global Modals / Floating Widgets & User Comfort Suite
import SmartFixAiWidget from './components/SmartFixAiWidget';
import WebRtcCallModal from './components/WebRtcCallModal';
import CommandPalette from './components/CommandPalette';
import SavedWorkersModal from './components/SavedWorkersModal';
import OfflineAlert from './components/OfflineAlert';
import ComfortQuickDock from './components/ComfortQuickDock';

const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
    <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
      <span className="visually-hidden">Loading...</span>
    </div>
  </div>
);

function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* ============================================================ */}
          {/* 1. PUBLIC LANDING: Role Chooser ("/" never auto-redirects)   */}
          {/* ============================================================ */}
          <Route path="/" element={<LandingPage />} />

          {/* ============================================================ */}
          {/* 2. CUSTOMER PORTAL NAMESPACE (/customer/*)                   */}
          {/* ============================================================ */}
          <Route path="/customer/login" element={<CustomerLogin />} />
          <Route path="/customer/register" element={<Signup />} />
          <Route path="/customer/forgot-password" element={<ForgotPassword />} />

          <Route
            path="/customer/home"
            element={
              <CustomerRoute>
                <CustomerLayout>
                  <CustomerDashboard />
                </CustomerLayout>
              </CustomerRoute>
            }
          />
          <Route
            path="/customer/dashboard"
            element={<Navigate to="/customer/home" replace />}
          />
          <Route
            path="/customer/services"
            element={
              <CustomerLayout>
                <ServiceBrowse />
              </CustomerLayout>
            }
          />
          <Route
            path="/customer/experts"
            element={
              <CustomerLayout>
                <Browse />
              </CustomerLayout>
            }
          />
          <Route
            path="/customer/bookings"
            element={
              <CustomerRoute>
                <CustomerLayout>
                  <MyBookings />
                </CustomerLayout>
              </CustomerRoute>
            }
          />
          <Route
            path="/customer/booking/:bookingId"
            element={
              <CustomerRoute>
                <CustomerLayout>
                  <BookingStatus />
                </CustomerLayout>
              </CustomerRoute>
            }
          />
          <Route
            path="/customer/booking/:bookingId/status"
            element={
              <CustomerRoute>
                <CustomerLayout>
                  <BookingStatus />
                </CustomerLayout>
              </CustomerRoute>
            }
          />
          <Route
            path="/customer/book"
            element={
              <CustomerRoute>
                <CustomerLayout>
                  <BookingForm />
                </CustomerLayout>
              </CustomerRoute>
            }
          />
          <Route
            path="/customer/book/:workerId"
            element={
              <CustomerRoute>
                <CustomerLayout>
                  <Booking />
                </CustomerLayout>
              </CustomerRoute>
            }
          />
          <Route
            path="/customer/payment/:bookingId"
            element={
              <CustomerRoute>
                <CustomerLayout>
                  <PaymentPage />
                </CustomerLayout>
              </CustomerRoute>
            }
          />
          <Route
            path="/customer/wallet"
            element={
              <CustomerRoute>
                <CustomerLayout>
                  <WalletPage />
                </CustomerLayout>
              </CustomerRoute>
            }
          />
          <Route
            path="/customer/payments"
            element={
              <CustomerRoute>
                <CustomerLayout>
                  <CustomerPaymentHistory />
                </CustomerLayout>
              </CustomerRoute>
            }
          />
          <Route
            path="/customer/profile"
            element={
              <CustomerRoute>
                <CustomerLayout>
                  <ProfileSettings />
                </CustomerLayout>
              </CustomerRoute>
            }
          />

          {/* ============================================================ */}
          {/* 3. WORKER / SERVICE PROVIDER NAMESPACE (/worker/*)          */}
          {/* ============================================================ */}
          <Route path="/worker/login" element={<WorkerLogin />} />
          <Route path="/worker/register" element={<WorkerSignup />} />
          <Route path="/worker/signup" element={<WorkerSignup />} />
          <Route path="/worker/pending" element={<WorkerPending />} />
          <Route path="/worker/rejected" element={<WorkerRejected />} />
          <Route path="/worker/forgot-password" element={<WorkerForgotPassword />} />

          <Route
            path="/worker/dashboard"
            element={
              <WorkerRoute>
                <WorkerLayout>
                  <HandymanDashboard initialTab="active" />
                </WorkerLayout>
              </WorkerRoute>
            }
          />
          <Route
            path="/worker/requests"
            element={
              <WorkerRoute>
                <WorkerLayout>
                  <HandymanDashboard initialTab="incoming" />
                </WorkerLayout>
              </WorkerRoute>
            }
          />
          <Route
            path="/worker/jobs"
            element={
              <WorkerRoute>
                <WorkerLayout>
                  <HandymanDashboard initialTab="completed" />
                </WorkerLayout>
              </WorkerRoute>
            }
          />
          <Route
            path="/worker/job/:id"
            element={
              <WorkerRoute>
                <WorkerLayout>
                  <HandymanDashboard />
                </WorkerLayout>
              </WorkerRoute>
            }
          />
          <Route
            path="/worker/earnings"
            element={
              <WorkerRoute>
                <WorkerLayout>
                  <HandymanDashboard initialTab="earnings" />
                </WorkerLayout>
              </WorkerRoute>
            }
          />
          <Route
            path="/worker/profile"
            element={
              <WorkerRoute>
                <WorkerLayout>
                  <ProfileSettings />
                </WorkerLayout>
              </WorkerRoute>
            }
          />

          {/* ============================================================ */}
          {/* 4. ADMIN PORTAL NAMESPACE (/admin/*)                         */}
          {/* ============================================================ */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminLayout>
                  <AdminPanel initialTab="workers" />
                </AdminLayout>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/dashboard"
            element={
              <AdminRoute>
                <AdminLayout>
                  <AdminPanel initialTab="workers" />
                </AdminLayout>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/kyc"
            element={
              <AdminRoute>
                <AdminLayout>
                  <AdminPanel initialTab="pending_kyc" />
                </AdminLayout>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/bookings"
            element={
              <AdminRoute>
                <AdminLayout>
                  <AdminPanel initialTab="bookings" />
                </AdminLayout>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <AdminRoute>
                <AdminLayout>
                  <AdminPanel initialTab="commission" />
                </AdminLayout>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/wallet"
            element={
              <AdminRoute>
                <AdminLayout>
                  <AdminPanel initialTab="wallet" />
                </AdminLayout>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/payments"
            element={
              <AdminRoute>
                <AdminLayout>
                  <AdminPanel initialTab="payments" />
                </AdminLayout>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/analytics"
            element={
              <AdminRoute>
                <AdminLayout>
                  <AdminAnalytics />
                </AdminLayout>
              </AdminRoute>
            }
          />

          {/* ============================================================ */}
          {/* 5. LEGACY / SHORTCUT REDIRECTS                               */}
          {/* ============================================================ */}
          <Route path="/login" element={<Navigate to="/customer/login" replace />} />
          <Route path="/signup" element={<Navigate to="/customer/register" replace />} />
          <Route path="/services" element={<Navigate to="/customer/services" replace />} />
          <Route path="/browse" element={<Navigate to="/customer/experts" replace />} />
          <Route path="/book" element={<Navigate to="/customer/book" replace />} />
          <Route path="/booking" element={<Navigate to="/customer/book" replace />} />
          <Route path="/booking/:workerId" element={<Navigate to="/customer/book" replace />} />
          <Route path="/my-bookings" element={<Navigate to="/customer/bookings" replace />} />
          <Route path="/wallet" element={<Navigate to="/customer/wallet" replace />} />
          <Route path="/payments" element={<Navigate to="/customer/payments" replace />} />
          <Route path="/payment-history" element={<Navigate to="/customer/payments" replace />} />
          <Route path="/profile" element={<Navigate to="/customer/profile" replace />} />
          <Route path="/dashboard" element={<Navigate to="/customer/home" replace />} />
          <Route path="/customer-dashboard" element={<Navigate to="/customer/home" replace />} />
          <Route path="/handyman-dashboard" element={<Navigate to="/worker/dashboard" replace />} />

          {/* ============================================================ */}
          {/* 6. PUBLIC CONTENT / LEGAL PAGES                             */}
          {/* ============================================================ */}
          <Route path="/about" element={<CustomerLayout><About /></CustomerLayout>} />
          <Route path="/contact" element={<CustomerLayout><Contact /></CustomerLayout>} />
          <Route path="/how-it-works" element={<CustomerLayout><HowItWorks /></CustomerLayout>} />
          <Route path="/careers" element={<CustomerLayout><Careers /></CustomerLayout>} />
          <Route path="/help" element={<CustomerLayout><HelpCenter /></CustomerLayout>} />
          <Route path="/terms" element={<CustomerLayout><Terms /></CustomerLayout>} />
          <Route path="/privacy" element={<CustomerLayout><Privacy /></CustomerLayout>} />
          <Route path="/services/:city/:trade" element={<CustomerLayout><SEOLandingPage /></CustomerLayout>} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>

      <SmartFixAiWidget />
      <WebRtcCallModal />
      <CommandPalette />
      <SavedWorkersModal />
      <OfflineAlert />
      <ComfortQuickDock />
    </>
  );
}

export default App;
