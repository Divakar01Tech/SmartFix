import { useCall } from '../context/CallContext';
import { Phone, PhoneOff, Mic, MicOff, Volume2, ShieldCheck } from 'lucide-react';
import './WebRtcCallModal.css';

const formatTimer = (secs) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const WebRtcCallModal = () => {
  const { callState, peerDetails, isMuted, callDuration, acceptCall, rejectCall, endCall, toggleMute } = useCall();

  if (callState === 'idle' || !peerDetails) return null;

  const isIncoming = callState === 'incoming';
  const isOutgoing = callState === 'outgoing';
  const isConnected = callState === 'connected';

  return (
    <div className="webrtc-call-overlay animate__animated animate__fadeIn">
      <div className="webrtc-call-card shadow-2xl rounded-4 text-center text-white overflow-hidden border border-white-20">
        <div className="webrtc-card-header p-4">
          <div className="d-flex justify-content-center align-items-center gap-2 mb-2">
            <span className="badge bg-primary-subtle text-primary fw-bold px-3 py-1 rounded-pill border border-primary d-inline-flex align-items-center gap-1">
              <ShieldCheck size={14} /> SmartFix In-App Secure Voice Call
            </span>
          </div>

          <div className="avatar-pulse-container my-4 position-relative mx-auto" style={{ width: 100, height: 100 }}>
            <div className={`avatar-pulse-ring ${isConnected ? 'ring-connected' : 'ring-calling'}`}></div>
            <div className="avatar-circle-box rounded-circle bg-white text-dark shadow d-flex align-items-center justify-content-center position-relative z-1 w-100 h-100 fs-1">
              {peerDetails.avatar || '👨‍🔧'}
            </div>
          </div>

          <h3 className="fw-black mb-1">{peerDetails.name || 'Handyman Professional'}</h3>
          <p className="text-white-70 small mb-3">{peerDetails.role || 'Certified Service Specialist'}</p>

          <div className="call-status-badge">
            {isOutgoing && <span className="status-pill calling-pill">🔔 Calling Pro...</span>}
            {isIncoming && <span className="status-pill incoming-pill">📲 Incoming Voice Call...</span>}
            {isConnected && (
              <span className="status-pill connected-pill d-inline-flex align-items-center gap-2">
                <span className="live-dot"></span> {formatTimer(callDuration)} Connected
              </span>
            )}
          </div>
        </div>

        {/* Audio Wave Visualizer on Connected */}
        {isConnected && (
          <div className="audio-wave-bar d-flex justify-content-center align-items-center gap-1 my-2">
            <div className="wave-bar bar1"></div>
            <div className="wave-bar bar2"></div>
            <div className="wave-bar bar3"></div>
            <div className="wave-bar bar4"></div>
            <div className="wave-bar bar5"></div>
          </div>
        )}

        <div className="webrtc-card-footer p-4 bg-dark-gradient d-flex justify-content-center align-items-center gap-4">
          {/* Controls when Incoming */}
          {isIncoming && (
            <>
              <button
                type="button"
                className="btn btn-danger btn-call-round btn-decline shadow"
                onClick={rejectCall}
                title="Decline Call"
              >
                <PhoneOff size={24} />
              </button>
              <button
                type="button"
                className="btn btn-success btn-call-round btn-accept shadow pulse-green"
                onClick={acceptCall}
                title="Accept Voice Call"
              >
                <Phone size={24} />
              </button>
            </>
          )}

          {/* Controls when Outgoing or Connected */}
          {(isOutgoing || isConnected) && (
            <>
              <button
                type="button"
                className={`btn btn-call-round ${isMuted ? 'btn-warning text-dark' : 'btn-outline-light'}`}
                onClick={toggleMute}
                title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
              >
                {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
              </button>

              <button
                type="button"
                className="btn btn-danger btn-call-round btn-end shadow"
                onClick={endCall}
                title="End Call"
              >
                <PhoneOff size={24} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default WebRtcCallModal;
