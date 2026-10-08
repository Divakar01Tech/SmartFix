import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from './components/ProtectedRoute';

const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Browse = lazy(() => import('./pages/Browse'));
const Booking = lazy(() => import('./pages/Booking'));
const CustomerDashboard = lazy(() => import('./pages/CustomerDashboard'));
const HandymanDashboard = lazy(() => import('./pages/HandymanDashboard'));
const ProfileSettings = lazy(() => import('./pages/ProfileSettings'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const AdminAnalytics = lazy(() => import('./pages/AdminAnalytics'));

const About = lazy(() => import('./pages/About'));
const Contact = lazy(() => import('./pages/Contact'));
const HowItWorks = lazy(() => import('./pages/HowItWorks'));
const Careers = lazy(() => import('./pages/Careers'));
const HelpCenter = lazy(() => import('./pages/HelpCenter'));
const Terms = lazy(() => import('./pages/Terms'));
const Privacy = lazy(() => import('./pages/Privacy'));
const SEOLandingPage = lazy(() => import('./pages/SEOLandingPage'));

import SmartFixAiWidget from './components/SmartFixAiWidget';
import WebRtcCallModal from './components/WebRtcCallModal';

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
      <Navbar />
      <main>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/browse" element={<ProtectedRoute><Browse /></ProtectedRoute>} />
            <Route path="/booking/:workerId" element={<ProtectedRoute allowedRoles={['customer']}><Booking /></ProtectedRoute>} />
            <Route path="/customer-dashboard" element={<ProtectedRoute allowedRoles={['customer']}><CustomerDashboard /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['customer']}><CustomerDashboard /></ProtectedRoute>} />
            <Route path="/my-bookings" element={<ProtectedRoute allowedRoles={['customer']}><CustomerDashboard /></ProtectedRoute>} />
            <Route path="/customer/dashboard" element={<ProtectedRoute allowedRoles={['customer']}><CustomerDashboard /></ProtectedRoute>} />
            <Route path="/handyman-dashboard" element={<ProtectedRoute allowedRoles={['handyman']}><HandymanDashboard /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfileSettings /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminPanel /></ProtectedRoute>} />
            <Route path="/admin/analytics" element={<ProtectedRoute allowedRoles={['admin']}><AdminAnalytics /></ProtectedRoute>} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/careers" element={<Careers />} />
            <Route path="/help" element={<HelpCenter />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/services/:city/:trade" element={<SEOLandingPage />} />
          </Routes>
        </Suspense>
      </main>
      <SmartFixAiWidget />
      <WebRtcCallModal />
      <Footer />
    </>
  );
}

export default App;
