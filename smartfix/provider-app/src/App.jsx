import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import ProviderDashboard from './pages/ProviderDashboard';
import ActiveJobPage from './pages/ActiveJobPage';
import EarningsPage from './pages/EarningsPage';
import BookingHistoryPage from './pages/BookingHistoryPage';
import ProfilePage from './pages/ProfilePage';
import Sidebar from './components/Sidebar';
import './App.css';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">{children}</main>
    </div>
  );
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<ProtectedRoute><AppLayout><ProviderDashboard /></AppLayout></ProtectedRoute>} />
      <Route path="/job/:bookingId" element={<ProtectedRoute><AppLayout><ActiveJobPage /></AppLayout></ProtectedRoute>} />
      <Route path="/earnings" element={<ProtectedRoute><AppLayout><EarningsPage /></AppLayout></ProtectedRoute>} />
      <Route path="/history" element={<ProtectedRoute><AppLayout><BookingHistoryPage /></AppLayout></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><AppLayout><ProfilePage /></AppLayout></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
