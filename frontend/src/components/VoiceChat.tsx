import { useEffect, useRef, useState } from 'react';
import { socket } from '../socket';

export default function VoiceChat({ players, myId }: { players: any[], myId: string }) {
  const [muted, setMuted] = useState(true);
  const [micEnabled, setMicEnabled] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<{ [id: string]: MediaStream }>({});
  const localStream = useRef<MediaStream | null>(null);
  const peers = useRef<{ [socketId: string]: RTCPeerConnection }>({});

  useEffect(() => {
    // Setup signaling listeners
    socket.on('webrtc_signal', async ({ senderSocketId, signal }) => {
      let pc = peers.current[senderSocketId];
      if (!pc) {
        pc = createPeerConnection(senderSocketId);
        peers.current[senderSocketId] = pc;
      }

      if (signal.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc_signal', { targetSocketId: senderSocketId, signal: answer });
      } else if (signal.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
      } else if (signal.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(signal));
      }
    });

    return () => {
      socket.off('webrtc_signal');
      Object.values(peers.current).forEach(pc => pc.close());
    };
  }, []);

  // Watch for new players joining while mic is already enabled
  useEffect(() => {
    if (micEnabled) {
      connectToPeers();
    }
  }, [players, micEnabled]);

  const createPeerConnection = (targetSocketId: string) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    if (localStream.current) {
      localStream.current.getTracks().forEach(track => {
        pc.addTrack(track, localStream.current!);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc_signal', { targetSocketId, signal: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStreams(prev => ({
          ...prev,
          [targetSocketId]: event.streams[0]
        }));
      } else {
        const stream = new MediaStream([event.track]);
        setRemoteStreams(prev => ({
          ...prev,
          [targetSocketId]: stream
        }));
      }
    };

    return pc;
  };

  const connectToPeers = () => {
    players.forEach(async (p) => {
      if (p.id !== myId && !peers.current[p.id]) {
        const pc = createPeerConnection(p.id);
        peers.current[p.id] = pc;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('webrtc_signal', { targetSocketId: p.id, signal: offer });
      }
    });
  };

  const enableMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStream.current = stream;
      setMicEnabled(true);
      setMuted(false);
      
      // Add new local tracks to existing peer connections and renegotiate
      for (const [targetSocketId, pc] of Object.entries(peers.current)) {
        // Prevent adding multiple times
        const senders = pc.getSenders();
        const alreadyAdded = senders.some(sender => stream.getTracks().includes(sender.track!));
        
        if (!alreadyAdded) {
          stream.getTracks().forEach(track => {
            pc.addTrack(track, stream);
          });
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('webrtc_signal', { targetSocketId, signal: offer });
        }
      }

      connectToPeers();
    } catch (e) {
      console.error("Microphone error", e);
    }
  };

  const toggleMute = () => {
    if (localStream.current) {
      localStream.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setMuted(!localStream.current.getAudioTracks()[0].enabled);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '12px', display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
      {!micEnabled ? (
        <button className="btn-secondary" onClick={enableMic} style={{ padding: '8px 12px' }}>Enable Voice Chat</button>
      ) : (
        <>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: muted ? '#ef4444' : '#10b981' }}></div>
          <button className="btn-secondary" onClick={toggleMute} style={{ padding: '8px 12px' }}>
            {muted ? 'Unmute' : 'Mute'}
          </button>
        </>
      )}
      
      {/* Hidden audio elements for remote streams */}
      {Object.entries(remoteStreams).map(([id, stream]) => (
        <audio 
          key={id} 
          autoPlay 
          ref={(ref) => {
            if (ref && ref.srcObject !== stream) {
              ref.srcObject = stream;
            }
          }} 
        />
      ))}
    </div>
  );
}
