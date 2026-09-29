import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import VerificationPage from './pages/VerificationPage';
import BookingsPage from './pages/BookingsPage';
import PaymentsPage from './pages/PaymentsPage';
import CommissionPage from './pages/CommissionPage';
import AdminSidebar from './components/AdminSidebar';
import './App.css';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AdminLayout({ children }) {
  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main className="admin-main">{children}</main>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<ProtectedRoute><AdminLayout><DashboardPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/verification" element={<ProtectedRoute><AdminLayout><VerificationPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute><AdminLayout><UsersPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/bookings" element={<ProtectedRoute><AdminLayout><BookingsPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/payments" element={<ProtectedRoute><AdminLayout><PaymentsPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/commission" element={<ProtectedRoute><AdminLayout><CommissionPage /></AdminLayout></ProtectedRoute>} />
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
