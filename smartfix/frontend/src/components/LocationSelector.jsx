import { useState, useEffect } from 'react';
import { MapPin } from 'lucide-react';
import './LocationSelector.css';

const LocationSelector = ({ value, onChange, placeholder, required = false }) => {
  const [district, setDistrict] = useState('');
  const [taluk, setTaluk] = useState('');
  const [village, setVillage] = useState('');

  useEffect(() => {
    if (value && typeof value === 'string' && !district && !taluk && !village) {
      const parts = value.split(',').map(p => p.trim());
      // Parts were usually stored as: "village, taluk, district, Tamil Nadu"
      if (parts.length >= 4) {
        setVillage(parts[0] || '');
        setTaluk(parts[1] || '');
        setDistrict(parts[2] || '');
      } else if (parts.length === 3) {
        setTaluk(parts[0] || '');
        setDistrict(parts[1] || '');
      } else if (parts.length === 2) {
        setDistrict(parts[0] || '');
      } else if (parts.length === 1) {
        setDistrict(parts[0] || '');
      }
    }
  }, [value, district, taluk, village]);

  const triggerChange = (dName, tName, vName) => {
    let parts = [];
    if (vName) parts.push(vName);
    if (tName) parts.push(tName);
    if (dName) parts.push(dName);
    
    let fullLocation = parts.length > 0 ? `${parts.join(', ')}, Tamil Nadu` : '';

    if (onChange) {
      onChange({
        target: {
          name: 'location',
          value: fullLocation
        }
      });
    }
  };

  const handleDistrictChange = (e) => {
    const val = e.target.value;
    setDistrict(val);
    triggerChange(val, taluk, village);
  };

  const handleTalukChange = (e) => {
    const val = e.target.value;
    setTaluk(val);
    triggerChange(district, val, village);
  };

  const handleVillageChange = (e) => {
    const val = e.target.value;
    setVillage(val);
    triggerChange(district, taluk, val);
  };

  return (
    <div className="location-selector">
      <div className="location-group">
        <label><MapPin size={14} /> District {required && <span className="req">*</span>}</label>
        <div className="select-wrapper">
          <input 
            type="text"
            className="manual-location-input"
            placeholder="Enter District"
            value={district} 
            onChange={handleDistrictChange} 
            required={required}
          />
        </div>
      </div>

      <div className="location-group">
        <label>Taluk / City {required && <span className="req">*</span>}</label>
        <div className="select-wrapper">
          <input 
            type="text"
            className="manual-location-input"
            placeholder="Enter Taluk / City"
            value={taluk} 
            onChange={handleTalukChange} 
            required={required}
          />
        </div>
      </div>

      <div className="location-group">
        <label>Village / Area {required && <span className="req">*</span>}</label>
        <div className="select-wrapper">
          <input 
            type="text"
            className="manual-location-input"
            placeholder="Enter Village / Area"
            value={village} 
            onChange={handleVillageChange} 
            required={required}
          />
        </div>
      </div>
    </div>
  );
};

export default LocationSelector;
