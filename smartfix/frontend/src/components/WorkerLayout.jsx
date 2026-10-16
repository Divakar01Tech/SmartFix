import WorkerNavbar from './WorkerNavbar';

export default function WorkerLayout({ children }) {
  return (
    <div className="worker-portal-layout d-flex flex-column min-vh-100" style={{ background: '#0b1120', color: '#f8fafc' }}>
      <WorkerNavbar />
      <main className="flex-grow-1">
        {children}
      </main>
      <footer className="py-4 border-top border-secondary text-center text-muted small" style={{ background: '#0f172a' }}>
        <div className="container">
          <p className="mb-0 text-secondary">© {new Date().getFullYear()} SmartFix Partner Network — Sivagangai District</p>
        </div>
      </footer>
    </div>
  );
}
