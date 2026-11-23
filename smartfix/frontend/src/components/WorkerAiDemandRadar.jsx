import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Clock, 
  MapPin, 
  Sparkles, 
  ChevronRight, 
  RefreshCw, 
  Award,
  Zap
} from 'lucide-react';
import { apiService } from '../services/api';

export default function WorkerAiDemandRadar() {
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState(null);
  const [error, setError] = useState('');
  const [lang, setLang] = useState('en');

  const fetchInsights = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiService.getWorkerDemandInsights();
      setInsights(data);
    } catch (err) {
      console.error('Failed to load Worker AI Demand Insights:', err);
      setError('Could not fetch real-time demand data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  if (loading) {
    return (
      <div className="card border-0 shadow-sm rounded-4 p-3 mb-4 bg-white">
        <div className="d-flex align-items-center gap-2 text-muted small">
          <div className="spinner-border spinner-border-sm text-primary" role="status" />
          <span>Analyzing Sivagangai demand patterns & peak hours with AI...</span>
        </div>
      </div>
    );
  }

  if (error || !insights) {
    return null;
  }

  return (
    <div 
      className="card border-0 shadow-sm rounded-4 overflow-hidden mb-4"
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        color: '#ffffff'
      }}
    >
      <div className="card-body p-4">
        {/* Header */}
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
          <div className="d-flex align-items-center gap-2">
            <div 
              className="p-2 rounded-3 d-flex align-items-center justify-content-center text-dark"
              style={{ background: '#f59e0b' }}
            >
              <Zap size={18} />
            </div>
            <div>
              <h5 className="mb-0 fw-bold fs-6 text-white d-flex align-items-center gap-2">
                <span>AI Market Demand & Earnings Radar</span>
                <span className="badge bg-warning text-dark rounded-pill fs-8">LIVE</span>
              </h5>
              <small className="text-secondary" style={{ fontSize: '0.75rem' }}>
                <MapPin size={12} className="inline me-1" /> {insights.region || 'Sivagangai & Tamil Nadu'}
              </small>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2">
            <div className="btn-group btn-group-sm" role="group">
              <button
                type="button"
                className={`btn btn-sm ${lang === 'en' ? 'btn-light text-dark' : 'btn-outline-secondary text-white'}`}
                style={{ fontSize: '0.72rem' }}
                onClick={() => setLang('en')}
              >
                English
              </button>
              <button
                type="button"
                className={`btn btn-sm ${lang === 'ta' ? 'btn-light text-dark' : 'btn-outline-secondary text-white'}`}
                style={{ fontSize: '0.72rem' }}
                onClick={() => setLang('ta')}
              >
                தமிழ்
              </button>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary text-white p-1"
              onClick={fetchInsights}
              title="Refresh AI Radar"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* 2-Column Content */}
        <div className="row g-3">
          {/* Peak Hours & In-Demand Trades */}
          <div className="col-12 col-md-6 border-end-md border-secondary">
            <div className="mb-3">
              <small className="text-secondary fw-bold text-uppercase d-block mb-1" style={{ fontSize: '0.7rem' }}>
                <Clock size={12} className="me-1 inline" /> Peak Earning Windows Today
              </small>
              <div className="d-flex flex-column gap-1">
                {insights.peakDemandHours?.map((slot, idx) => (
                  <div 
                    key={idx}
                    className="p-2 rounded-3 d-flex align-items-center justify-content-between"
                    style={{ background: 'rgba(255, 255, 255, 0.07)' }}
                  >
                    <div>
                      <strong className="text-warning small d-block">{slot.timeSlot}</strong>
                      <span className="text-secondary" style={{ fontSize: '0.72rem' }}>{slot.reason}</span>
                    </div>
                    <span className="badge bg-success-subtle text-success border border-success-subtle" style={{ fontSize: '0.65rem' }}>
                      High Surge
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <small className="text-secondary fw-bold text-uppercase d-block mb-1" style={{ fontSize: '0.7rem' }}>
                <TrendingUp size={12} className="me-1 inline" /> Top Demanded Trades
              </small>
              <div className="d-flex flex-wrap gap-2">
                {insights.topDemandedTrades?.map((t, idx) => (
                  <span 
                    key={idx} 
                    className="badge rounded-pill px-3 py-1 d-flex align-items-center gap-1"
                    style={{ background: 'rgba(255, 255, 255, 0.12)', color: '#ffffff', fontSize: '0.75rem' }}
                  >
                    <span>{t.trade}</span>
                    <span className="text-warning">({t.bookingCount} reqs)</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* AI Tips for Worker */}
          <div className="col-12 col-md-6">
            <small className="text-secondary fw-bold text-uppercase d-block mb-2" style={{ fontSize: '0.7rem' }}>
              <Sparkles size={12} className="me-1 inline text-warning" /> AI Suggestions to Boost Your Monthly Income
            </small>
            <div className="d-flex flex-column gap-2">
              {insights.aiEarningsTips?.map((tip) => (
                <div 
                  key={tip.id} 
                  className="p-2 rounded-3 border border-secondary"
                  style={{ background: 'rgba(255, 255, 255, 0.04)' }}
                >
                  <strong className="d-block text-warning" style={{ fontSize: '0.78rem' }}>
                    {tip.title}
                  </strong>
                  <p className="mb-0 text-light" style={{ fontSize: '0.74rem', opacity: 0.9 }}>
                    {lang === 'ta' ? tip.tipTa : tip.tipEn}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

