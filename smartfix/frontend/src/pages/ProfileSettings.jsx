import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { HOME_SERVICES } from '../data/servicesData';
import { User, Phone, MapPin, Wrench, ShieldCheck, CheckSquare, Square, Lock, Bell, CheckCircle2, Save, Globe, Trash2, AlertTriangle, Sun, Moon } from 'lucide-react';
import './ProfileSettings.css';

const ProfileSettings = () => {
  const navigate = useNavigate();
  const { user, updateProfile, deleteAccount } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { theme, setTheme, toggleTheme } = useTheme();

  const [activeTab, setActiveTab] = useState('general'); // 'general' | 'handyman' | 'security' | 'notifications' | 'danger'
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Delete Account Modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    location: user?.location || 'Sivagangai, Tamil Nadu',
    preferredLanguage: user?.preferredLanguage || language || 'en',
    theme: user?.theme || theme || 'light',
    // Handyman fields
    trade: user?.trade || 'Plumbing',
    subServices: user?.subServices || [],
    ratePerHour: user?.ratePerHour || 350,
    isAvailable: user?.isAvailable !== undefined ? user.isAvailable : true,
    bioEn: user?.bioEn || '',
    bioTa: user?.bioTa || '',
    // Password fields
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    // Preferences
    smsAlerts: true,
    whatsappAlerts: true,
  });

  useEffect(() => {
    if (user) {
      setForm((prev) => ({
        ...prev,
        name: user.name || prev.name,
        phone: user.phone || prev.phone,
        location: user.location || prev.location,
        trade: user.trade || prev.trade,
        subServices: user.subServices || prev.subServices,
        ratePerHour: user.ratePerHour || prev.ratePerHour,
        isAvailable: user.isAvailable !== undefined ? user.isAvailable : prev.isAvailable,
        bioEn: user.bioEn !== undefined ? user.bioEn : prev.bioEn,
        bioTa: user.bioTa !== undefined ? user.bioTa : prev.bioTa,
      }));
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setErrorMsg('');
  };

  const handleSubServiceToggle = (sub) => {
    setForm((prev) => {
      const exists = prev.subServices.includes(sub);
      const updated = exists
        ? prev.subServices.filter((s) => s !== sub)
        : [...prev.subServices, sub];
      return { ...prev, subServices: updated };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (activeTab === 'security' && form.newPassword) {
      if (form.newPassword.length < 6) {
        setErrorMsg('New password must be at least 6 characters long.');
        return;
      }
      if (form.newPassword !== form.confirmPassword) {
        setErrorMsg('New passwords do not match.');
        return;
      }
    }

    try {
      setSubmitting(true);
      await updateProfile({
        name: form.name,
        phone: form.phone,
        location: form.location,
        preferredLanguage: form.preferredLanguage,
        theme: form.theme,
        ...(user?.role === 'handyman' && {
          trade: form.trade,
          subServices: form.subServices,
          ratePerHour: Number(form.ratePerHour),
          isAvailable: form.isAvailable,
          bioEn: form.bioEn,
          bioTa: form.bioTa,
        }),
        ...(form.newPassword && { newPassword: form.newPassword }),
      });

      if (form.preferredLanguage) setLanguage(form.preferredLanguage);
      if (form.theme) setTheme(form.theme);

      setSuccessMsg('✅ Profile & settings updated successfully!');
      setForm((prev) => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
      setTimeout(() => setSuccessMsg(''), 4500);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update profile.');
    } finally {
      setSubmitting(false);
    }
  };

  // Permanent Account Deletion Handler (FOR USER, WORKER/HANDYMAN & CUSTOMER - NOT FOR ADMIN)
  const handlePermanentDeleteAccount = async () => {
    if (user?.role === 'admin') {
      setErrorMsg('Admin accounts cannot be deleted from settings.');
      return;
    }

    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
      setErrorMsg('Please type DELETE to confirm permanent account deletion.');
      return;
    }

    try {
      setDeletingAccount(true);
      await deleteAccount();
      alert('Your account has been deleted permanently.');
      navigate('/login');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to delete account. Please try again.');
      setDeletingAccount(false);
    }
  };

  const selectedCategoryObj = HOME_SERVICES.find((s) => s.name === form.trade) || HOME_SERVICES[0];

  return (
    <div className="container profile-settings-page">
      {/* Header Banner */}
      <div className="profile-header-banner">
        <div className="user-profile-header-left">
          <div className="profile-avatar-circle">
            {user?.role === 'handyman' ? '👨‍🔧' : user?.role === 'admin' ? '🛡️' : '👤'}
          </div>
          <div>
            <h1>{user?.name || 'User Profile'}</h1>
            <p className="profile-sub-info">
              <Phone size={14} /> {user?.phone || '+91 98765 43210'} • <MapPin size={14} /> {user?.location || 'Sivagangai, Tamil Nadu'}
            </p>
          </div>
        </div>

        <div className="user-role-badge-large">
          <ShieldCheck size={18} /> {user?.role === 'handyman' ? '🛠️ Handyman Pro' : user?.role === 'admin' ? '⚡ Platform Administrator' : '👤 Customer Account'}
        </div>
      </div>

      {successMsg && (
        <div className="profile-toast-success">
          <CheckCircle2 size={20} /> {successMsg}
        </div>
      )}

      {errorMsg && <div className="profile-toast-error">{errorMsg}</div>}

      {/* Main Settings Card */}
      <div className="profile-settings-card">
        {/* Settings Sidebar Tabs */}
        <div className="settings-tabs-sidebar">
          <button
            type="button"
            className={`settings-tab-btn ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            <User size={18} /> General Details
          </button>

          {user?.role === 'handyman' && (
            <>
              <button
                type="button"
                className={`settings-tab-btn ${activeTab === 'handyman' ? 'active' : ''}`}
                onClick={() => setActiveTab('handyman')}
              >
                <Wrench size={18} /> Trade & Skills
              </button>
              <button
                type="button"
                className={`settings-tab-btn ${activeTab === 'kyc' ? 'active' : ''}`}
                onClick={() => setActiveTab('kyc')}
              >
                <ShieldCheck size={18} /> Document Verification
              </button>
            </>
          )}

          <button
            type="button"
            className={`settings-tab-btn ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
          >
            <Lock size={18} /> Account Security
          </button>

          <button
            type="button"
            className={`settings-tab-btn ${activeTab === 'notifications' ? 'active' : ''}`}
            onClick={() => setActiveTab('notifications')}
          >
            <Bell size={18} /> Notifications
          </button>

          {/* DANGER ZONE TAB: STRICTLY HIDDEN FOR ADMIN */}
          {user?.role !== 'admin' && (
            <button
              type="button"
              className={`settings-tab-btn tab-danger ${activeTab === 'danger' ? 'active' : ''}`}
              onClick={() => setActiveTab('danger')}
            >
              <Trash2 size={18} /> Danger Zone
            </button>
          )}
        </div>

        {/* Tab Content Area */}
        <div className="settings-tab-content">
          <form onSubmit={handleSubmit}>
            {/* GENERAL DETAILS TAB */}
            {activeTab === 'general' && (
              <div className="tab-pane">
                <h3 className="tab-pane-title"><User size={20} /> Personal Information</h3>
                <p className="tab-pane-desc">Manage your basic profile information and service location.</p>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label><User size={15} /> Full Name</label>
                    <input
                      type="text"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="Your full name"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label><Phone size={15} /> Mobile Phone Number</label>
                    <input
                      type="tel"
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      placeholder="10-digit mobile number"
                      required
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label><MapPin size={15} /> Primary Address / City</label>
                    <input
                      type="text"
                      name="location"
                      value={form.location}
                      onChange={handleChange}
                      placeholder="e.g. Sivagangai Town / Karaikudi"
                    />
                  </div>

                  <div className="form-group">
                    <label><Globe size={15} /> {t('select_language')}</label>
                    <select
                      name="preferredLanguage"
                      value={form.preferredLanguage}
                      onChange={(e) => {
                        handleChange(e);
                        setLanguage(e.target.value);
                      }}
                    >
                      <option value="en">English (Default)</option>
                      <option value="ta">தமிழ் (Tamil)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>
                      {form.theme === 'dark' ? <Moon size={15} /> : <Sun size={15} />} Site Theme Mode
                    </label>
                    <select
                      name="theme"
                      value={form.theme}
                      onChange={(e) => {
                        handleChange(e);
                        setTheme(e.target.value);
                      }}
                    >
                      <option value="light">☀️ Light Mode</option>
                      <option value="dark">🌙 Dark Mode</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* HANDYMAN TRADE & SKILLS TAB */}
            {activeTab === 'handyman' && user?.role === 'handyman' && (
              <div className="tab-pane">
                <h3 className="tab-pane-title"><Wrench size={20} /> Trade Category & Service Rates</h3>
                <p className="tab-pane-desc">Customize your handyman trade specialization, rates, and availability.</p>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label><Wrench size={15} /> Primary Trade</label>
                    <select name="trade" value={form.trade} onChange={handleChange}>
                      {HOME_SERVICES.map((cat) => (
                        <option key={cat.id} value={cat.name}>
                          {cat.icon} {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Hourly Service Rate (₹)</label>
                    <input
                      type="number"
                      name="ratePerHour"
                      value={form.ratePerHour}
                      onChange={handleChange}
                      placeholder="350"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="sub-services-title">Specialized Sub-Services Offered:</label>
                  <div className="sub-services-grid">
                    {selectedCategoryObj.subServices.map((sub) => {
                      const isChecked = form.subServices.includes(sub);
                      return (
                        <div
                          key={sub}
                          className={`sub-chip ${isChecked ? 'selected' : ''}`}
                          onClick={() => handleSubServiceToggle(sub)}
                        >
                          {isChecked ? <CheckSquare size={14} /> : <Square size={14} />}
                          <span>{sub}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="availability-toggle-card">
                  <div>
                    <strong>Online Availability Status</strong>
                    <p>Toggle to receive new customer job ticket requests in real-time.</p>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      name="isAvailable"
                      checked={form.isAvailable}
                      onChange={handleChange}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>

                <div className="form-group" style={{ marginTop: '20px' }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span><User size={15} style={{ marginRight: '5px', verticalAlign: '-2px' }} /> Public Bio (English)</span>
                    <span style={{ fontSize: '0.8rem', color: '#6366f1', background: '#e0e7ff', padding: '2px 8px', borderRadius: '10px' }}>✨ AI-generated — edit as needed</span>
                  </label>
                  <textarea
                    name="bioEn"
                    value={form.bioEn}
                    onChange={handleChange}
                    placeholder="Brief professional bio..."
                    rows={3}
                    maxLength={400}
                  />
                  <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#64748b' }}>{form.bioEn?.length || 0}/400</div>
                </div>

                <div className="form-group" style={{ marginTop: '10px' }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span><Globe size={15} style={{ marginRight: '5px', verticalAlign: '-2px' }} /> Public Bio (Tamil)</span>
                    <span style={{ fontSize: '0.8rem', color: '#6366f1', background: '#e0e7ff', padding: '2px 8px', borderRadius: '10px' }}>✨ AI-generated — edit as needed</span>
                  </label>
                  <textarea
                    name="bioTa"
                    value={form.bioTa}
                    onChange={handleChange}
                    placeholder="சுருக்கமான தொழில்முறை சுயவிவரம்..."
                    rows={3}
                    maxLength={400}
                  />
                  <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#64748b' }}>{form.bioTa?.length || 0}/400</div>
                </div>
              </div>
            )}

            {/* HANDYMAN DOCS TAB */}
            {activeTab === 'kyc' && user?.role === 'handyman' && (
              <div className="tab-pane">
                <h3 className="tab-pane-title"><ShieldCheck size={20} /> Document & Identity Verification</h3>
                <p className="tab-pane-desc">Upload required government ID, license, and service registration to go live.</p>

                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '14px', borderRadius: '12px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <ShieldCheck size={24} color="#059669" />
                  <div>
                    <strong style={{ color: '#166534' }}>Verification Status: VERIFIED HANDYMAN 🟢</strong>
                    <p style={{ margin: 0, fontSize: '0.83rem', color: '#15803d' }}>All documents are active and approved for service dispatch requests.</p>
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Aadhaar Card Number (12 digits)</label>
                    <input
                      type="text"
                      placeholder="9876 5432 1098"
                      defaultValue="9876 5432 1098"
                    />
                  </div>

                  <div className="form-group">
                    <label>Driving License / Govt ID Number</label>
                    <input
                      type="text"
                      placeholder="TN-59-2022-00984"
                      defaultValue="TN-59-2022-00984"
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Vehicle / Transport Registration No.</label>
                    <input
                      type="text"
                      placeholder="TN 59 BX 4321"
                      defaultValue="TN 59 BX 4321"
                    />
                  </div>

                  <div className="form-group">
                    <label>Insurance / Guarantee Policy No.</label>
                    <input
                      type="text"
                      placeholder="POL-9948-2026"
                      defaultValue="POL-9948-2026"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ACCOUNT SECURITY TAB */}
            {activeTab === 'security' && (
              <div className="tab-pane">
                <h3 className="tab-pane-title"><Lock size={20} /> Change Password</h3>
                <p className="tab-pane-desc">Ensure your account is protected with a strong password.</p>

                <div className="form-group">
                  <label><Lock size={15} /> New Password</label>
                  <input
                    type="password"
                    name="newPassword"
                    value={form.newPassword}
                    onChange={handleChange}
                    placeholder="Enter new password (min 6 characters)"
                  />
                </div>

                <div className="form-group">
                  <label><Lock size={15} /> Confirm New Password</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    placeholder="Re-enter new password"
                  />
                </div>

                {/* DANGER ZONE IN SECURITY TAB (NOT FOR ADMIN) */}
                {user?.role !== 'admin' && (
                  <div className="danger-account-card" style={{ marginTop: '2rem' }}>
                    <div className="danger-card-header">
                      <Trash2 size={24} color="#dc2626" />
                      <div>
                        <h4>Delete Account Permanently</h4>
                        <p>Permanently remove your account, profile, and all service history.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-danger-delete"
                      onClick={() => setShowDeleteModal(true)}
                    >
                      <Trash2 size={16} /> Delete Account
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* NOTIFICATIONS TAB */}
            {activeTab === 'notifications' && (
              <div className="tab-pane">
                <h3 className="tab-pane-title"><Bell size={20} /> Notification Preferences</h3>
                <p className="tab-pane-desc">Choose how you want to be notified about bookings and job updates.</p>

                <div className="pref-row">
                  <div>
                    <strong>Real-Time SMS Alerts</strong>
                    <p>Receive SMS notifications for job status updates and OTP verification.</p>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      name="smsAlerts"
                      checked={form.smsAlerts}
                      onChange={handleChange}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>

                <div className="pref-row">
                  <div>
                    <strong>WhatsApp Job Dispatch</strong>
                    <p>Directly chat with handymen and customers on WhatsApp.</p>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      name="whatsappAlerts"
                      checked={form.whatsappAlerts}
                      onChange={handleChange}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>
              </div>
            )}

            {/* DANGER ZONE DEDICATED TAB (FOR CUSTOMER, HANDYMAN, USER - NOT FOR ADMIN) */}
            {activeTab === 'danger' && user?.role !== 'admin' && (
              <div className="tab-pane">
                <h3 className="tab-pane-title danger-title">
                  <AlertTriangle size={22} color="#dc2626" /> Danger Zone: Permanent Account Deletion
                </h3>
                <p className="tab-pane-desc">
                  Permanently delete your account and erase all associated profile data, active job tickets, and history. This action cannot be undone.
                </p>

                <div className="danger-account-card">
                  <div className="danger-card-header">
                    <Trash2 size={26} color="#dc2626" />
                    <div>
                      <h4>Delete Account ({user?.role === 'handyman' ? 'Handyman Pro' : 'Customer Account'})</h4>
                      <p>
                        Once deleted, your account cannot be recovered. You will be logged out immediately.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-danger-delete"
                    onClick={() => setShowDeleteModal(true)}
                  >
                    <Trash2 size={16} /> Delete Account Permanently
                  </button>
                </div>
              </div>
            )}

            {/* Submit Action Button Bar (Only shown on saveable tabs) */}
            {activeTab !== 'danger' && (
              <div className="settings-submit-bar">
                <button type="submit" className="save-profile-btn" disabled={submitting}>
                  <Save size={18} /> {submitting ? 'Saving Changes...' : 'Save Profile & Settings'}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* DELETE ACCOUNT CONFIRMATION MODAL (STRICTLY HIDDEN FOR ADMIN) */}
      {showDeleteModal && user?.role !== 'admin' && (
        <div className="delete-modal-backdrop" onClick={() => !deletingAccount && setShowDeleteModal(false)}>
          <div className="delete-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="delete-modal-icon-wrap">
              <AlertTriangle size={32} color="#dc2626" />
            </div>
            <h3>Permanently Delete Account?</h3>
            <p className="delete-modal-warning">
              Are you sure you want to permanently delete your <strong>{user?.name}</strong> ({user?.phone}) account?
              All your profile data, addresses, and service history will be <strong>permanently erased</strong>.
            </p>

            <div className="delete-confirm-box">
              <label>Type <strong>DELETE</strong> below to confirm:</label>
              <input
                type="text"
                className="delete-input-confirm"
                placeholder="Type DELETE"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                disabled={deletingAccount}
              />
            </div>

            <div className="delete-modal-buttons">
              <button
                type="button"
                className="btn-cancel-modal"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText('');
                }}
                disabled={deletingAccount}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-confirm-modal-delete"
                disabled={deleteConfirmText.trim().toUpperCase() !== 'DELETE' || deletingAccount}
                onClick={handlePermanentDeleteAccount}
              >
                {deletingAccount ? 'Deleting Account...' : 'Yes, Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileSettings;
