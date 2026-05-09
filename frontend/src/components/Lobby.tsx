import { useState } from 'react';
import { socket } from '../socket';

export default function Lobby({ gameState, playerId }: { gameState: any; playerId: string }) {
  const [roomId, setRoomId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [mode, setMode] = useState('Solo');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [totalRounds, setTotalRounds] = useState(1);
  const [allowNil, setAllowNil] = useState(false);

  const handleCreate = () => {
    if (!roomId || !playerName) return;
    socket.emit('create_room', { roomId, mode, playerName, maxPlayers, totalRounds, allowNil });
  };

  const handleJoin = () => {
    if (!roomId || !playerName) return;
    socket.emit('join_room', { roomId, playerName });
  };

  const handleStart = () => {
    socket.emit('start_game');
  };

  if (gameState) {
    // Waiting in lobby
    const isHost = gameState.players[0]?.id === playerId;
    
    return (
      <div className="glass-panel" style={{ maxWidth: '700px', margin: 'auto', padding: '48px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '48px', marginBottom: '12px', background: 'linear-gradient(to right, #3b82f6, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Room: {gameState.id}
        </h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Mode: {gameState.mode}</p>
        
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '12px' }}>Players ({gameState.players.length}/{maxPlayers})</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {gameState.players.map((p: any) => (
              <li key={p.id} style={{ padding: '8px', borderBottom: '1px solid var(--glass-border)' }}>
                {p.name} {p.id === playerId ? '(You)' : ''} {p.team ? `[Team ${p.team}]` : ''}
              </li>
            ))}
          </ul>
        </div>

        {isHost ? (
          <button className="btn-primary" onClick={handleStart} style={{ width: '100%', fontSize: '20px', padding: '16px' }} disabled={gameState.players.length < 2}>
            Start Game
          </button>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: '20px' }}>Waiting for host to start...</p>
        )}
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ maxWidth: '600px', margin: 'auto', padding: '48px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '56px', fontWeight: 700, margin: 0, letterSpacing: '-1px' }}>OpenSpade</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '20px' }}>Multiplayer Trick-Taking Game</p>
      </div>

      <div>
        <label style={{ display: 'block', marginBottom: '12px', fontSize: '18px', color: 'var(--text-muted)' }}>Player Name</label>
        <input 
          type="text" 
          className="input-field" 
          placeholder="Enter your name" 
          value={playerName} 
          onChange={(e) => setPlayerName(e.target.value)} 
        />
      </div>

      <div>
        <label style={{ display: 'block', marginBottom: '12px', fontSize: '18px', color: 'var(--text-muted)' }}>Room Code</label>
        <input 
          type="text" 
          className="input-field" 
          placeholder="e.g. ROOM123" 
          value={roomId} 
          onChange={(e) => setRoomId(e.target.value.toUpperCase())} 
        />
      </div>

      <div>
        <label style={{ display: 'block', marginBottom: '12px', fontSize: '18px', color: 'var(--text-muted)' }}>Game Mode (Host Only)</label>
        <select 
          className="input-field" 
          value={mode} 
          onChange={(e) => {
            const newMode = e.target.value;
            setMode(newMode);
            if (newMode === 'Pair') {
              setMaxPlayers(4);
              const maxR = Math.floor(103 / 4);
              if (totalRounds > maxR) setTotalRounds(maxR);
            } else if (newMode === 'Pair6') {
              setMaxPlayers(6);
              const maxR = Math.floor(103 / 6);
              if (totalRounds > maxR) setTotalRounds(maxR);
            }
          }}
          style={{ cursor: 'pointer' }}
        >
          <option value="Solo">Solo</option>
          <option value="Pair">Pair (2v2)</option>
          <option value="Pair6">Trio (2v2v2)</option>
        </select>
      </div>

      <div>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>Number of Players</label>
        <select 
          className="input-field" 
          value={maxPlayers} 
          onChange={(e) => {
            const val = parseInt(e.target.value);
            setMaxPlayers(val);
            const maxR = Math.floor(103 / val);
            if (totalRounds > maxR) setTotalRounds(maxR);
          }}
          style={{ cursor: 'pointer' }}
        >
          {mode === 'Solo' ? (
            [2, 3, 4, 5, 6].map(num => <option key={num} value={num}>{num}</option>)
          ) : mode === 'Pair6' ? (
            <option value={6}>6</option>
          ) : (
            <option value={4}>4</option>
          )}
        </select>
      </div>

      <div>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>Number of Rounds</label>
        <select 
          className="input-field" 
          value={totalRounds} 
          onChange={(e) => setTotalRounds(parseInt(e.target.value))}
          style={{ cursor: 'pointer' }}
        >
          {Array.from({ length: Math.floor(103 / maxPlayers) }, (_, i) => i + 1).map(num => (
            <option key={num} value={num}>{num}</option>
          ))}
        </select>
      </div>

      <div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: 'var(--text-muted)' }}>
          <input 
            type="radio" 
            checked={allowNil}
            onChange={() => setAllowNil(true)}
          /> Allow Nil Bid in Last Round
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: 'var(--text-muted)' }}>
          <input 
            type="radio" 
            checked={!allowNil}
            onChange={() => setAllowNil(false)}
          /> No Nil Bid
        </label>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
        <button className="btn-secondary" style={{ flex: 1, fontSize: '20px' }} onClick={handleJoin}>Join</button>
        <button className="btn-primary" style={{ flex: 1, fontSize: '20px' }} onClick={handleCreate}>Create</button>
      </div>
    </div>
  );
}
