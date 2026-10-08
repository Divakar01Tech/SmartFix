import React, { useState, useRef } from 'react';
import { Camera, Bot, AlertTriangle, CheckCircle2, AlertCircle, Upload, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { apiService } from '../services/api';
import './DiagnosisBox.css';

const DiagnosisBox = ({ onApplySuggestion, zone }) => {
  const { t, language } = useLanguage();
  const [text, setText] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) {
        setError(t('diagnosis.error_size', 'Image must be less than 4MB.'));
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setError('');
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDiagnose = async () => {
    if (!text.trim() && !imageFile) {
      setError(t('diagnosis.error_empty', 'Please provide a description or an image.'));
      return;
    }
    
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await apiService.diagnoseCustomerIssue({
        text,
        language: language || 'en',
        zone: zone || 'town',
        image: imageFile
      });

      setResult(res);
    } catch (err) {
      setError(err.message || t('diagnosis.error_api', 'Failed to get diagnosis. Please try manually.'));
    } finally {
      setLoading(false);
    }
  };

  const applySuggestion = () => {
    if (result && !result.fallback && result.category && result.subService) {
      onApplySuggestion({
        category: result.category,
        subService: result.subService,
        aiSuggested: {
          category: result.category,
          subService: result.subService,
          urgency: result.urgency,
          priceMin: result.priceMin,
          priceMax: result.priceMax,
          confidence: result.confidence,
          acceptedByUser: true
        }
      });
    }
  };

  const renderUrgencyBadge = (urgency) => {
    if (!urgency) return null;
    const colors = {
      Low: { bg: '#e8f5e9', color: '#2e7d32', icon: <CheckCircle2 size={14} /> },
      Medium: { bg: '#fff3e0', color: '#e65100', icon: <AlertCircle size={14} /> },
      Emergency: { bg: '#ffebee', color: '#c62828', icon: <AlertTriangle size={14} /> }
    };
    const style = colors[urgency] || colors.Low;
    return (
      <span className="urgency-badge" style={{ backgroundColor: style.bg, color: style.color }}>
        {style.icon} {t(`diagnosis.urgency_${urgency.toLowerCase()}`, urgency)}
      </span>
    );
  };

  return (
    <div className="diagnosis-box">
      <div className="diagnosis-header">
        <h3><Bot size={20} /> {t('diagnosis.title', 'AI Problem Diagnosis')}</h3>
        <p>{t('diagnosis.subtitle', 'Describe your issue or upload a photo, and our AI will recommend the best service and estimate the price.')}</p>
      </div>

      <div className="diagnosis-input-area">
        <textarea
          placeholder={t('diagnosis.placeholder', 'e.g., Water is leaking from my kitchen sink pipe...')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
        />
        
        <div className="diagnosis-actions">
          <input
            type="file"
            accept="image/jpeg, image/png, image/webp"
            ref={fileInputRef}
            onChange={handleImageSelect}
            style={{ display: 'none' }}
          />
          
          {imagePreview ? (
            <div className="image-preview-chip">
              <img src={imagePreview} alt="Preview" />
              <button type="button" onClick={removeImage}><X size={14} /></button>
            </div>
          ) : (
            <button type="button" className="btn-upload" onClick={() => fileInputRef.current?.click()}>
              <Camera size={16} /> {t('diagnosis.add_photo', 'Add Photo')}
            </button>
          )}

          <button 
            type="button" 
            className="btn-diagnose" 
            onClick={handleDiagnose}
            disabled={loading || (!text.trim() && !imageFile)}
          >
            {loading ? t('diagnosis.loading', 'Diagnosing...') : t('diagnosis.btn_diagnose', 'Diagnose Issue')}
          </button>
        </div>
        {error && <div className="diagnosis-error">{error}</div>}
      </div>

      {result && (
        <div className="diagnosis-result-card">
          {result.fallback ? (
            <div className="diagnosis-fallback">
              <AlertCircle size={20} color="#e65100" />
              <p>{result.followUpQuestion}</p>
            </div>
          ) : (
            <>
              <div className="result-header">
                <div>
                  <h4>{result.category} &gt; {result.subService}</h4>
                  <p className="price-estimate">
                    {t('diagnosis.estimate', 'Estimated price:')} ₹{result.priceMin} – ₹{result.priceMax}
                    <span className="price-disclaimer"> ({t('diagnosis.price_disclaimer', 'final price confirmed by worker on-site')})</span>
                  </p>
                </div>
                {renderUrgencyBadge(result.urgency)}
              </div>

              <div className="result-reason">
                <strong>{t('diagnosis.reason', 'AI Diagnosis:')}</strong> {result.reason}
              </div>

              {(result.urgency === 'Medium' || result.urgency === 'Emergency') && result.safetyTips && result.safetyTips.length > 0 && (
                <div className="safety-tips-box">
                  <h5><AlertTriangle size={16} /> {t('diagnosis.safety_tips', 'Safety Tips')}</h5>
                  <ul>
                    {result.safetyTips.map((tip, idx) => (
                      <li key={idx}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}

              <button type="button" className="btn-apply-suggestion" onClick={applySuggestion}>
                <CheckCircle2 size={16} /> {t('diagnosis.use_suggestion', 'Use this suggestion')}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default DiagnosisBox;
