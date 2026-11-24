import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Tv,
  Camera,
  QrCode,
  Calendar,
  Wrench,
  ShieldAlert,
  ShieldCheck,
  CheckCircle,
  Loader2,
  Trash2,
  Edit2,
  ExternalLink,
  Sparkles,
  Info,
} from 'lucide-react';
import { apiService } from '../services/api';

const CATEGORY_ICONS = {
  'Air Conditioner': '❄️',
  'Washing Machine': '🧺',
  Refrigerator: '🧊',
  'Water Purifier': '💧',
  Microwave: '🍲',
  Geyser: '🚿',
  Television: '📺',
  'Plumbing Fixture': '🔧',
  'Inverter / UPS': '🔋',
  Other: '📦',
};

export default function AppliancePassportModal({ isOpen, onClose, onSelectAppliance }) {
  const [appliances, setAppliances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedAppliance, setSelectedAppliance] = useState(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scanMessage, setScanMessage] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    category: 'Air Conditioner',
    brand: '',
    modelNumber: '',
    serialNumber: '',
    capacityOrSpecs: '',
    warrantyExpiry: '',
    installDate: '',
    photoUrl: '',
    notes: '',
  });

  const loadAppliances = async () => {
    setLoading(true);
    try {
      const list = await apiService.getMyAppliances();
      setAppliances(list);
    } catch (err) {
      console.error('Failed to load appliances:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAppliances();
      setShowAddForm(false);
      setSelectedAppliance(null);
    }
  }, [isOpen]);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanLoading(true);
    setScanMessage('AI is reading appliance nameplate & specifications...');

    try {
      const data = new FormData();
      data.append('photo', file);

      const res = await apiService.extractApplianceFromPhoto(data);
      if (res.photoUrl) {
        setFormData((prev) => ({ ...prev, photoUrl: res.photoUrl }));
      }

      if (res.data) {
        setFormData((prev) => ({
          ...prev,
          category: res.data.category || prev.category,
          brand: res.data.brand || prev.brand,
          modelNumber: res.data.modelNumber || prev.modelNumber,
          serialNumber: res.data.serialNumber || prev.serialNumber,
          capacityOrSpecs: res.data.capacityOrSpecs || prev.capacityOrSpecs,
        }));
        setScanMessage(
          res.aiDisabled
            ? 'AI scanning is disabled; image uploaded for record.'
            : `Extracted specifications with ${res.data.confidence || 80}% confidence. Please review before saving.`
        );
      }
    } catch (err) {
      console.error('Scan error:', err);
      setScanMessage('Could not read nameplate automatically. Please enter details manually.');
    } finally {
      setScanLoading(false);
    }
  };

  const handleSaveAppliance = async (e) => {
    e.preventDefault();
    if (!formData.brand || !formData.category) return;

    setSubmitting(true);
    try {
      await apiService.createAppliance(formData);
      await loadAppliances();
      setShowAddForm(false);
      setFormData({
        category: 'Air Conditioner',
        brand: '',
        modelNumber: '',
        serialNumber: '',
        capacityOrSpecs: '',
        warrantyExpiry: '',
        installDate: '',
        photoUrl: '',
        notes: '',
      });
      setScanMessage('');
    } catch (err) {
      alert('Failed to save appliance: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this appliance passport?')) return;
    try {
      await apiService.deleteAppliance(id);
      loadAppliances();
      if (selectedAppliance?._id === id) setSelectedAppliance(null);
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)', zIndex: 1055 }}
    >
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
          {/* Header */}
          <div
            className="modal-header border-0 px-4 py-3 text-white"
            style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)' }}
          >
            <div className="d-flex align-items-center gap-2">
              <span className="fs-4">🛡️</span>
              <div>
                <h5 className="modal-title fw-bold mb-0">SmartFix Appliance Passport</h5>
                <small className="text-light opacity-75">
                  AI-assisted digital warranty, service lifecycle, & QR passport
                </small>
              </div>
            </div>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
              aria-label="Close"
            />
          </div>

          {/* Body */}
          <div className="modal-body p-4 bg-light" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
            {/* Top Toolbar */}
            <div className="d-flex justify-content-between align-items-center mb-3">
              <span className="fw-bold text-dark fs-6">
                Your Registered Home Appliances ({appliances.length})
              </span>
              {!showAddForm && (
                <button
                  type="button"
                  className="btn btn-sm btn-primary rounded-pill d-flex align-items-center gap-1 shadow-sm px-3"
                  onClick={() => {
                    setShowAddForm(true);
                    setSelectedAppliance(null);
                  }}
                >
                  <Plus size={16} />
                  <span>Register New Appliance</span>
                </button>
              )}
            </div>

            {/* Scan / Add Form */}
            {showAddForm && (
              <div className="card border-0 shadow-sm rounded-4 p-4 mb-4 bg-white">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h6 className="fw-bold mb-0 d-flex align-items-center gap-2">
                    <Sparkles size={18} className="text-primary" />
                    <span>Scan or Enter Appliance Specifications</span>
                  </h6>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary rounded-pill"
                    onClick={() => setShowAddForm(false)}
                  >
                    Cancel
                  </button>
                </div>

                {/* AI Nameplate Scanner Upload Box */}
                <div
                  className="border border-2 border-dashed rounded-3 p-3 text-center mb-3 bg-light position-relative"
                  style={{ borderColor: '#cbd5e1' }}
                >
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="position-absolute top-0 start-0 w-100 h-100 opacity-0 cursor-pointer"
                    onChange={handlePhotoUpload}
                    disabled={scanLoading}
                  />
                  <div className="d-flex flex-column align-items-center justify-content-center py-2">
                    {scanLoading ? (
                      <>
                        <Loader2 size={32} className="text-primary spin-animation mb-2" />
                        <span className="small text-primary fw-bold">Analyzing image with Claude AI...</span>
                      </>
                    ) : (
                      <>
                        <Camera size={28} className="text-muted mb-1" />
                        <strong className="small text-dark">
                          Take a photo or upload Nameplate / Rating Sticker
                        </strong>
                        <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                          Claude Vision automatically reads Brand, Model, Serial, & Specifications
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {scanMessage && (
                  <div className="alert alert-info py-2 px-3 small rounded-3 d-flex align-items-center gap-2 mb-3">
                    <Info size={16} className="flex-shrink-0" />
                    <span>{scanMessage}</span>
                  </div>
                )}

                {/* Form Fields */}
                <form onSubmit={handleSaveAppliance}>
                  <div className="row g-2 mb-2">
                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-bold mb-1">Appliance Category *</label>
                      <select
                        className="form-select form-select-sm"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        required
                      >
                        {Object.keys(CATEGORY_ICONS).map((cat) => (
                          <option key={cat} value={cat}>
                            {CATEGORY_ICONS[cat]} {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-bold mb-1">Brand Name *</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="e.g. LG, Daikin, Samsung"
                        value={formData.brand}
                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="row g-2 mb-2">
                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-bold mb-1">Model Number</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="e.g. FTKF50TV16U"
                        value={formData.modelNumber}
                        onChange={(e) => setFormData({ ...formData, modelNumber: e.target.value })}
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-bold mb-1">Serial Number</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="e.g. SN-8947192"
                        value={formData.serialNumber}
                        onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-bold mb-1">Capacity / Specs</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="e.g. 1.5 Ton 5 Star Inverter"
                        value={formData.capacityOrSpecs}
                        onChange={(e) => setFormData({ ...formData, capacityOrSpecs: e.target.value })}
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-bold mb-1">Warranty Expiry Date</label>
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        value={formData.warrantyExpiry}
                        onChange={(e) => setFormData({ ...formData, warrantyExpiry: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="d-flex justify-content-end gap-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-light"
                      onClick={() => setShowAddForm(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-sm btn-primary px-4 fw-bold"
                      disabled={submitting}
                    >
                      {submitting ? 'Saving Passport...' : 'Save Appliance Passport'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Loading State */}
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status" />
                <p className="small text-muted mt-2">Loading appliance passports...</p>
              </div>
            ) : appliances.length === 0 && !showAddForm ? (
              /* Honest Empty State */
              <div className="text-center py-5 card border-0 rounded-4 bg-white p-4">
                <span className="fs-1 mb-2">🏷️</span>
                <h6 className="fw-bold text-dark">No appliances registered yet</h6>
                <p className="small text-secondary mx-auto" style={{ maxWidth: '420px' }}>
                  Register your AC, washing machine, or refrigerator. SmartFix tracks warranty
                  milestones, logs every doorstep repair, and generates an instant QR passport.
                </p>
                <button
                  type="button"
                  className="btn btn-primary btn-sm rounded-pill px-4 mx-auto"
                  onClick={() => setShowAddForm(true)}
                >
                  <Plus size={16} className="me-1 inline" />
                  Register First Appliance
                </button>
              </div>
            ) : (
              /* Appliance List Grid */
              <div className="row g-3">
                {appliances.map((app) => {
                  const isExpiringSoon =
                    app.warrantyExpiry &&
                    new Date(app.warrantyExpiry) > new Date() &&
                    new Date(app.warrantyExpiry).getTime() - Date.now() < 30 * 24 * 3600 * 1000;
                  const isExpired = app.warrantyExpiry && new Date(app.warrantyExpiry) <= new Date();

                  return (
                    <div key={app._id} className="col-12 col-md-6">
                      <div
                        className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100 position-relative transition-hover cursor-pointer"
                        style={{ borderLeft: '4px solid #3b82f6' }}
                        onClick={() => setSelectedAppliance(app)}
                      >
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <div className="d-flex align-items-center gap-2">
                            <span className="fs-4">{CATEGORY_ICONS[app.category] || '📦'}</span>
                            <div>
                              <h6 className="fw-bold mb-0 text-dark">
                                {app.brand} {app.category}
                              </h6>
                              <span className="badge bg-light text-secondary border small" style={{ fontSize: '0.68rem' }}>
                                {app.qrCodeId}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-link text-danger p-0"
                            onClick={(e) => handleDelete(app._id, e)}
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        <div className="small text-muted mb-2" style={{ fontSize: '0.78rem' }}>
                          {app.modelNumber && <div><strong>Model:</strong> {app.modelNumber}</div>}
                          {app.capacityOrSpecs && <div><strong>Specs:</strong> {app.capacityOrSpecs}</div>}
                        </div>

                        {/* Warranty Status */}
                        <div className="d-flex align-items-center justify-content-between pt-2 border-top">
                          <span style={{ fontSize: '0.72rem' }}>
                            {app.warrantyExpiry ? (
                              isExpired ? (
                                <span className="text-danger fw-bold">Warranty Expired</span>
                              ) : isExpiringSoon ? (
                                <span className="text-warning fw-bold">Warranty Expiring Soon!</span>
                              ) : (
                                <span className="text-success fw-bold">
                                  Warranty active until {new Date(app.warrantyExpiry).toLocaleDateString()}
                                </span>
                              )
                            ) : (
                              <span className="text-muted">No warranty date set</span>
                            )}
                          </span>

                          {onSelectAppliance && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary rounded-pill py-0 px-2"
                              style={{ fontSize: '0.72rem' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectAppliance(app);
                                onClose();
                              }}
                            >
                              Book Service
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Appliance Details & Service History Drawer/Modal */}
            {selectedAppliance && (
              <div className="card border-0 shadow rounded-4 p-4 mt-4 bg-white">
                <div className="d-flex justify-content-between align-items-start mb-3">
                  <div>
                    <span className="badge bg-primary text-white rounded-pill px-3 py-1 mb-1">
                      {selectedAppliance.qrCodeId}
                    </span>
                    <h5 className="fw-bold mb-0 text-dark">
                      {selectedAppliance.brand} {selectedAppliance.category}
                    </h5>
                    <small className="text-muted">
                      {selectedAppliance.capacityOrSpecs} | Model: {selectedAppliance.modelNumber || 'N/A'}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => setSelectedAppliance(null)}
                  >
                    Close Passport
                  </button>
                </div>

                <h6 className="fw-bold small text-uppercase text-secondary mb-2">
                  Service & Maintenance History ({selectedAppliance.serviceHistory?.length || 0})
                </h6>

                {(!selectedAppliance.serviceHistory || selectedAppliance.serviceHistory.length === 0) ? (
                  <p className="small text-muted bg-light p-3 rounded-3 mb-0">
                    No repairs logged yet. When you complete a booking for this appliance, SmartFix
                    automatically appends technician notes and maintenance records here.
                  </p>
                ) : (
                  <div className="list-group list-group-flush">
                    {selectedAppliance.serviceHistory.map((item, idx) => (
                      <div key={idx} className="list-group-item px-0 py-2">
                        <div className="d-flex justify-content-between align-items-center">
                          <strong className="small text-dark">{item.description}</strong>
                          <span className="small text-muted">{new Date(item.date).toLocaleDateString()}</span>
                        </div>
                        <div className="small text-secondary d-flex gap-3">
                          <span>Technician: {item.workerName}</span>
                          {item.cost > 0 && <span>Cost: ₹{item.cost}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
