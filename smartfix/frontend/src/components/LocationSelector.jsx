import { useState, useEffect } from 'react';
import { MapPin } from 'lucide-react';
import tnLocations from '../data/tamilnadu-locations.json';
import './LocationSelector.css';

const LocationSelector = ({ value, onChange, placeholder, required = false }) => {
  const [district, setDistrict] = useState('');
  const [taluk, setTaluk] = useState('');
  const [village, setVillage] = useState('');

  // Parse existing value if it matches the format "Village, Taluk, District, Tamil Nadu"
  useEffect(() => {
    if (value && typeof value === 'string') {
      const parts = value.split(',').map(p => p.trim());
      if (parts.length >= 3) {
        // Simple heuristic for parsing reverse
        const v = parts[0];
        const t = parts[1];
        const d = parts[2];
        
        if (tnLocations[d]) {
          setDistrict(d);
          if (tnLocations[d][t]) {
            setTaluk(t);
            if (tnLocations[d][t].includes(v)) {
              setVillage(v);
            }
          }
        }
      }
    }
  }, [value]);

  const handleDistrictChange = (e) => {
    const d = e.target.value;
    setDistrict(d);
    setTaluk('');
    setVillage('');
    triggerChange(d, '', '');
  };

  const handleTalukChange = (e) => {
    const t = e.target.value;
    setTaluk(t);
    setVillage('');
    triggerChange(district, t, '');
  };

  const handleVillageChange = (e) => {
    const v = e.target.value;
    setVillage(v);
    triggerChange(district, taluk, v);
  };

  const triggerChange = (d, t, v) => {
    let fullLocation = '';
    if (v) fullLocation = `${v}, ${t}, ${d}, Tamil Nadu`;
    else if (t) fullLocation = `${t}, ${d}, Tamil Nadu`;
    else if (d) fullLocation = `${d}, Tamil Nadu`;

    // Pass back to parent via onChange simulating an event object
    onChange({
      target: {
        name: 'location',
        value: fullLocation
      }
    });
  };

  const districts = Object.keys(tnLocations);
  const taluks = district && tnLocations[district] ? Object.keys(tnLocations[district]) : [];
  const villages = taluk && district && tnLocations[district][taluk] ? tnLocations[district][taluk] : [];

  return (
    <div className="location-selector">
      <div className="location-group">
        <label><MapPin size={14} /> District {required && <span className="req">*</span>}</label>
        <select value={district} onChange={handleDistrictChange} required={required}>
          <option value="">-- Select District --</option>
          {districts.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div className="location-group">
        <label>Taluk / City {required && <span className="req">*</span>}</label>
        <select value={taluk} onChange={handleTalukChange} disabled={!district} required={required}>
          <option value="">-- Select Taluk --</option>
          {taluks.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="location-group">
        <label>Village / Area {required && <span className="req">*</span>}</label>
        <select value={village} onChange={handleVillageChange} disabled={!taluk} required={required}>
          <option value="">-- Select Area --</option>
          {villages.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>
    </div>
  );
};

export default LocationSelector;
