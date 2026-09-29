import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import SEO from '../components/SEO';
import { apiService } from '../services/api';
import WorkerCard from '../components/WorkerCard';
import { MapPin, Star, Wrench, ShieldCheck, ChevronRight } from 'lucide-react';

const SEOLandingPage = () => {
  const { city, trade } = useParams();
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);

  const formatString = (str) => {
    if (!str) return '';
    return str.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const formattedCity = formatString(city) || 'Sivagangai';
  const formattedTrade = formatString(trade) || 'Plumbers';
  const title = `Top Rated ${formattedTrade} in ${formattedCity} | LocalHands`;
  const description = `Looking for the best ${formattedTrade.toLowerCase()} in ${formattedCity}? Find top-rated, zero-commission verified trade workers on LocalHands. Connect directly!`;

  useEffect(() => {
    const fetchWorkers = async () => {
      setLoading(true);
      try {
        const rawWorkers = await apiService.getWorkers({ trade: formattedTrade, location: formattedCity });
        setWorkers(rawWorkers || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchWorkers();
  }, [city, trade, formattedTrade, formattedCity]);

  // Schema.org Local Business Markup
  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "serviceType": formattedTrade,
    "provider": {
      "@type": "LocalBusiness",
      "name": `LocalHands ${formattedTrade} in ${formattedCity}`,
      "areaServed": {
        "@type": "City",
        "name": formattedCity,
        "containedInPlace": {
          "@type": "State",
          "name": "Tamil Nadu"
        }
      }
    },
    "description": description
  };

  return (
    <div className="seo-landing-page bg-light min-vh-100 pb-5">
      <SEO 
        title={title} 
        description={description} 
        schema={localBusinessSchema} 
      />

      <div className="bg-primary text-white py-5 text-center">
        <div className="container">
          <div className="d-inline-flex align-items-center mb-3 text-white-50 small fw-bold">
            <Link to="/" className="text-white-50 text-decoration-none">Home</Link>
            <ChevronRight size={14} className="mx-1" />
            <Link to="/browse" className="text-white-50 text-decoration-none">Services</Link>
            <ChevronRight size={14} className="mx-1" />
            <span className="text-white">{formattedCity}</span>
          </div>
          <h1 className="fw-extrabold mb-3 display-5">Best {formattedTrade} in {formattedCity}</h1>
          <p className="lead opacity-75 mb-4 max-w-md mx-auto">
            Get instant access to trusted, KYC-verified local professionals. No commission fees, talk directly to the {formattedTrade.toLowerCase()}.
          </p>
          <div className="d-flex justify-content-center gap-3">
            <span className="badge bg-white text-primary rounded-pill px-3 py-2">
              <ShieldCheck size={16} className="me-1" /> KYC Verified
            </span>
            <span className="badge bg-white text-primary rounded-pill px-3 py-2">
              <Star size={16} className="me-1" /> Rated 4.5+
            </span>
          </div>
        </div>
      </div>

      <div className="container mt-5">
        <h3 className="fw-bold mb-4">Available {formattedTrade} ({workers.length})</h3>
        
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status"></div>
            <p className="text-muted mt-2">Finding nearby workers...</p>
          </div>
        ) : workers.length === 0 ? (
          <div className="text-center py-5 bg-white rounded-4 border shadow-sm">
            <Wrench size={48} color="#94a3b8" className="mb-3" />
            <h4>No {formattedTrade} available right now</h4>
            <p className="text-muted">We are rapidly expanding in {formattedCity}. Please check back later or try another service.</p>
            <Link to="/browse" className="btn btn-outline-primary mt-2">Browse All Services</Link>
          </div>
        ) : (
          <div className="row g-4">
            {workers.map(worker => (
              <div key={worker._id || worker.id} className="col-12 col-md-6 col-lg-4">
                <WorkerCard worker={worker} />
              </div>
            ))}
          </div>
        )}
        
        <div className="mt-5 p-4 bg-white rounded-4 border">
          <h4 className="fw-bold mb-3">Why hire {formattedTrade.toLowerCase()} through LocalHands?</h4>
          <ul className="text-muted lh-lg mb-0">
            <li><strong>Zero Platform Commission:</strong> We don't take a cut from the worker's earnings, ensuring you get the fairest market price.</li>
            <li><strong>Direct Contact:</strong> Call or chat directly with the provider before booking.</li>
            <li><strong>Verified Professionals:</strong> All workers pass a rigorous Aadhaar-based KYC and AI skill assessment.</li>
            <li><strong>Hyperlocal Focus:</strong> Specialized for {formattedCity} and surrounding neighborhoods for fastest service.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SEOLandingPage;
