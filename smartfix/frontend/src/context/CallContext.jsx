import { createContext, useContext, useState, useEffect, useRef } from 'react';
import socket from '../services/socket';
import { useAuth } from './AuthContext';

export const CallContext = createContext(null);

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export const CallProvider = ({ children }) => {
  const { user } = useAuth();
  const [callState, setCallState] = useState('idle'); // 'idle' | 'outgoing' | 'incoming' | 'connected'
  const [peerDetails, setPeerDetails] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(new Audio());
  const timerRef = useRef(null);
  const ringtoneAudioCtxRef = useRef(null);
  const ringtoneOscRef = useRef(null);

  // Audio Tone Synth Generator for Ringing / Calling Sound
  const playRingtone = (type = 'incoming') => {
    try {
      if (ringtoneAudioCtxRef.current) {
        ringtoneAudioCtxRef.current.close();
      }
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      ringtoneAudioCtxRef.current = ctx;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';

      if (type === 'incoming') {
        osc.frequency.setValueAtTime(440, ctx.currentTime); // A4 tone
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
      } else {
        osc.frequency.setValueAtTime(425, ctx.currentTime); // Dialing tone
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
      }

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      ringtoneOscRef.current = osc;
    } catch (e) {
      console.warn('Audio tone synth notice:', e.message);
    }
  };

  const stopRingtone = () => {
    try {
      if (ringtoneOscRef.current) {
        ringtoneOscRef.current.stop();
        ringtoneOscRef.current.disconnect();
        ringtoneOscRef.current = null;
      }
      if (ringtoneAudioCtxRef.current) {
        ringtoneAudioCtxRef.current.close();
        ringtoneAudioCtxRef.current = null;
      }
    } catch (e) {}
  };

  // Keep socket room joined with current user ID
  useEffect(() => {
    const currentUserId = user?._id || user?.id;
    if (currentUserId && socket) {
      socket.emit('join-user', currentUserId);
    }
  }, [user]);

  // Socket Signal Listeners
  useEffect(() => {
    if (!socket) return;

    // Incoming call event
    const handleIncomingCall = (data) => {
      console.log('🔔 Incoming in-app call from:', data);
      setPeerDetails({
        callerId: data.callerId,
        receiverId: user?._id || user?.id,
        name: data.callerName || 'SmartFix User',
        role: data.callerRole || 'Customer',
        avatar: data.callerAvatar || '👨‍🔧',
        bookingId: data.bookingId,
      });
      setCallState('incoming');
      playRingtone('incoming');
    };

    // SDP offer from caller
    const handleSdpOfferReceived = async (data) => {
      try {
        if (!pcRef.current) {
          setupPeerConnection(data.callerId);
        }
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.sdpOffer));
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);

        socket.emit('call-accepted', {
          callerId: data.callerId,
          receiverId: user?._id || user?.id,
          sdpAnswer: answer,
        });
      } catch (err) {
        console.warn('Error handling SDP offer:', err.message);
      }
    };

    // Call answered event (for caller)
    const handleCallAnswered = async (data) => {
      stopRingtone();
      setCallState('connected');
      try {
        if (pcRef.current && data.sdpAnswer) {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.sdpAnswer));
        }
      } catch (err) {
        console.warn('Error applying SDP answer:', err.message);
      }
    };

    // ICE Candidate received
    const handleIceCandidateReceived = async (data) => {
      try {
        if (pcRef.current && data.candidate) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      } catch (err) {
        console.warn('Error adding ICE candidate:', err.message);
      }
    };

    // Call rejected or ended
    const handleCallRejected = () => {
      stopRingtone();
      cleanupCallState();
    };

    const handleCallEnded = () => {
      stopRingtone();
      cleanupCallState();
    };

    socket.on('incoming-call', handleIncomingCall);
    socket.on('sdp-offer-received', handleSdpOfferReceived);
    socket.on('call-answered', handleCallAnswered);
    socket.on('ice-candidate-received', handleIceCandidateReceived);
    socket.on('call-rejected', handleCallRejected);
    socket.on('call-ended', handleCallEnded);

    return () => {
      socket.off('incoming-call', handleIncomingCall);
      socket.off('sdp-offer-received', handleSdpOfferReceived);
      socket.off('call-answered', handleCallAnswered);
      socket.off('ice-candidate-received', handleIceCandidateReceived);
      socket.off('call-rejected', handleCallRejected);
      socket.off('call-ended', handleCallEnded);
    };
  }, [user]);

  // Setup WebRTC Peer Connection
  const setupPeerConnection = (targetUserId) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    // Handle local media tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Handle remote media track
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        remoteAudioRef.current.srcObject = event.streams[0];
        remoteAudioRef.current.play().catch(() => null);
      }
    };

    // ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && targetUserId) {
        socket.emit('ice-candidate', {
          targetId: targetUserId,
          candidate: event.candidate,
          senderId: user?._id || user?.id,
        });
      }
    };

    return pc;
  };

  // Start outgoing call instantly
  const startCall = async ({ receiverId, receiverName, receiverRole, receiverAvatar, receiverPhone, bookingId }) => {
    if (!receiverId) return;

    const currentUserId = user?._id || user?.id || `anon_${Date.now()}`;
    const currentUserName = user?.name || 'Customer';
    const currentUserRole = user?.role || 'customer';

    setPeerDetails({
      callerId: currentUserId,
      receiverId,
      name: receiverName || 'Handyman Professional',
      role: receiverRole || 'Handyman Pro',
      avatar: receiverAvatar || '👨‍🔧',
      phone: receiverPhone || '+919876543210',
      bookingId,
    });
    setCallState('outgoing');
    playRingtone('outgoing');

    // Instantly emit socket call notification so receiver's device rings with 0 delay!
    if (socket) {
      socket.emit('call-initiate', {
        callerId: currentUserId,
        callerName: currentUserName,
        callerRole: currentUserRole,
        callerAvatar: user?.avatar || '👤',
        receiverId,
        bookingId,
      });
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false }).catch(() => null);
      if (stream) {
        localStreamRef.current = stream;
        const pc = setupPeerConnection(receiverId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        if (socket) {
          socket.emit('sdp-offer', {
            targetId: receiverId,
            sdpOffer: offer,
            callerId: currentUserId,
          });
        }
      }
    } catch (err) {
      console.warn('Fast call audio Notice:', err.message);
    }
  };

  // Accept incoming call
  const acceptCall = async () => {
    stopRingtone();
    setCallState('connected');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;

      if (!pcRef.current && peerDetails?.callerId) {
        setupPeerConnection(peerDetails.callerId);
      } else if (pcRef.current) {
        stream.getTracks().forEach((track) => {
          pcRef.current.addTrack(track, stream);
        });
      }
    } catch (err) {
      console.warn('Microphone access notice on call accept:', err.message);
    }
  };

  // Decline incoming call
  const rejectCall = () => {
    stopRingtone();
    if (peerDetails?.callerId) {
      socket.emit('reject-call', { targetId: peerDetails.callerId });
    }
    cleanupCallState();
  };

  // End active call
  const endCall = () => {
    stopRingtone();
    const targetId = peerDetails?.callerId === (user?._id || user?.id) ? peerDetails?.receiverId : peerDetails?.callerId;
    if (targetId) {
      socket.emit('end-call', { targetId });
    }
    cleanupCallState();
  };

  // Mute / Unmute microphone
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  // Cleanup helper
  const cleanupCallState = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setCallState('idle');
    setPeerDetails(null);
    setIsMuted(false);
    setCallDuration(0);
  };

  // Call duration counter when connected
  useEffect(() => {
    if (callState === 'connected') {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setCallDuration(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callState]);

  return (
    <CallContext.Provider
      value={{
        callState,
        peerDetails,
        isMuted,
        callDuration,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};

export default CallProvider;
