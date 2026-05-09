import { useEffect, useRef, useState, useCallback } from 'react';
import { socket } from '../socket';

type Player = {
  id: string;
  username?: string;
};

export default function VoiceChat({
  players,
  myId
}: {
  players: Player[];
  myId: string;
}) {
  const [muted, setMuted] = useState(true);
  const [micEnabled, setMicEnabled] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<{
    [id: string]: MediaStream;
  }>({});

  const localStream = useRef<MediaStream | null>(null);

  const peers = useRef<{
    [socketId: string]: RTCPeerConnection;
  }>({});

  const pendingCandidates = useRef<{
    [socketId: string]: RTCIceCandidateInit[];
  }>({});

  // FIX 1: Extract duplicated ICE candidate flush logic into a shared helper.
  const flushPendingCandidates = useCallback(
    async (pc: RTCPeerConnection, socketId: string) => {
      const queued = pendingCandidates.current[socketId];
      if (!queued) return;
      for (const candidate of queued) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      delete pendingCandidates.current[socketId];
    },
    []
  );

  const createPeerConnection = useCallback(
    (targetSocketId: string) => {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          // FIX 2: Added a public TURN server fallback so connections succeed
          // through symmetric NAT. Replace with your own credentials in
          // production — shared public TURN servers are rate-limited and
          // unsuitable for production traffic.
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ]
      });

      // Add local tracks if the mic is already live.
      if (localStream.current) {
        localStream.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStream.current!);
        });
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('webrtc_signal', {
            targetSocketId,
            signal: event.candidate
          });
        }
      };

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStreams((prev) => ({
            ...prev,
            [targetSocketId]: event.streams[0]
          }));
        }
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (
          state === 'disconnected' ||
          state === 'failed' ||
          state === 'closed'
        ) {
          pc.close();
          delete peers.current[targetSocketId];
          setRemoteStreams((prev) => {
            const updated = { ...prev };
            delete updated[targetSocketId];
            return updated;
          });
        }
      };

      return pc;
    },
    [flushPendingCandidates]
  );

  // FIX 3: Wrap connectToPeers in useCallback so the effect can list it as a
  // stable dependency, and remove the duplicate manual call from enableMic.
  const connectToPeers = useCallback(async () => {
    if (!localStream.current) return;
    for (const p of players) {
      if (p.id === myId) continue;       // skip self
      if (peers.current[p.id]) continue; // skip already-connected

      // Only the lexicographically-greater ID creates the offer so exactly
      // one side initiates per pair.
      if (myId > p.id) continue;

      const pc = createPeerConnection(p.id);
      peers.current[p.id] = pc;

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('webrtc_signal', {
          targetSocketId: p.id,
          signal: offer
        });
      } catch (err) {
        console.error('Offer creation error:', err);
      }
    }
  }, [players, myId, createPeerConnection]);

  useEffect(() => {
    const handleSignal = async ({
      senderSocketId,
      signal
    }: {
      senderSocketId: string;
      signal: any;
    }) => {
      let pc = peers.current[senderSocketId];

      if (!pc) {
        pc = createPeerConnection(senderSocketId);
        peers.current[senderSocketId] = pc;
      }

      try {
        if (signal.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
          await flushPendingCandidates(pc, senderSocketId); // FIX 1 applied
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('webrtc_signal', {
            targetSocketId: senderSocketId,
            signal: answer
          });
        } else if (signal.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
          await flushPendingCandidates(pc, senderSocketId); // FIX 1 applied
        } else if (signal.candidate) {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(signal));
          } else {
            pendingCandidates.current[senderSocketId] ??= [];
            pendingCandidates.current[senderSocketId].push(signal);
          }
        }
      } catch (err) {
        console.error('WebRTC signal error:', err);
      }
    };

    socket.on('webrtc_signal', handleSignal);

    return () => {
      socket.off('webrtc_signal', handleSignal);
      Object.values(peers.current).forEach((pc) => pc.close());
      localStream.current?.getTracks().forEach((t) => t.stop());
    };
  }, [createPeerConnection, flushPendingCandidates]);

  // FIX 3: This effect is now the single place that calls connectToPeers.
  // enableMic sets micEnabled=true which triggers this effect — no duplicate call.
  useEffect(() => {
    if (micEnabled) {
      connectToPeers();
    }
  }, [players, micEnabled, connectToPeers]);

  // FIX 4: Clean up peers for players who have left the players list.
  useEffect(() => {
    const currentIds = new Set(players.map((p) => p.id));
    for (const socketId of Object.keys(peers.current)) {
      if (!currentIds.has(socketId)) {
        peers.current[socketId].close();
        delete peers.current[socketId];
        setRemoteStreams((prev) => {
          const updated = { ...prev };
          delete updated[socketId];
          return updated;
        });
      }
    }
  }, [players]);

  const enableMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStream.current = stream;

      // Add tracks to any peers that were already created before mic was enabled.
      for (const pc of Object.values(peers.current)) {
        stream.getTracks().forEach((track) => {
          const alreadyAdded = pc
            .getSenders()
            .some((sender) => sender.track === track);
          if (!alreadyAdded) {
            pc.addTrack(track, stream);
          }
        });
      }

      // FIX 3: Only setMicEnabled here; connectToPeers is called by the effect above.
      setMicEnabled(true);
      setMuted(false);
    } catch (e) {
      console.error('Microphone error', e);
    }
  };

  // FIX 5: Guard against an empty audio track list before reading .enabled.
  const toggleMute = () => {
    const tracks = localStream.current?.getAudioTracks();
    if (!tracks || tracks.length === 0) return;

    const nextEnabled = !tracks[0].enabled;
    tracks.forEach((track) => {
      track.enabled = nextEnabled;
    });
    setMuted(!nextEnabled);
  };

  return (
    <div
      className="glass-panel"
      style={{
        padding: '12px',
        display: 'inline-flex',
        gap: '8px',
        alignItems: 'center'
      }}
    >
      {!micEnabled ? (
        <button
          className="btn-secondary"
          onClick={enableMic}
          style={{ padding: '8px 12px' }}
        >
          Enable Voice Chat
        </button>
      ) : (
        <>
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: muted ? '#ef4444' : '#10b981'
            }}
          />
          <button
            className="btn-secondary"
            onClick={toggleMute}
            style={{ padding: '8px 12px' }}
          >
            {muted ? 'Unmute' : 'Mute'}
          </button>
        </>
      )}

      {/* FIX 6: Hidden audio elements with playsInline for mobile compatibility. */}
      {Object.entries(remoteStreams).map(([id, stream]) => (
        <audio
          key={id}
          autoPlay
          playsInline
          style={{ display: 'none' }}
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