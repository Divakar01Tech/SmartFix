import { useState, useEffect } from 'react';
import { MapPin, Loader } from 'lucide-react';
import './LocationSelector.css';

const API_URL = "https://tngis.tnega.org/generic_api/v1/getAdminDropDown";

const LocationSelector = ({ value, onChange, placeholder, required = false }) => {
  const [districts, setDistricts] = useState([]);
  const [taluks, setTaluks] = useState([]);
  const [villages, setVillages] = useState([]);

  // Store the *names* as the primary state to match the old format
  // Or we can store codes and names together, but the onChange expects names.
  const [district, setDistrict] = useState({ name: '', code: '' });
  const [taluk, setTaluk] = useState({ name: '', code: '' });
  const [village, setVillage] = useState({ name: '', code: '' });

  const [loadingDistrict, setLoadingDistrict] = useState(false);
  const [loadingTaluk, setLoadingTaluk] = useState(false);
  const [loadingVillage, setLoadingVillage] = useState(false);

  // Initialize value handling
  // This is tricky because we receive full string (Village, Taluk, District, Tamil Nadu)
  // But we only have codes to fetch next level. 
  // Wait, if it's just strings we can't easily fetch Taluk without District Code.
  // Actually, for a new form, we just start fresh. Let's try to map the initial string if possible,
  // but it's hard without all data. If value is provided, we can just show it as a custom string.
  useEffect(() => {
    if (value && typeof value === 'string' && !district.name) {
      const parts = value.split(',').map(p => p.trim());
      if (parts.length >= 3) {
        setVillage({ name: parts[0], code: '' });
        setTaluk({ name: parts[1], code: '' });
        setDistrict({ name: parts[2], code: '' });
      }
    }
  }, [value, district.name]);

  // Load Districts on mount
  useEffect(() => {
    const fetchDistricts = async () => {
      try {
        setLoadingDistrict(true);
        const response = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-APP-NAME": "TNGIS",
          },
          body: JSON.stringify({
            case: "district",
            filter_code: "lgd_code",
          }),
        });

        const result = await response.json();
        if (result[0]?.success === 1) {
          setDistricts(result[0].data);
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
    const districtCode = e.target.value;
    const districtName = e.target.options[e.target.selectedIndex].text;
    
    setDistrict({ code: districtCode, name: districtName });
    setTaluk({ code: '', name: '' });
    setVillage({ code: '', name: '' });
    setTaluks([]);
    setVillages([]);
    
    if (!districtCode) {
      triggerChange('', '', '');
      return;
    }
    
    triggerChange(districtName, '', '');

    try {
      setLoadingTaluk(true);
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-APP-NAME": "TNGIS",
        },
        body: JSON.stringify({
          case: "taluk",
          district: districtCode,
          filter_code: "lgd_code",
        }),
      });

      const result = await response.json();
      if (result[0]?.success === 1) {
        setTaluks(result[0].data);
      }
    } catch (error) {
      console.error("Taluk fetch error:", error);
    } finally {
      setLoadingTaluk(false);
    }
  };

  const handleTalukChange = async (e) => {
    const talukCode = e.target.value;
    const talukName = e.target.options[e.target.selectedIndex].text;

    setTaluk({ code: talukCode, name: talukName });
    setVillage({ code: '', name: '' });
    setVillages([]);

    if (!talukCode) {
      triggerChange(district.name, '', '');
      return;
    }

    triggerChange(district.name, talukName, '');

    try {
      setLoadingVillage(true);
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-APP-NAME": "TNGIS",
        },
        body: JSON.stringify({
          case: "village",
          district: district.code,
          taluk: talukCode,
          filter_code: "lgd_code",
        }),
      });

      const result = await response.json();
      if (result[0]?.success === 1) {
        setVillages(result[0].data);
      }
    } catch (error) {
      console.error("Village fetch error:", error);
    } finally {
      setLoadingVillage(false);
    }
  };

  const handleVillageChange = (e) => {
    const villageCode = e.target.value;
    const villageName = e.target.options[e.target.selectedIndex].text;

    if (!villageCode) {
      setVillage({ code: '', name: '' });
      triggerChange(district.name, taluk.name, '');
      return;
    }

    setVillage({ code: villageCode, name: villageName });
    triggerChange(district.name, taluk.name, villageName);
  };

  return (
    <div className="location-selector">
      <div className="location-group">
        <label><MapPin size={14} /> District {required && <span className="req">*</span>}</label>
        <div className="select-wrapper">
          <select 
            value={district.code || (district.name && !districts.find(d => d.district_name === district.name) ? "custom" : "")} 
            onChange={handleDistrictChange} 
            required={required}
          >
            <option value="">{loadingDistrict ? "Loading districts..." : "-- Select District --"}</option>
            {/* If initial value is set but code is unknown, show it temporarily */}
            {district.name && !district.code && !districts.find(d => d.district_name === district.name) && (
              <option value="custom" disabled>{district.name}</option>
            )}
            {districts.map((item) => (
              <option key={item.district_code} value={item.district_code}>
                {item.district_name}
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
            value={taluk.code || (taluk.name && !taluks.find(t => t.taluk_name === taluk.name) ? "custom" : "")} 
            onChange={handleTalukChange} 
            disabled={!district.code} 
            required={required}
          >
            <option value="">{loadingTaluk ? "Loading taluks..." : "-- Select Taluk --"}</option>
            {taluk.name && !taluk.code && !taluks.find(t => t.taluk_name === taluk.name) && (
              <option value="custom" disabled>{taluk.name}</option>
            )}
            {taluks.map((item) => (
              <option key={item.taluk_code} value={item.taluk_code}>
                {item.taluk_name}
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
            value={village.code || (village.name && !villages.find(v => v.village_name === village.name) ? "custom" : "")} 
            onChange={handleVillageChange} 
            disabled={!taluk.code} 
            required={required}
          >
            <option value="">{loadingVillage ? "Loading villages..." : "-- Select Area --"}</option>
            {village.name && !village.code && !villages.find(v => v.village_name === village.name) && (
              <option value="custom" disabled>{village.name}</option>
            )}
            {villages.map((item) => (
              <option key={item.village_code} value={item.village_code}>
                {item.village_name}
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
