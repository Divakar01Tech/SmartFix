import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, 
  Wrench, 
  ShieldAlert, 
  Clock, 
  ArrowRight, 
  CheckCircle2, 
  Volume2, 
  VolumeX, 
  AlertTriangle,
  Zap,
  Droplet,
  Snowflake,
  KeyRound,
  RotateCcw
} from 'lucide-react';
import { apiService } from '../services/api';

const QUICK_ISSUES = [
  {
    id: 'ac_cooling',
    label: '❄️ AC Low Cooling / Water Leaking',
    labelTa: '❄️ ஏசி குளிரவில்லை / தண்ணீர் கசிவு',
    trade: 'AC Repair',
    prompt: 'AC indoor unit running but not cooling room properly and water dripping from front panel.'
  },
  {
    id: 'elec_spark',
    label: '⚡ MCB Tripping / Fan Sparking',
    labelTa: '⚡ MCB ட்ரிப் / மின்விசிறி ஸ்பார்க்',
    trade: 'Electrical',
    prompt: 'Ceiling fan humming loudly, switch sparking and main MCB breaker trips intermittently.'
  },
  {
    id: 'plumb_leak',
    label: '🚰 Kitchen Sink / Pipe Burst',
    labelTa: '🚰 குழாய் கசிவு / சிங்க் அடைப்பு',
    trade: 'Plumbing',
    prompt: 'Continuous water leakage from PVC elbow pipe under kitchen sink with low pressure in taps.'
  },
  {
    id: 'door_lock',
    label: '🚪 Broken Door Lock / Hinge Stuck',
    labelTa: '🚪 கதவு பூட்டு பழுது / கீல் நெரிசல்',
    trade: 'Carpentry',
    prompt: 'Main door deadbolt lock jammed, key not turning and door rubbing against the bottom frame.'
  }
];

export default function CustomerAiDiagnoser() {
  const navigate = useNavigate();
  const [lang, setLang] = useState('en');
  const [selectedTrade, setSelectedTrade] = useState('AC Repair');
  const [problemText, setProblemText] = useState('');
  const [loading, setLoading] = useState(false);
  const [estimate, setEstimate] = useState(null);
  const [error, setError] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleSelectQuickIssue = (issue) => {
    setSelectedTrade(issue.trade);
    setProblemText(issue.prompt);
    handleDiagnose(issue.trade, issue.prompt);
  };

  const handleDiagnose = async (tradeToUse, textToUse) => {
    const t = tradeToUse || selectedTrade;
    const p = (textToUse !== undefined ? textToUse : problemText).trim();

    if (!t && !p) {
      setError(lang === 'ta' ? 'தயவுசெய்து உங்கள் பழுது சிக்கலை உள்ளிடவும்.' : 'Please describe your repair problem.');
      return;
    }

    setLoading(true);
    setError('');
    setEstimate(null);

    try {
      const data = await apiService.getAiRepairEstimate(t, p || `${t} diagnostic inspection`, lang);
      setEstimate(data);
    } catch (err) {
      console.error('AI Diagnoser error:', err);
      setError(lang === 'ta' ? 'AI கணிப்பை பெற முடியவில்லை. நிலையான கட்டணங்கள் பொருந்தும்.' : 'Could not fetch AI diagnosis. Standard rates apply.');
    } finally {
      setLoading(false);
    }
  };

  const handleSpeakSafetyTip = () => {
    if (!('speechSynthesis' in window)) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const tip = estimate?.safetyTip?.[lang] || estimate?.safetyTip?.en || '';
    if (!tip) return;

    const utterance = new SpeechSynthesisUtterance(tip);
    utterance.lang = lang === 'ta' ? 'ta-IN' : 'en-US';
    utterance.rate = 0.95;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleProceedToBooking = () => {
    const tradeParam = encodeURIComponent(selectedTrade || 'Plumbing');
    const notesParam = encodeURIComponent(
      `[AI Diagnosed]: ${estimate?.summary?.[lang] || estimate?.summary?.en || problemText || 'Service requested'}. Estimated: ₹${estimate?.minCost || 300} - ₹${estimate?.maxCost || 600}`
    );
    navigate(`/customer/book?category=${tradeParam}&notes=${notesParam}`);
  };

  return (
    <div 
      className="card border-0 shadow-sm rounded-4 overflow-hidden mb-4"
      style={{
        background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 40%, #e0f2fe 100%)',
        border: '1px solid rgba(14, 165, 233, 0.2)'
      }}
    >
      <div className="card-body p-4">
        {/* Header Bar */}
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
          <div className="d-flex align-items-center gap-2">
            <div 
              className="p-2 rounded-3 text-white d-flex align-items-center justify-content-center"
              style={{ background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)' }}
            >
              <Sparkles size={20} />
            </div>
            <div>
              <h5 className="mb-0 fw-bold text-dark d-flex align-items-center gap-2">
                <span>SmartFix AI Issue Diagnoser</span>
                <span className="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill fs-7 px-2 py-1">
                  Instant Quote
                </span>
              </h5>
              <small className="text-secondary" style={{ fontSize: '0.8rem' }}>
                {lang === 'ta' ? 'உங்கள் பழுது சிக்கலை உடனடியாக பகுப்பாய்வு செய்து நியாயமான விலை மதிப்பீட்டைப் பெறுங்கள்' : 'Instant problem diagnosis, transparent Sivagangai pricing & safety advice'}
              </small>
            </div>
          </div>

          {/* Language Switcher */}
          <div className="btn-group btn-group-sm bg-white p-1 rounded-pill shadow-sm border" role="group">
            <button
              type="button"
              className={`btn btn-sm rounded-pill px-3 py-1 fw-semibold ${lang === 'en' ? 'btn-primary text-white' : 'btn-light text-muted'}`}
              style={{ fontSize: '0.75rem' }}
              onClick={() => setLang('en')}
            >
              English
            </button>
            <button
              type="button"
              className={`btn btn-sm rounded-pill px-3 py-1 fw-semibold ${lang === 'ta' ? 'btn-primary text-white' : 'btn-light text-muted'}`}
              style={{ fontSize: '0.75rem' }}
              onClick={() => setLang('ta')}
            >
              தமிழ்
            </button>
          </div>
        </div>

        {/* Quick Issue Chips */}
        <div className="mb-3">
          <small className="text-muted fw-bold text-uppercase d-block mb-2" style={{ fontSize: '0.72rem', letterSpacing: '0.5px' }}>
            {lang === 'ta' ? 'பொதுவான சிக்கல்கள் (விரைவு தேர்வு):' : 'Popular Common Repairs (1-Click Test):'}
          </small>
          <div className="d-flex flex-wrap gap-2">
            {QUICK_ISSUES.map((issue) => (
              <button
                key={issue.id}
                type="button"
                className="btn btn-sm btn-outline-secondary bg-white rounded-pill px-3 py-1 d-flex align-items-center gap-1 shadow-sm border"
                style={{ fontSize: '0.78rem', transition: 'all 0.2s ease' }}
                onClick={() => handleSelectQuickIssue(issue)}
              >
                {lang === 'ta' ? issue.labelTa : issue.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <div className="row g-2 mb-3 align-items-center">
          <div className="col-12 col-md-3">
            <select
              className="form-select form-select-sm rounded-3 bg-white border shadow-sm fw-semibold"
              value={selectedTrade}
              onChange={(e) => setSelectedTrade(e.target.value)}
              style={{ height: '42px', fontSize: '0.85rem' }}
            >
              <option value="AC Repair">❄️ AC Service & Repair</option>
              <option value="Electrical">⚡ Electrical & Fan</option>
              <option value="Plumbing">🚰 Plumbing & Pipes</option>
              <option value="Carpentry">🚪 Carpentry & Doors</option>
              <option value="Painting">🎨 Home Painting</option>
              <option value="Appliance Repair">🧺 Appliance Repair</option>
            </select>
          </div>
          <div className="col-12 col-md-7">
            <input
              type="text"
              className="form-control form-control-sm rounded-3 bg-white border shadow-sm"
              placeholder={lang === 'ta' ? 'உங்கள் பழுது சிக்கலை விவரிக்கவும் (எ.கா: குழாயில் நீர் கசிகிறது)...' : 'Describe your issue (e.g. humming noise, water leakage under sink)...'}
              value={problemText}
              onChange={(e) => setProblemText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleDiagnose()}
              style={{ height: '42px', fontSize: '0.85rem' }}
            />
          </div>
          <div className="col-12 col-md-2">
            <button
              type="button"
              className="btn btn-primary btn-sm w-100 rounded-3 d-flex align-items-center justify-content-center gap-2 fw-bold shadow-sm"
              onClick={() => handleDiagnose()}
              disabled={loading}
              style={{ height: '42px', fontSize: '0.85rem' }}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>{lang === 'ta' ? 'கணிக்கவும்' : 'Diagnose'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error Notice */}
        {error && (
          <div className="alert alert-danger py-2 px-3 rounded-3 small mb-3 d-flex align-items-center gap-2">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* AI Estimation Result Panel */}
        {estimate && (
          <div 
            className="p-3 bg-white rounded-4 border shadow-sm animate__animated animate__fadeIn"
            style={{ borderLeft: '4px solid #2563eb' }}
          >
            <div className="row g-3 align-items-center">
              {/* Left Column: Price & Duration */}
              <div className="col-12 col-md-4 border-end-md">
                <div className="p-2 bg-light rounded-3 text-center">
                  <small className="text-muted fw-bold d-block text-uppercase" style={{ fontSize: '0.7rem' }}>
                    {lang === 'ta' ? 'மதிப்பிடப்பட்ட விலை வரம்பு' : 'Estimated Fair Price'}
                  </small>
                  <h3 className="mb-0 fw-bolder text-primary">
                    ₹{estimate.minCost} - ₹{estimate.maxCost}
                  </h3>
                  <div className="d-flex align-items-center justify-content-center gap-2 mt-1">
                    <span className="badge bg-secondary-subtle text-secondary rounded-pill" style={{ fontSize: '0.7rem' }}>
                      <Clock size={11} className="me-1 inline" /> {estimate.estimatedDuration || '45 mins'}
                    </span>
                    <span className="badge bg-warning-subtle text-warning-emphasis rounded-pill" style={{ fontSize: '0.7rem' }}>
                      {estimate.complexity || 'Moderate'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Middle Column: Summary & Parts */}
              <div className="col-12 col-md-5">
                <h6 className="fw-bold mb-1 text-dark" style={{ fontSize: '0.88rem' }}>
                  {estimate.summary?.[lang] || estimate.summary?.en || 'Diagnostic Assessment'}
                </h6>
                {estimate.likelyParts && estimate.likelyParts.length > 0 && (
                  <div className="mb-2">
                    <small className="text-muted d-block" style={{ fontSize: '0.72rem' }}>
                      {lang === 'ta' ? 'தேவையான உதிரிபாகங்கள்:' : 'Likely Components / Spares:'}
                    </small>
                    <div className="d-flex flex-wrap gap-1 mt-1">
                      {estimate.likelyParts.map((part, idx) => (
                        <span key={idx} className="badge bg-light text-dark border rounded-pill" style={{ fontSize: '0.68rem' }}>
                          <Wrench size={10} className="me-1" /> {part}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {/* Safety Precautions with Voice */}
                {(estimate.safetyTip?.[lang] || estimate.safetyTip?.en) && (
                  <div className="p-2 rounded-3 bg-danger-subtle text-danger-emphasis d-flex align-items-center justify-content-between gap-2">
                    <div className="d-flex align-items-center gap-2">
                      <ShieldAlert size={16} className="text-danger flex-shrink-0" />
                      <small style={{ fontSize: '0.74rem' }}>
                        <strong>{lang === 'ta' ? 'முக்கிய பாதுகாப்பு:' : 'Safety Action:'}</strong>{' '}
                        {estimate.safetyTip?.[lang] || estimate.safetyTip?.en}
                      </small>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm btn-link text-danger p-0"
                      onClick={handleSpeakSafetyTip}
                      title={isSpeaking ? 'Stop voice' : 'Listen in audio'}
                    >
                      {isSpeaking ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>
                  </div>
                )}
              </div>

              {/* Right Column: 1-Click Proceed CTA */}
              <div className="col-12 col-md-3 text-md-end">
                <button
                  type="button"
                  className="btn btn-success w-100 rounded-3 py-2 fw-bold d-flex align-items-center justify-content-center gap-2 shadow-sm"
                  onClick={handleProceedToBooking}
                  style={{ fontSize: '0.85rem' }}
                >
                  <span>{lang === 'ta' ? 'இப்போதே பதிவு செய்' : 'Book with this AI Quote'}</span>
                  <ArrowRight size={16} />
                </button>
                <small className="text-muted d-block mt-1 text-center" style={{ fontSize: '0.68rem' }}>
                  ✓ Background-checked Sivagangai Techs
                </small>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

