import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import LocationSelector from './LocationSelector';

const ProfileCompletion = () => {
  const { user, updateProfile, logout } = useAuth();
  const [form, setForm] = useState({
    phone: '',
    location: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.phone || !/^\d{10}$/.test(form.phone.replace(/\D/g, ''))) {
      setError('Please enter a valid 10-digit phone number.');
      return;
    }
    if (!form.location) {
      setError('Please select your location.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      // Send the update to profile endpoint
      await updateProfile({
        phone: `+91${form.phone.replace(/\D/g, '')}`,
        location: form.location,
      });
      // Force reload to let ProtectedRoute re-evaluate with updated user data
      window.location.reload(); 
    } catch (err) {
      setError(err.message || 'Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center', 
      minHeight: '100vh', backgroundColor: '#f8f9fa'
    }}>
      <div style={{
        background: '#fff', padding: '30px', borderRadius: '10px', 
        boxShadow: '0 4px 15px rgba(0,0,0,0.1)', maxWidth: '400px', width: '100%'
      }}>
        <h3 style={{ textAlign: 'center', marginBottom: '20px' }}>Complete Your Profile</h3>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: '20px' }}>
          Welcome <b>{user?.name}</b>! Please provide a few more details to continue.
        </p>
        
        {error && <div className="alert alert-danger" style={{ padding: '10px', fontSize: '14px', borderRadius: '5px', backgroundColor: '#f8d7da', color: '#721c24', marginBottom: '15px' }}>{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Phone Number *</label>
            <input 
              type="text" 
              placeholder="e.g. 9876543210" 
              value={form.phone} 
              onChange={(e) => setForm({ ...form, phone: e.target.value })} 
              style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '5px' }}
              required 
            />
          </div>
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Location *</label>
            <LocationSelector 
              value={form.location}
              onChange={(loc) => setForm({ ...form, location: loc })} 
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            style={{
              width: '100%', padding: '12px', backgroundColor: '#0d6efd', color: '#fff', 
              border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer'
            }}
          >
            {loading ? 'Saving...' : 'Save & Continue'}
          </button>

          <button 
            type="button" 
            onClick={logout}
            style={{
              width: '100%', padding: '12px', backgroundColor: 'transparent', color: '#dc3545', 
              border: 'none', marginTop: '10px', fontWeight: 'bold', cursor: 'pointer'
            }}
          >
            Cancel & Logout
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProfileCompletion;
