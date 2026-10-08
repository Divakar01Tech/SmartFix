import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Sparkles, XCircle } from 'lucide-react';
import { apiService } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

const AISearchBar = ({ onSelectMatch }) => {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState(null);

  const debounceTimer = useRef(null);

  // Debounce the input
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    
    if (query.trim().length === 0) {
      setDebouncedQuery('');
      setMatches([]);
      setHasSearched(false);
      setError(null);
      return;
    }

    debounceTimer.current = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 500);

    return () => clearTimeout(debounceTimer.current);
  }, [query]);

  // Execute search when debounced query changes
  useEffect(() => {
    const fetchSearch = async () => {
      if (!debouncedQuery) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const data = await apiService.searchServices(debouncedQuery);
        setMatches(data.matches || []);
        setHasSearched(true);
      } catch (err) {
        if (err.message.includes('429') || err.message.includes('maximum of 10')) {
          setError(err.message);
        } else {
          setError('Search failed. Please try browsing categories manually.');
        }
        setMatches([]);
        setHasSearched(true);
      } finally {
        setLoading(false);
      }
    };

    fetchSearch();
  }, [debouncedQuery]);

  const handleClear = () => {
    setQuery('');
    setMatches([]);
    setHasSearched(false);
    setError(null);
  };

  const handleChipClick = (match) => {
    if (onSelectMatch) {
      onSelectMatch(match);
      handleClear();
    }
  };

  return (
    <div className="ai-search-container mb-4 position-relative">
      <div className="input-group input-group-lg shadow-sm border rounded-pill overflow-hidden bg-white">
        <span className="input-group-text bg-white border-0 ps-4 text-muted">
          {loading ? <Loader2 size={20} className="animate-spin text-primary" /> : <Search size={20} />}
        </span>
        <input
          type="text"
          className="form-control border-0 shadow-none bg-transparent"
          placeholder="Describe your issue (e.g. AC not cooling, pipe leak, kuzhai oluguthu)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button 
            className="btn btn-link text-muted pe-4 text-decoration-none border-0 bg-white" 
            onClick={handleClear}
          >
            <XCircle size={20} />
          </button>
        )}
      </div>
      
      <div className="mt-2 px-3 d-flex flex-wrap gap-2 align-items-center">
        {loading && (
          <span className="badge bg-light text-primary border border-primary px-3 py-2 rounded-pill fw-normal d-flex align-items-center gap-1">
            <Sparkles size={14} /> AI is finding the best service...
          </span>
        )}

        {!loading && hasSearched && matches.length > 0 && (
          <>
            <span className="text-muted small me-2"><Sparkles size={14} className="me-1 text-primary"/> Suggested:</span>
            {matches.map((match, idx) => (
              <button 
                key={idx} 
                className="btn btn-sm btn-outline-primary rounded-pill px-3 fw-medium"
                onClick={() => handleChipClick(match)}
              >
                {match.subService} <small className="opacity-50">({match.confidence}%)</small>
              </button>
            ))}
          </>
        )}

        {!loading && hasSearched && matches.length === 0 && !error && (
          <span className="text-muted small">
            We couldn't find an exact match. Please browse the categories below. / சரியான சேவை கிடைக்கவில்லை. கீழே உள்ள வகைகளை காணவும்.
          </span>
        )}

        {!loading && error && (
          <span className="text-danger small bg-danger-subtle px-3 py-1 rounded-pill">
            {error}
          </span>
        )}
      </div>
    </div>
  );
};

export default AISearchBar;
