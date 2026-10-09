import { useState, useEffect } from 'react';
import { MapPin, Loader } from 'lucide-react';
import './LocationSelector.css';

const getApiBase = () => {
  if (import.meta.env?.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    return `${protocol}//${hostname}:5000/api`;
  }
  return 'http://localhost:5000/api';
};

const LocationSelector = ({ value, onChange, placeholder, required = false }) => {
  const [districts, setDistricts] = useState([]);
  const [taluks, setTaluks] = useState([]);
  const [villages, setVillages] = useState([]);

  const [district, setDistrict] = useState({ name: '', id: '' });
  const [taluk, setTaluk] = useState({ name: '', id: '' });
  const [village, setVillage] = useState({ name: '', id: '' });

  const [loadingDistrict, setLoadingDistrict] = useState(false);
  const [loadingTaluk, setLoadingTaluk] = useState(false);
  const [loadingVillage, setLoadingVillage] = useState(false);

  useEffect(() => {
    if (value && typeof value === 'string' && !district.name) {
      const parts = value.split(',').map(p => p.trim());
      if (parts.length >= 3) {
        setVillage({ name: parts[0], id: '' });
        setTaluk({ name: parts[1], id: '' });
        setDistrict({ name: parts[2], id: '' });
      }
    }
  }, [value, district.name]);

  useEffect(() => {
    const fetchDistricts = async () => {
      try {
        setLoadingDistrict(true);
        const response = await fetch(`${getApiBase()}/locations/districts`);
        if (response.ok) {
          const data = await response.json();
          setDistricts(data);
        }
      } catch (error) {
        console.error("District fetch error:", error);
      } finally {
        setLoadingDistrict(false);
      }
    };

    fetchDistricts();
  }, []);

  const triggerChange = (dName, tName, vName) => {
    let fullLocation = '';
    if (vName) fullLocation = `${vName}, ${tName}, ${dName}, Tamil Nadu`;
    else if (tName) fullLocation = `${tName}, ${dName}, Tamil Nadu`;
    else if (dName) fullLocation = `${dName}, Tamil Nadu`;

    onChange({
      target: {
        name: 'location',
        value: fullLocation
      }
    });
  };

  const handleDistrictChange = async (e) => {
    const districtId = e.target.value;
    const districtName = e.target.options[e.target.selectedIndex].text;
    
    setDistrict({ id: districtId, name: districtName });
    setTaluk({ id: '', name: '' });
    setVillage({ id: '', name: '' });
    setTaluks([]);
    setVillages([]);
    
    if (!districtId || districtId === 'custom') {
      triggerChange('', '', '');
      return;
    }
    
    triggerChange(districtName, '', '');

    try {
      setLoadingTaluk(true);
      const response = await fetch(`${getApiBase()}/locations/districts/${districtId}/taluks`);
      if (response.ok) {
        const data = await response.json();
        setTaluks(data);
      }
    } catch (error) {
      console.error("Taluk fetch error:", error);
    } finally {
      setLoadingTaluk(false);
    }
  };

  const handleTalukChange = async (e) => {
    const talukId = e.target.value;
    const talukName = e.target.options[e.target.selectedIndex].text;

    setTaluk({ id: talukId, name: talukName });
    setVillage({ id: '', name: '' });
    setVillages([]);

    if (!talukId || talukId === 'custom') {
      triggerChange(district.name, '', '');
      return;
    }

    triggerChange(district.name, talukName, '');

    try {
      setLoadingVillage(true);
      const response = await fetch(`${getApiBase()}/locations/taluks/${talukId}/villages`);
      if (response.ok) {
        const data = await response.json();
        setVillages(data);
      }
    } catch (error) {
      console.error("Village fetch error:", error);
    } finally {
      setLoadingVillage(false);
    }
  };

  const handleVillageChange = (e) => {
    const villageId = e.target.value;
    const villageName = e.target.options[e.target.selectedIndex].text;

    if (!villageId || villageId === 'custom') {
      setVillage({ id: '', name: '' });
      triggerChange(district.name, taluk.name, '');
      return;
    }

    setVillage({ id: villageId, name: villageName });
    triggerChange(district.name, taluk.name, villageName);
  };

  return (
    <div className="location-selector">
      <div className="location-group">
        <label><MapPin size={14} /> District {required && <span className="req">*</span>}</label>
        <div className="select-wrapper">
          <select 
            value={district.id || (district.name && !districts.find(d => d.name.en === district.name) ? "custom" : "")} 
            onChange={handleDistrictChange} 
            required={required}
          >
            <option value="">{loadingDistrict ? "Loading districts..." : "-- Select District --"}</option>
            {district.name && !district.id && !districts.find(d => d.name.en === district.name) && (
              <option value="custom" disabled>{district.name}</option>
            )}
            {districts.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name.en}
              </option>
            ))}
          </select>
          {loadingDistrict && <div className="loader-icon"><Loader size={16} /></div>}
        </div>
      </div>

      <div className="location-group">
        <label>Taluk / City {required && <span className="req">*</span>}</label>
        <div className="select-wrapper">
          <select 
            value={taluk.id || (taluk.name && !taluks.find(t => t.name.en === taluk.name) ? "custom" : "")} 
            onChange={handleTalukChange} 
            disabled={!district.id} 
            required={required}
          >
            <option value="">{loadingTaluk ? "Loading taluks..." : "-- Select Taluk --"}</option>
            {taluk.name && !taluk.id && !taluks.find(t => t.name.en === taluk.name) && (
              <option value="custom" disabled>{taluk.name}</option>
            )}
            {taluks.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name.en}
              </option>
            ))}
          </select>
          {loadingTaluk && <div className="loader-icon"><Loader size={16} /></div>}
        </div>
      </div>

      <div className="location-group">
        <label>Village / Area {required && <span className="req">*</span>}</label>
        <div className="select-wrapper">
          <select 
            value={village.id || (village.name && !villages.find(v => v.name.en === village.name) ? "custom" : "")} 
            onChange={handleVillageChange} 
            disabled={!taluk.id} 
            required={required}
          >
            <option value="">{loadingVillage ? "Loading villages..." : "-- Select Area --"}</option>
            {village.name && !village.id && !villages.find(v => v.name.en === village.name) && (
              <option value="custom" disabled>{village.name}</option>
            )}
            {villages.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name.en}
              </option>
            ))}
          </select>
          {loadingVillage && <div className="loader-icon"><Loader size={16} /></div>}
        </div>
      </div>
    </div>
  );
};

export default LocationSelector;
