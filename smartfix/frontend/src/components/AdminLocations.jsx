import React, { useState, useEffect } from 'react';
import { apiService, getApiBase } from '../services/api';
import { MapPin, CheckCircle2, XCircle, Search, Save, AlertTriangle, Plus } from 'lucide-react';
import './AdminLocations.css';

const AdminLocations = () => {
  const [districts, setDistricts] = useState([]);
  const [taluks, setTaluks] = useState([]);
  const [villages, setVillages] = useState([]);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [selectedTaluk, setSelectedTaluk] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionToast, setActionToast] = useState('');
  
  // Edit States
  const [editingTaluk, setEditingTaluk] = useState(null);
  const [radiusKm, setRadiusKm] = useState(20);
  
  const [addingVillage, setAddingVillage] = useState(false);
  const [newVillage, setNewVillage] = useState({ nameEn: '', nameTa: '', pincode: '', lat: '', lng: '' });

  useEffect(() => {
    loadDistricts();
  }, []);

  const loadDistricts = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('smartfix_token');
      const res = await fetch(`${getApiBase()}/admin/locations/districts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDistricts(data.districts || (Array.isArray(data) ? data : []));
      }
    } catch (error) {
      console.error("Failed to load districts", error);
    } finally {
      setLoading(false);
    }
  };

  const loadTaluks = async (districtId) => {
    try {
      const res = await fetch(`${getApiBase()}/locations/districts/${districtId}/taluks`);
      if (res.ok) {
        const data = await res.json();
        setTaluks(data.taluks || (Array.isArray(data) ? data : []));
        setSelectedTaluk(null);
        setVillages([]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadVillages = async (talukId) => {
    try {
      const res = await fetch(`${getApiBase()}/locations/taluks/${talukId}/villages`);
      if (res.ok) {
        const data = await res.json();
        setVillages(data.villages || (Array.isArray(data) ? data : []));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDistrictSelect = (d) => {
    setSelectedDistrict(d);
    loadTaluks(d._id || d.id);
  };

  const handleTalukSelect = (t) => {
    setSelectedTaluk(t);
    loadVillages(t._id || t.id);
  };

  const showToast = (msg) => {
    setActionToast(msg);
    setTimeout(() => setActionToast(''), 4000);
  };

  const toggleDistrictActive = async (dId, confirmActivation = false) => {
    try {
      const token = localStorage.getItem('smartfix_token');
      const res = await fetch(`${getApiBase()}/admin/locations/districts/${dId}/toggle-active`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmActivation })
      });
      const data = await res.json();
      if (data.requiresConfirmation) {
        if (window.confirm(data.message)) {
          toggleDistrictActive(dId, true);
        }
      } else if (data.success) {
        showToast(data.message);
        loadDistricts();
      } else {
        alert(data.message);
      }
    } catch (error) {
      alert("Error toggling district status");
    }
  };

  const saveTalukRadius = async () => {
    try {
      const token = localStorage.getItem('smartfix_token');
      const res = await fetch(`${getApiBase()}/admin/locations/taluks/${editingTaluk._id || editingTaluk.id}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ radiusKm: Number(radiusKm) })
      });
      if (res.ok) {
        showToast("Taluk radius updated!");
        setEditingTaluk(null);
        loadTaluks(selectedDistrict._id || selectedDistrict.id);
      }
    } catch (error) {
      alert("Error updating taluk");
    }
  };

  const handleAddVillage = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('smartfix_token');
      const res = await fetch(`${getApiBase()}/admin/locations/villages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          talukId: selectedTaluk._id || selectedTaluk.id,
          name: { en: newVillage.nameEn, ta: newVillage.nameTa },
          pincode: newVillage.pincode,
          lat: newVillage.lat,
          lng: newVillage.lng,
          kind: 'village'
        })
      });
      if (res.ok) {
        showToast("Village added!");
        setAddingVillage(false);
        setNewVillage({ nameEn: '', nameTa: '', pincode: '', lat: '', lng: '' });
        loadVillages(selectedTaluk._id || selectedTaluk.id);
      }
    } catch (error) {
      alert("Error adding village");
    }
  };

  const toggleVillageActive = async (vId, isActive) => {
    try {
      const token = localStorage.getItem('smartfix_token');
      const res = await fetch(`${getApiBase()}/admin/locations/villages/${vId}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive })
      });
      if (res.ok) {
        showToast("Village status updated");
        loadVillages(selectedTaluk._id || selectedTaluk.id);
      }
    } catch (error) {
      alert("Error updating village");
    }
  };

  if (loading) return <div>Loading Locations...</div>;

  return (
    <div className="admin-locations-container">
      {actionToast && <div className="admin-toast">{actionToast}</div>}

      <div className="locations-grid">
        {/* DISTRICTS LIST */}
        <div className="location-panel">
          <h3><MapPin size={18} /> Tamil Nadu Districts</h3>
          <div className="location-list">
            {districts.map(d => (
              <div key={d._id} className={`location-item ${selectedDistrict?._id === d._id ? 'selected' : ''}`} onClick={() => handleDistrictSelect(d)}>
                <div className="item-info">
                  <span className="item-name">{d.name.en} <small>({d.name.ta})</small></span>
                  <span className={`status-badge ${d.isServiceActive ? 'active' : 'inactive'}`}>
                    {d.isServiceActive ? 'Active' : 'Coming Soon'}
                  </span>
                </div>
                <button 
                  className={`toggle-btn ${d.isServiceActive ? 'btn-danger' : 'btn-success'}`}
                  onClick={(e) => { e.stopPropagation(); toggleDistrictActive(d._id); }}
                >
                  {d.isServiceActive ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* TALUKS LIST */}
        <div className="location-panel">
          <h3>Taluks {selectedDistrict ? `in ${selectedDistrict.name.en}` : ''}</h3>
          {!selectedDistrict ? (
            <p className="placeholder-text">Select a district to view taluks</p>
          ) : (
            <div className="location-list">
              {taluks.length === 0 && <p className="placeholder-text">No taluks found</p>}
              {taluks.map(t => (
                <div key={t._id} className={`location-item ${selectedTaluk?._id === t._id ? 'selected' : ''}`} onClick={() => handleTalukSelect(t)}>
                  <div className="item-info">
                    <span className="item-name">{t.name.en}</span>
                    <small>Radius: {t.radiusKm || 20} km</small>
                  </div>
                  <button 
                    className="toggle-btn btn-secondary"
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setEditingTaluk(t); 
                      setRadiusKm(t.radiusKm || 20); 
                    }}
                  >
                    Edit
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* VILLAGES LIST */}
        <div className="location-panel">
          <h3>Villages/Towns {selectedTaluk ? `in ${selectedTaluk.name.en}` : ''}</h3>
          {!selectedTaluk ? (
            <p className="placeholder-text">Select a taluk to view villages</p>
          ) : (
            <div className="location-list">
              <button className="add-btn" onClick={() => setAddingVillage(!addingVillage)}>
                <Plus size={16} /> Add Custom Village
              </button>
              
              {addingVillage && (
                <form className="add-village-form" onSubmit={handleAddVillage}>
                  <input placeholder="Name (English)" value={newVillage.nameEn} onChange={e => setNewVillage({...newVillage, nameEn: e.target.value})} required />
                  <input placeholder="Name (Tamil)" value={newVillage.nameTa} onChange={e => setNewVillage({...newVillage, nameTa: e.target.value})} required />
                  <input placeholder="Pincode" value={newVillage.pincode} onChange={e => setNewVillage({...newVillage, pincode: e.target.value})} />
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <input type="number" step="any" placeholder="Lat" value={newVillage.lat} onChange={e => setNewVillage({...newVillage, lat: e.target.value})} required />
                    <input type="number" step="any" placeholder="Lng" value={newVillage.lng} onChange={e => setNewVillage({...newVillage, lng: e.target.value})} required />
                  </div>
                  <div className="form-actions">
                    <button type="submit" className="btn-success">Save</button>
                    <button type="button" className="btn-secondary" onClick={() => setAddingVillage(false)}>Cancel</button>
                  </div>
                </form>
              )}

              {villages.length === 0 && <p className="placeholder-text">No villages found</p>}
              {villages.map(v => (
                <div key={v._id} className="location-item">
                  <div className="item-info">
                    <span className="item-name">{v.name.en} <small className={v.isActive !== false ? 'text-success' : 'text-danger'}>
                      {v.isActive !== false ? 'Active' : 'Disabled'}
                    </small></span>
                    <small>Pin: {v.pincode || 'N/A'}</small>
                  </div>
                  <button 
                    className={`toggle-btn ${v.isActive !== false ? 'btn-danger' : 'btn-success'}`}
                    onClick={() => toggleVillageActive(v._id, v.isActive !== false)}
                  >
                    {v.isActive !== false ? 'Disable' : 'Enable'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {editingTaluk && (
        <div className="modal-backdrop">
          <div className="edit-modal">
            <h4>Edit Taluk: {editingTaluk.name.en}</h4>
            <div className="form-group">
              <label>Service Radius (km)</label>
              <input type="number" value={radiusKm} onChange={(e) => setRadiusKm(e.target.value)} />
            </div>
            <div className="modal-actions">
              <button onClick={saveTalukRadius} className="btn-success">Save</button>
              <button onClick={() => setEditingTaluk(null)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLocations;
