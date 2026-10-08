import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, ChevronDown, Search, Loader2, AlertTriangle, CheckCircle2, Navigation, X, Info } from 'lucide-react';
import { getApiBase } from '../services/api';
import LocationPickerMap from './LocationPickerMap';
import './LocationPicker.css';

const DEBOUNCE_MS = 300;

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── Sub-component: Searchable Village Typeahead ─────────────────────────────
function VillageSearch({ talukId, lang, onSelect, disabled, value, t }) {
  const [query, setQuery] = useState(value?.name?.[lang] || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebounce(query, DEBOUNCE_MS);
  const inputRef = useRef(null);

  useEffect(() => {
    setQuery(value?.name?.[lang] || '');
  }, [value, lang]);

  useEffect(() => {
    if (!talukId || debouncedQuery.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const token = localStorage.getItem('smartfix_token');
    fetch(`${getApiBase()}/locations/taluks/${talukId}/villages?q=${encodeURIComponent(debouncedQuery)}`, {
      headers: { Authorization: token ? `Bearer ${token}` : '' }
    })
      .then(r => r.json())
      .then(data => {
        setResults(Array.isArray(data) ? data : []);
        setOpen(true);
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [debouncedQuery, talukId]);

  const KIND_LABELS = { city: '🏙️ City', town: '🏘️ Town', village: '🌿 Village' };

  const grouped = results.reduce((acc, v) => {
    const k = v.kind || 'village';
    if (!acc[k]) acc[k] = [];
    acc[k].push(v);
    return acc;
  }, {});

  return (
    <div style={{ position: 'relative' }}>
      <div className="lp-input-wrap">
        <Search size={16} className="lp-icon" />
        <input
          ref={inputRef}
          type="text"
          className="lp-input"
          placeholder={t('lp_village_placeholder', 'Type village / town / city...')}
          value={query}
          onChange={e => { setQuery(e.target.value); if (!e.target.value) onSelect(null); }}
          disabled={disabled}
          onFocus={() => query.length >= 2 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 180)}
          autoComplete="off"
        />
        {loading && <Loader2 size={15} className="lp-spinner" />}
      </div>

      {open && results.length > 0 && (
        <div className="lp-dropdown">
          {Object.entries(grouped).map(([kind, items]) => (
            <div key={kind}>
              <div className="lp-group-header">{KIND_LABELS[kind] || kind}</div>
              {items.map(v => (
                <button
                  key={v._id}
                  type="button"
                  className="lp-option"
                  onMouseDown={() => { onSelect(v); setQuery(v.name?.[lang] || v.name?.en); setOpen(false); }}
                >
                  {v.name?.[lang] || v.name?.en}
                  {v.pincode && <span className="lp-pincode">{v.pincode}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
      {open && debouncedQuery.length >= 2 && results.length === 0 && !loading && (
        <div className="lp-dropdown">
          <div className="lp-no-result">{t('lp_no_village_result', 'No results. Try another name.')}</div>
        </div>
      )}
    </div>
  );
}

// ─── Main LocationPicker ──────────────────────────────────────────────────────
const LocationPicker = ({
  onConfirm,          // called with { structuredAddress }
  mode = 'booking',  // 'booking' | 'worker' | 'address'
  workerMode = false, // allow multi-taluk select
  initialValue = null,
  className = ''
}) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'ta' ? 'ta' : 'en';

  // ── Data ──
  const [districts, setDistricts] = useState([]);
  const [taluks, setTaluks] = useState([]);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [selectedTaluk, setSelectedTaluk] = useState(null);
  const [selectedVillage, setSelectedVillage] = useState(null);
  const [freeText, setFreeText] = useState('');

  // ── Loading ──
  const [loadingDistricts, setLoadingDistricts] = useState(true);
  const [loadingTaluks, setLoadingTaluks] = useState(false);
  const [normalizing, setNormalizing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [locatingGps, setLocatingGps] = useState(false);

  // ── AI Result ──
  const [normalizedResult, setNormalizedResult] = useState(null);
  const [doorNo, setDoorNo] = useState('');
  const [street, setStreet] = useState('');
  const [landmark, setLandmark] = useState('');
  const [pincode, setPincode] = useState('');
  const [mapPos, setMapPos] = useState(null);
  const [aiCleaned, setAiCleaned] = useState(false);

  // ── Warnings ──
  const [mismatchWarning, setMismatchWarning] = useState(null); // { mentionedPlace, villageName }
  const [districtMismatchWarning, setDistrictMismatchWarning] = useState(false);
  const [districtMismatchConfirmed, setDistrictMismatchConfirmed] = useState(false);
  const [mapMismatch, setMapMismatch] = useState(false);
  const [needsPinAdjust, setNeedsPinAdjust] = useState(false);
  const [outsideTNError, setOutsideTNError] = useState('');

  // ── Waitlist ──
  const [waitlistJoined, setWaitlistJoined] = useState(false);
  const [waitlistLoading, setWaitlistLoading] = useState(false);

  // ── Step tracking ──
  const [step, setStep] = useState(1); // 1=district, 2=taluk, 3=village, 4=freetext+map, 5=confirmed

  const [errorMsg, setErrorMsg] = useState('');
  const [toast, setToast] = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };
  const token = localStorage.getItem('smartfix_token');
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  // ── Load Districts ──
  useEffect(() => {
    setLoadingDistricts(true);
    fetch(`${getApiBase()}/locations/districts`, { headers: authHeader })
      .then(r => r.json())
      .then(data => setDistricts(Array.isArray(data) ? data : []))
      .catch(() => setErrorMsg('Failed to load districts.'))
      .finally(() => setLoadingDistricts(false));
  }, []);

  // ── Load Taluks when district changes ──
  useEffect(() => {
    if (!selectedDistrict) return;
    setTaluks([]);
    setSelectedTaluk(null);
    setSelectedVillage(null);
    setStep(2);
    setLoadingTaluks(true);
    fetch(`${getApiBase()}/locations/districts/${selectedDistrict._id}/taluks`, { headers: authHeader })
      .then(r => r.json())
      .then(data => setTaluks(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoadingTaluks(false));
  }, [selectedDistrict]);

  useEffect(() => {
    if (selectedTaluk) setStep(3);
  }, [selectedTaluk]);

  useEffect(() => {
    if (selectedVillage) {
      setMapPos({ lat: selectedVillage.lat || selectedDistrict?.lat, lng: selectedVillage.lng || selectedDistrict?.lng });
      setStep(4);
    }
  }, [selectedVillage]);

  // ── AI Normalize ──
  const handleNormalize = async () => {
    if (!selectedDistrict || !selectedTaluk || !selectedVillage) {
      setErrorMsg(t('lp_select_all_levels', 'Please select district, taluk and village first.'));
      return;
    }
    setNormalizing(true);
    setErrorMsg('');
    setOutsideTNError('');
    setMismatchWarning(null);
    setDistrictMismatchWarning(false);
    setDistrictMismatchConfirmed(false);
    setMapMismatch(false);

    try {
      const res = await fetch(`${getApiBase()}/address/normalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({
          districtId: selectedDistrict._id,
          talukId: selectedTaluk._id,
          villageId: selectedVillage._id,
          freeText: freeText.trim()
        })
      });
      const data = await res.json();

      if (!res.ok) {
        setOutsideTNError(data.message || 'Address validation failed.');
        return;
      }

      setNormalizedResult(data);
      if (data.doorNo) setDoorNo(data.doorNo);
      if (data.street) setStreet(data.street);
      if (data.landmark) setLandmark(data.landmark);
      if (data.pincode) setPincode(data.pincode);
      if (data.lat && data.lng) setMapPos({ lat: data.lat, lng: data.lng });
      setAiCleaned(!!data.aiCleaned);
      setNeedsPinAdjust(!!data.needsPinAdjust);
      setMapMismatch(!!data.mapMismatch);

      if (data.mismatchWarning && data.mentionedPlace) {
        setMismatchWarning({ mentionedPlace: data.mentionedPlace, villageName: selectedVillage.name?.[lang] || selectedVillage.name?.en });
      }
      if (data.districtMismatchWarning) {
        setDistrictMismatchWarning(true);
      }
    } catch {
      // Fallback: build template address without blocking user
      setNormalizedResult({
        normalizedAddress: {
          en: `${freeText}, ${selectedVillage.name.en}, ${selectedTaluk.name.en}, ${selectedDistrict.name.en}`,
          ta: `${freeText}, ${selectedVillage.name.ta}, ${selectedTaluk.name.ta}, ${selectedDistrict.name.ta}`
        },
        aiCleaned: false
      });
      setAiCleaned(false);
      showToast(t('lp_ai_fallback', 'AI unavailable. Using your selections as address.'));
    } finally {
      setNormalizing(false);
    }
  };

  // ── Map pin drag / reverse geocode ──
  const handleMapPinChange = useCallback(async ({ lat, lng }) => {
    setMapPos({ lat, lng });
    setOutsideTNError('');
    setDistrictMismatchWarning(false);
    setMapMismatch(false);

    try {
      const res = await fetch(`${getApiBase()}/address/reverse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ lat, lng, districtId: selectedDistrict?._id, talukId: selectedTaluk?._id })
      });
      const data = await res.json();
      if (!res.ok) {
        setOutsideTNError(data.message || 'Location outside Tamil Nadu.');
        return;
      }
      if (data.districtMismatchWarning) setDistrictMismatchWarning(true);
      if (data.mapMismatch) setMapMismatch(true);
    } catch {}
  }, [selectedDistrict, selectedTaluk]);

  // ── Use Current GPS ──
  const handleGPS = () => {
    setLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLocatingGps(false);
        await handleMapPinChange({ lat, lng });
      },
      () => {
        setLocatingGps(false);
        showToast(t('lp_gps_error', 'Could not get your location.'));
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // ── Waitlist ──
  const handleJoinWaitlist = async () => {
    if (!selectedDistrict) return;
    setWaitlistLoading(true);
    try {
      const res = await fetch(`${getApiBase()}/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ districtId: selectedDistrict._id })
      });
      const data = await res.json();
      if (res.ok || data.alreadyJoined) {
        setWaitlistJoined(true);
        showToast(t('lp_waitlist_joined', "You'll be notified when service launches!"));
      }
    } catch {}
    finally { setWaitlistLoading(false); }
  };

  // ── Confirm ──
  const handleConfirm = async () => {
    if (outsideTNError) { setErrorMsg(outsideTNError); return; }
    if (mapMismatch && !districtMismatchConfirmed) {
      setErrorMsg(t('lp_confirm_pin', 'Please drag the pin to correct location before confirming.'));
      return;
    }
    if (districtMismatchWarning && !districtMismatchConfirmed) {
      setErrorMsg(t('lp_confirm_district', 'Please confirm the pin location is correct.'));
      return;
    }

    setConfirming(true);
    setErrorMsg('');

    try {
      const res = await fetch(`${getApiBase()}/address/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({
          districtId: selectedDistrict._id,
          talukId: selectedTaluk._id,
          villageId: selectedVillage._id,
          lat: mapPos?.lat,
          lng: mapPos?.lng,
          doorNo, street, landmark, pincode,
          normalizedAddress: normalizedResult?.normalizedAddress,
          aiCleaned
        })
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.code === 'DISTRICT_NOT_ACTIVE') {
          setErrorMsg(`${t('lp_district_not_active', 'Service not active in')} ${selectedDistrict.name?.[lang]}.`);
        } else {
          setErrorMsg(data.message || 'Confirmation failed.');
        }
        return;
      }

      setStep(5);
      if (onConfirm) onConfirm(data.structuredAddress);
    } catch {
      setErrorMsg(t('lp_confirm_error', 'Error confirming address. Try again.'));
    } finally {
      setConfirming(false);
    }
  };

  // ── Inactive district screen ──
  const isInactiveDistrict = selectedDistrict && !selectedDistrict.isServiceActive;

  const stepDone = (s) => step > s;
  const stepActive = (s) => step === s;

  return (
    <div className={`location-picker ${className}`}>
      {toast && <div className="lp-toast">{toast}</div>}

      {/* Step Header */}
      <div className="lp-steps">
        {[1, 2, 3, 4].map(s => (
          <div key={s} className={`lp-step ${stepDone(s) ? 'done' : stepActive(s) ? 'active' : 'pending'}`}>
            <div className="lp-step-circle">
              {stepDone(s) ? <CheckCircle2 size={14} /> : s}
            </div>
            <span>{[
              t('lp_step_district', 'District'),
              t('lp_step_taluk', 'Taluk'),
              t('lp_step_village', 'Village'),
              t('lp_step_address', 'Address')
            ][s - 1]}</span>
          </div>
        ))}
      </div>

      {/* ── STEP 1: District ── */}
      <div className="lp-section">
        <label className="lp-label">
          <MapPin size={14} /> {t('lp_district_label', 'District')}
        </label>
        {loadingDistricts ? (
          <div className="lp-loading"><Loader2 size={16} className="lp-spinner" /> {t('lp_loading', 'Loading...')}</div>
        ) : (
          <div className="lp-select-wrap">
            <select
              className="lp-select"
              value={selectedDistrict?._id || ''}
              onChange={e => {
                const d = districts.find(x => x._id === e.target.value);
                setSelectedDistrict(d || null);
                setSelectedTaluk(null);
                setSelectedVillage(null);
                setNormalizedResult(null);
                setStep(1);
                setWaitlistJoined(false);
              }}
            >
              <option value="">{t('lp_select_district', '-- Select District --')}</option>
              {districts.map(d => (
                <option key={d._id} value={d._id}>
                  {d.name?.[lang] || d.name?.en}
                  {!d.isServiceActive ? ` (${t('lp_coming_soon', 'Coming Soon')})` : ''}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="lp-chevron" />
          </div>
        )}
      </div>

      {/* ── Inactive District Screen ── */}
      {isInactiveDistrict && (
        <div className="lp-inactive-district">
          <div className="lp-inactive-icon">🏗️</div>
          <h4 className="lp-inactive-title">
            {t('lp_service_coming_soon', 'Service coming soon in')} {selectedDistrict.name?.[lang]}
          </h4>
          <p className="lp-inactive-sub">
            {t('lp_waitlist_desc', 'We\'re expanding! Join the waitlist and we\'ll notify you when we launch.')}
          </p>
          <button
            type="button"
            className={`lp-waitlist-btn ${waitlistJoined ? 'joined' : ''}`}
            onClick={handleJoinWaitlist}
            disabled={waitlistLoading || waitlistJoined}
          >
            {waitlistLoading ? <Loader2 size={15} className="lp-spinner" /> : null}
            {waitlistJoined
              ? `✅ ${t('lp_waitlist_joined_btn', 'On Waitlist!')}`
              : `🔔 ${t('lp_notify_me', 'Notify Me')}`}
          </button>
          {selectedDistrict.waitlistCount > 0 && (
            <p className="lp-waitlist-count">
              {selectedDistrict.waitlistCount} {t('lp_already_waiting', 'people already waiting')}
            </p>
          )}
        </div>
      )}

      {/* ── STEP 2: Taluk ── */}
      {selectedDistrict && selectedDistrict.isServiceActive && (
        <div className="lp-section">
          <label className="lp-label">
            {t('lp_taluk_label', 'Taluk')}
          </label>
          {loadingTaluks ? (
            <div className="lp-loading"><Loader2 size={16} className="lp-spinner" /> {t('lp_loading', 'Loading...')}</div>
          ) : (
            <div className="lp-select-wrap">
              <select
                className="lp-select"
                value={selectedTaluk?._id || ''}
                onChange={e => {
                  const tk = taluks.find(x => x._id === e.target.value);
                  setSelectedTaluk(tk || null);
                  setSelectedVillage(null);
                  setNormalizedResult(null);
                  setStep(tk ? 2 : 2);
                }}
                disabled={!selectedDistrict}
              >
                <option value="">{t('lp_select_taluk', '-- Select Taluk --')}</option>
                {taluks.map(tk => (
                  <option key={tk._id} value={tk._id}>{tk.name?.[lang] || tk.name?.en}</option>
                ))}
              </select>
              <ChevronDown size={16} className="lp-chevron" />
            </div>
          )}
        </div>
      )}

      {/* ── STEP 3: Village Typeahead ── */}
      {selectedTaluk && (
        <div className="lp-section">
          <label className="lp-label">
            {t('lp_village_label', 'City / Town / Village')}
          </label>
          <VillageSearch
            talukId={selectedTaluk._id}
            lang={lang}
            value={selectedVillage}
            onSelect={v => { setSelectedVillage(v); setNormalizedResult(null); }}
            disabled={!selectedTaluk}
            t={t}
          />
        </div>
      )}

      {/* ── STEP 4: Free text + Map ── */}
      {selectedVillage && (
        <>
          <div className="lp-section">
            <label className="lp-label">
              {t('lp_freetext_label', 'Door No / Street / Landmark (Tamil or English)')}
            </label>
            <textarea
              className="lp-textarea"
              rows={2}
              maxLength={250}
              placeholder={t('lp_freetext_placeholder', 'e.g. 12, Anna Nagar, Near Pillayar Koil')}
              value={freeText}
              onChange={e => setFreeText(e.target.value)}
            />
            <button
              type="button"
              className="lp-normalize-btn"
              onClick={handleNormalize}
              disabled={normalizing}
            >
              {normalizing ? <Loader2 size={15} className="lp-spinner" /> : '✨'}
              {normalizing ? t('lp_normalizing', 'Checking...') : t('lp_locate_on_map', 'Locate on Map')}
            </button>
          </div>

          {/* ── Mismatch Warnings ── */}
          {mismatchWarning && (
            <div className="lp-warning-box">
              <AlertTriangle size={16} />
              <div>
                <strong>{t('lp_mismatch_title', 'Place mismatch detected')}</strong>
                <p>{t('lp_mismatch_desc', 'You typed')} <em>{mismatchWarning.mentionedPlace}</em> {t('lp_but_selected', 'but selected')} <em>{mismatchWarning.villageName}</em>. {t('lp_which_correct', 'Which is correct?')}</p>
                <div className="lp-mismatch-actions">
                  <button type="button" className="lp-btn-secondary" onClick={() => setMismatchWarning(null)}>
                    {t('lp_keep_selection', 'Keep my selection')}
                  </button>
                  <button type="button" className="lp-btn-primary" onClick={() => { setSelectedVillage(null); setMismatchWarning(null); setStep(3); }}>
                    {t('lp_change_selection', 'Change selection')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {districtMismatchWarning && !districtMismatchConfirmed && (
            <div className="lp-warning-box warning-soft">
              <Info size={16} />
              <div>
                <strong>{t('lp_district_mismatch_title', 'Pin location notice')}</strong>
                <p>{t('lp_district_mismatch_desc', 'The pinned location may be in a different district. Google Maps district boundaries can be outdated. Please confirm the pin is correct.')}</p>
                <button type="button" className="lp-btn-primary" onClick={() => setDistrictMismatchConfirmed(true)}>
                  {t('lp_confirm_correct', 'Yes, my pin is correct')}
                </button>
              </div>
            </div>
          )}

          {needsPinAdjust && (
            <div className="lp-info-banner">
              📍 {t('lp_drag_pin', 'Drag the pin below to your exact location.')}
            </div>
          )}

          {outsideTNError && (
            <div className="lp-error-banner">
              ⚠️ {outsideTNError}
            </div>
          )}

          {mapMismatch && (
            <div className="lp-warning-box">
              <AlertTriangle size={16} />
              <p>{t('lp_map_mismatch', 'The pin seems far from the selected taluk. Please drag the pin to the correct location.')}</p>
            </div>
          )}

          {/* Map */}
          <div className="lp-section">
            <LocationPickerMap
              initialAddress={normalizedResult?.normalizedAddress?.[lang]}
              initialPosition={mapPos}
              onAddressSelect={() => {}}
              onLocationSelect={({ lat, lng }) => handleMapPinChange({ lat, lng })}
            />
            <button
              type="button"
              className="lp-gps-btn"
              onClick={handleGPS}
              disabled={locatingGps}
            >
              <Navigation size={14} />
              {locatingGps ? t('lp_locating', 'Locating...') : t('lp_use_my_location', 'Use my current location')}
            </button>
          </div>

          {/* Editable extracted fields */}
          {normalizedResult && (
            <div className="lp-fields-grid">
              <div className="lp-field">
                <label className="lp-sublabel">{t('lp_door_no', 'Door No')}</label>
                <input className="lp-input" type="text" value={doorNo} onChange={e => setDoorNo(e.target.value)} />
              </div>
              <div className="lp-field lp-field-wide">
                <label className="lp-sublabel">{t('lp_street', 'Street')}</label>
                <input className="lp-input" type="text" value={street} onChange={e => setStreet(e.target.value)} />
              </div>
              <div className="lp-field lp-field-wide">
                <label className="lp-sublabel">{t('lp_landmark', 'Landmark')}</label>
                <input className="lp-input" type="text" value={landmark} onChange={e => setLandmark(e.target.value)} />
              </div>
              <div className="lp-field">
                <label className="lp-sublabel">{t('lp_pincode', 'Pincode')}</label>
                <input className="lp-input" type="text" value={pincode} onChange={e => setPincode(e.target.value)} maxLength={6} />
              </div>
            </div>
          )}

          {/* Normalized address preview */}
          {normalizedResult?.normalizedAddress && (
            <div className="lp-address-preview">
              <CheckCircle2 size={15} color="#10b981" />
              <div>
                <div className="lp-preview-label">{t('lp_normalized_label', 'Normalized Address')}</div>
                <div className="lp-preview-text">{normalizedResult.normalizedAddress[lang]}</div>
                {!aiCleaned && <div className="lp-ai-badge lp-ai-fallback">⚠️ {t('lp_ai_not_cleaned', 'AI unavailable – template fallback')}</div>}
                {aiCleaned && <div className="lp-ai-badge lp-ai-ok">✨ {t('lp_ai_cleaned', 'AI-cleaned')}</div>}
              </div>
            </div>
          )}

          {errorMsg && <div className="lp-error-msg"><AlertTriangle size={14} /> {errorMsg}</div>}

          {/* Confirm Button */}
          {!outsideTNError && (
            <button
              type="button"
              className="lp-confirm-btn"
              onClick={handleConfirm}
              disabled={confirming || normalizing || !!mismatchWarning || (districtMismatchWarning && !districtMismatchConfirmed)}
            >
              {confirming ? <Loader2 size={16} className="lp-spinner" /> : <CheckCircle2 size={16} />}
              {confirming ? t('lp_confirming', 'Confirming...') : t('lp_confirm_address', 'Confirm Address')}
            </button>
          )}
        </>
      )}

      {/* ── STEP 5: Confirmed ── */}
      {step === 5 && (
        <div className="lp-confirmed">
          <CheckCircle2 size={32} color="#10b981" />
          <h4>{t('lp_address_confirmed', 'Address Confirmed!')}</h4>
          <p>
            {selectedVillage?.name?.[lang]}, {selectedTaluk?.name?.[lang]}, {selectedDistrict?.name?.[lang]}
          </p>
          <button type="button" className="lp-btn-secondary" onClick={() => { setStep(4); }}>
            {t('lp_edit_address', 'Edit')}
          </button>
        </div>
      )}
    </div>
  );
};

export default LocationPicker;
