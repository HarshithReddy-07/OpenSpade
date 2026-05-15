import { useEffect, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { socket } from './socket';
import Lobby from './components/Lobby';
import GameTable from './components/GameTable';

export type GameState = any; // Will define properly later

function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerId, setPlayerId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    socket.connect();

    socket.on('connect', () => {
      setPlayerId(socket.id!);
      
      // Auto-reconnect if session exists
      const savedRoom = sessionStorage.getItem('openSpadeRoom');
      const savedPlayer = sessionStorage.getItem('openSpadePlayer');
      if (savedRoom && savedPlayer) {
        socket.emit('join_room', { roomId: savedRoom, playerName: savedPlayer });
      }
    });

    socket.on('game_state', (state: GameState) => {
      setGameState(state);
      setError(null);
    });

    socket.on('error', (msg: string) => {
      setError(msg);
      if (msg === 'Room does not exist') {
        sessionStorage.removeItem('openSpadeRoom');
        sessionStorage.removeItem('openSpadePlayer');
      }
    });

    return () => {
      socket.disconnect();
      socket.off('connect');
      socket.off('game_state');
      socket.off('error');
    };
  }, []);

  return (
    <div style={{ padding: '20px', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Background visual elements */}
      <div style={{ position: 'fixed', top: '-10%', left: '-10%', width: '40vw', height: '40vw', background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)', zIndex: -1 }}></div>
      <div style={{ position: 'fixed', bottom: '-10%', right: '-10%', width: '40vw', height: '40vw', background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)', zIndex: -1 }}></div>

      {error && (
        <div style={{ background: '#ef4444', color: 'white', padding: '12px', borderRadius: '8px', marginBottom: '16px', textAlign: 'center' }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: '12px', background: 'transparent', border: '1px solid white', color: 'white', borderRadius: '4px', cursor: 'pointer', padding: '2px 8px' }}>Dismiss</button>
        </div>
      )}

      {!gameState || gameState.phase === 'Lobby' ? (
        <Lobby gameState={gameState} playerId={playerId} />
      ) : (
        <GameTable gameState={gameState} playerId={playerId} onLeave={() => {
          sessionStorage.removeItem('openSpadeRoom');
          sessionStorage.removeItem('openSpadePlayer');
          socket.emit('leave_room');
          setGameState(null);
        }} />
      )}
      <Analytics />
    </div>
  );
}

export default App;
