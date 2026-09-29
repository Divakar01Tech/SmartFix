import React, { useState, useRef, useEffect } from 'react';
import { Phone, Star, X, CheckCircle } from 'lucide-react';

const BottomSheet = ({ booking, worker, etaText, onCancel, onCall }) => {
  const [startY, setStartY] = useState(null);
  const [currentY, setCurrentY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  const handleTouchStart = (e) => {
    setStartY(e.touches[0].clientY);
    setIsDragging(true);
  };
  
  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const deltaY = e.touches[0].clientY - startY;
    if (deltaY > 0) { // Only allow dragging down
      setCurrentY(deltaY);
    }
  };
  
  const handleTouchEnd = () => {
    setIsDragging(false);
    if (currentY > 100) {
      // Logic to hide or minimize if needed. For now, snap back.
      setCurrentY(0);
    } else {
      setCurrentY(0);
    }
  };

  const statusList = ['Accepted', 'EnRoute', 'Arrived'];
  const currentStep = statusList.indexOf(booking?.status) >= 0 ? statusList.indexOf(booking?.status) : 0;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#fff',
        borderTopLeftRadius: '24px',
        borderTopRightRadius: '24px',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
        transform: `translateY(${currentY}px)`,
        transition: isDragging ? 'none' : 'transform 0.3s ease-out',
        zIndex: 20
      }}
    >
      <div 
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ width: '100%', height: '30px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
      >
        <div style={{ width: '40px', height: '4px', background: '#cbd5e1', borderRadius: '4px' }}></div>
      </div>
      
      <div style={{ padding: '0 20px 20px 20px' }}>
        {/* Status Stepper */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '10px', left: '10%', right: '10%', height: '2px', background: '#e2e8f0', zIndex: -1 }}></div>
          {statusList.map((st, i) => (
            <div key={st} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#fff', padding: '0 5px' }}>
              <div style={{ 
                width: '22px', height: '22px', borderRadius: '50%', 
                background: i <= currentStep ? '#16a34a' : '#e2e8f0',
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                color: '#fff'
              }}>
                {i <= currentStep ? <CheckCircle size={14} /> : <div style={{width:'8px',height:'8px',borderRadius:'50%',background:'#cbd5e1'}}></div>}
              </div>
              <span style={{ fontSize: '0.75rem', marginTop: '4px', color: i <= currentStep ? '#16a34a' : '#94a3b8', fontWeight: '700' }}>
                {st === 'EnRoute' ? 'En Route' : st}
              </span>
            </div>
          ))}
        </div>

        {/* Worker Info */}
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: '#e2e8f0', overflow: 'hidden' }}>
            <img src={worker?.profilePic || 'https://via.placeholder.com/50'} alt="worker" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '800', fontSize: '1.1rem', color: '#0f172a' }}>{worker?.name || 'Worker Name'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f59e0b', fontSize: '0.85rem', fontWeight: '700' }}>
              <Star size={14} fill="#f59e0b" /> {worker?.rating?.toFixed(1) || 'N/A'} 
              <span style={{ color: '#64748b', fontWeight: 'normal' }}>({worker?.reviewsCount || 0} reviews)</span>
            </div>
            {worker?.bio && <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{worker.bio}</div>}
          </div>
          {etaText && (
            <div style={{ textAlign: 'center', background: '#f8fafc', padding: '8px 12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '700' }}>ETA</div>
              <div style={{ fontSize: '1rem', color: '#2563eb', fontWeight: '800' }}>{etaText}</div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={onCall}
            style={{ flex: 1, padding: '12px', background: '#2563eb', color: '#fff', borderRadius: '12px', border: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontWeight: '700', fontSize: '0.95rem' }}
          >
            <Phone size={18} /> Call Professional
          </button>
          <button 
            onClick={onCancel}
            style={{ padding: '12px', background: '#fee2e2', color: '#ef4444', borderRadius: '12px', border: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: '700' }}
          >
            <X size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default BottomSheet;
