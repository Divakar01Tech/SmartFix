import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Clock, 
  MapPin, 
  Sparkles, 
  RefreshCw, 
  Zap,
  Lock,
  CheckCircle2
} from 'lucide-react';
import { apiService } from '../services/api';

export default function WorkerAiDemandRadar() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [lang, setLang] = useState('en');

  const fetchInsights = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiService.workerGetDemandInsights();
      setData(res);
    } catch (err) {
      console.error('Failed to load Worker Demand Insights:', err);
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
          <span>Analyzing historical demand patterns & peak hours with AI...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return null;
  }

  const hasEnoughData = data.hasEnoughData;
  const sampleSize = data.sampleSize || 0;
  const required = data.requiredBookings || 30;
  const progressPercent = Math.min(100, Math.round((sampleSize / required) * 100));
  const insights = data.insights || {};

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
                <span>AI Market Demand & Earnings Insights</span>
                {hasEnoughData ? (
                  <span className="badge bg-warning text-dark rounded-pill fs-8">LIVE</span>
                ) : (
                  <span className="badge bg-secondary text-white rounded-pill fs-8">UNLOCKING</span>
                )}
              </h5>
              <small className="text-secondary" style={{ fontSize: '0.75rem' }}>
                <MapPin size={12} className="inline me-1" /> Tamil Nadu Service Corridor
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
              title="Refresh Insights"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* State A: Not enough data yet (< 30 completed bookings) */}
        {!hasEnoughData ? (
          <div 
            className="p-3 rounded-3 border border-secondary"
            style={{ background: 'rgba(255, 255, 255, 0.05)' }}
          >
            <div className="d-flex align-items-start gap-3">
              <div className="p-2 rounded-circle bg-warning bg-opacity-25 text-warning mt-1">
                <Lock size={20} />
              </div>
              <div className="flex-grow-1">
                <h6 className="fw-bold text-white mb-1">
                  {lang === 'ta' 
                    ? `தமிழ்நாடு முழுவதும் 30 முன்பதிவுகளுக்குப் பிறகு நுண்ணறிவுகள் திறக்கப்படும்`
                    : `Insights unlock after ${required} platform bookings across Tamil Nadu`}
                </h6>
                <p className="small text-secondary mb-2" style={{ fontSize: '0.8rem' }}>
                  {lang === 'ta'
                    ? `இதுவரை ${sampleSize} / ${required} உண்மையான முன்பதிவுகள் நிறைவடைந்துள்ளன. துல்லியமான கணிப்புகளுக்காக செயற்கையான போலித் தகவல்கள் தவிர்க்கப்படுகின்றன.`
                    : `(${sampleSize} / ${required} completed so far). To ensure high precision, SmartFix only trains on verified customer bookings without synthetic data.`}
                </p>

                {/* Progress Bar */}
                <div className="progress" style={{ height: '8px', background: 'rgba(255,255,255,0.1)' }}>
                  <div 
                    className="progress-bar bg-warning progress-bar-striped progress-bar-animated" 
                    role="progressbar" 
                    style={{ width: `${progressPercent}%` }}
                    aria-valuenow={progressPercent} 
                    aria-valuemin="0" 
                    aria-valuemax="100"
                  />
                </div>
                <div className="d-flex justify-content-between mt-1 text-secondary" style={{ fontSize: '0.72rem' }}>
                  <span>{progressPercent}% Complete</span>
                  <span>{required - sampleSize} more needed</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* State B: Real data unlocked (>= 30 bookings) */
          <div className="row g-3">
            {/* Peak Hours & Hot Districts */}
            <div className="col-12 col-md-6 border-end-md border-secondary">
              <div className="mb-3">
                <small className="text-secondary fw-bold text-uppercase d-block mb-1" style={{ fontSize: '0.7rem' }}>
                  <Clock size={12} className="me-1 inline" /> Top 3 Earning Hours for Your Trade
                </small>
                <div className="d-flex flex-column gap-1">
                  {insights.bestHours?.map((slot, idx) => (
                    <div 
                      key={idx}
                      className="p-2 rounded-3 d-flex align-items-center justify-content-between"
                      style={{ background: 'rgba(255, 255, 255, 0.07)' }}
                    >
                      <strong className="text-warning small">{slot.label}</strong>
                      <span className="badge bg-success-subtle text-success border border-success-subtle" style={{ fontSize: '0.65rem' }}>
                        Peak Demand
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <small className="text-secondary fw-bold text-uppercase d-block mb-1" style={{ fontSize: '0.7rem' }}>
                  <TrendingUp size={12} className="me-1 inline" /> High Surge Districts
                </small>
                <div className="d-flex flex-wrap gap-2">
                  {insights.hotDistricts?.map((d, idx) => (
                    <span 
                      key={idx} 
                      className="badge rounded-pill px-3 py-1 d-flex align-items-center gap-1"
                      style={{ background: 'rgba(255, 255, 255, 0.12)', color: '#ffffff', fontSize: '0.75rem' }}
                    >
                      <MapPin size={10} className="text-warning" />
                      <span>{d}</span>
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
              <div 
                className="p-3 rounded-3 border border-secondary"
                style={{ background: 'rgba(255, 255, 255, 0.04)' }}
              >
                <p className="mb-2 text-light" style={{ fontSize: '0.82rem', lineHeight: '1.4' }}>
                  {lang === 'ta' ? (insights.aiTips?.ta || insights.aiTips?.en) : insights.aiTips?.en}
                </p>
                <div className="d-flex align-items-center gap-1 text-secondary pt-2 border-top border-secondary" style={{ fontSize: '0.7rem' }}>
                  <CheckCircle2 size={12} className="text-success" />
                  <span>Based on {insights.sampleSize || sampleSize} past bookings across Tamil Nadu. Updated daily.</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
