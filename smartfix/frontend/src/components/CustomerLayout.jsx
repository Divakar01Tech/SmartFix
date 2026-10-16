import CustomerNavbar from './CustomerNavbar';
import Footer from './Footer';

export default function CustomerLayout({ children }) {
  return (
    <div className="customer-portal-layout d-flex flex-column min-vh-100">
      <CustomerNavbar />
      <main className="flex-grow-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
