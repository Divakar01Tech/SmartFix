import AdminNavbar from './AdminNavbar';

export default function AdminLayout({ children }) {
  return (
    <div className="admin-portal-layout d-flex flex-column min-vh-100" style={{ background: '#090d16', color: '#f1f5f9' }}>
      <AdminNavbar />
      <main className="flex-grow-1">
        {children}
      </main>
      <footer className="py-3 border-top border-dark text-center text-muted small" style={{ background: '#06090e' }}>
        <div className="container">
          <p className="mb-0 text-secondary" style={{ fontSize: '0.8rem' }}>
            SmartFix Administrative Control Center — Strict Security Clearance Active
          </p>
        </div>
      </footer>
    </div>
  );
}
