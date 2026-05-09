import { useState } from 'react';
import { socket } from '../socket';
import CardComponent from './CardComponent';
import Chat from './Chat';
import VoiceChat from './VoiceChat';

export default function GameTable({ gameState, playerId, onLeave }: { gameState: any; playerId: string, onLeave: () => void }) {
  const [bidValue, setBidValue] = useState<number>(1);

  const me = gameState.players.find((p: any) => p.id === playerId);
  const myTurn = gameState.players[gameState.currentTurnIndex]?.id === playerId;
  const isHost = gameState.players[0]?.id === playerId;
  
  // Basic seating logic (bottom is me, others around)
  const myIndex = gameState.players.findIndex((p: any) => p.id === playerId);
  const opponents = [];
  for (let i = 1; i < gameState.players.length; i++) {
    const idx = (myIndex + i) % gameState.players.length;
    opponents.push(gameState.players[idx]);
  }

  const handleBid = () => {
    socket.emit('place_bid', { bid: bidValue });
  };

  const handlePlayCard = (card: any) => {
    if (!myTurn) return;
    socket.emit('play_card', { card });
  };

  const handleNextRound = () => {
    socket.emit('next_round');
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Top Bar: Scores & Trump info */}
      <div className="glass-panel" style={{ padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '24px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '32px' }}>Round {gameState.currentRoundIndex} of {gameState.totalRounds} <span style={{fontSize: '20px', color: 'var(--text-muted)'}}>({gameState.phase})</span></h2>
          <div style={{ color: 'var(--text-muted)', fontSize: '20px' }}>Trump Suit: {gameState.trumpSuit ? gameState.trumpSuit.toUpperCase() : 'None'}</div>
        </div>
        
        {/* Scoreboard inline */}
        <div style={{ display: 'flex', gap: '16px', fontSize: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {gameState.mode === 'Solo' ? (
            gameState.players.map((p: any) => (
              <div key={p.id} style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 'bold', color: p.id === playerId ? 'var(--primary)' : 'white' }}>{p.name}</div>
                <div>Score: {p.score}</div>
                <div>Bid: {p.bid !== null ? p.bid : '-'} (Won: {p.tricksWon})</div>
              </div>
            ))
          ) : (
            Object.entries(gameState.teamScores).map(([teamId, score]) => (
              <div key={teamId} style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 'bold' }}>Team {teamId}</div>
                <div>Score: {score as React.ReactNode}</div>
              </div>
            ))
          )}
        </div>
        
        {/* Voice Chat controls */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <VoiceChat players={gameState.players} myId={playerId} />
          {isHost && gameState.phase !== 'GameOver' && (
            <button className="btn-secondary" style={{ backgroundColor: '#ef4444', borderColor: '#ef4444', padding: '8px 12px' }} onClick={() => socket.emit('end_game_early')}>
              End Game Early
            </button>
          )}
        </div>
      </div>

      {/* Main Table Area */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        
        {/* Joker Card (Trump Indicator) */}
        {gameState.jokerCard && (
          <div style={{ position: 'absolute', top: '20px', left: '20px', textAlign: 'center' }}>
            <div style={{ marginBottom: '8px', fontWeight: 'bold', color: 'var(--accent)' }}>JOKER CARD</div>
            <CardComponent suit={gameState.jokerCard.suit} rank={gameState.jokerCard.rank} />
          </div>
        )}

        {/* Center Trick Area */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '450px', aspectRatio: '1 / 1', borderRadius: '50%', background: 'rgba(0,0,0,0.1)', border: '2px dashed var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {gameState.currentTrick.cards.map((play: any, idx: number) => {
            // Very simple center positioning based on index
            const angle = (idx * 360) / gameState.players.length;
            const x = Math.sin((angle * Math.PI) / 180) * 110;
            const y = -Math.cos((angle * Math.PI) / 180) * 110;
            return (
              <div key={idx} style={{ position: 'absolute', transform: `translate(${x}px, ${y}px)`, zIndex: idx }}>
                 <CardComponent suit={play.card.suit} rank={play.card.rank} />
                 <div style={{ position: 'absolute', bottom: '-28px', width: '100%', textAlign: 'center', fontSize: '16px', background: 'rgba(0,0,0,0.5)', borderRadius: '4px' }}>
                    {gameState.players.find((p:any) => p.id === play.playerId)?.name}
                 </div>
              </div>
            );
          })}
        </div>

        {/* Opponents Hands (Top and Sides) */}
        {opponents.map((opp, idx) => {
          let posStyle: React.CSSProperties = {};
          if (opponents.length === 1) posStyle = { top: '20px', left: '50%', transform: 'translateX(-50%)' }; // 2 player
          else if (opponents.length === 2) { // 3 player
            if (idx === 0) posStyle = { top: '50%', left: '20px', transform: 'translateY(-50%)' };
            if (idx === 1) posStyle = { top: '50%', right: '20px', transform: 'translateY(-50%)' };
          } else { // 4 player
            if (idx === 0) posStyle = { top: '50%', left: '20px', transform: 'translateY(-50%)' };
            if (idx === 1) posStyle = { top: '20px', left: '50%', transform: 'translateX(-50%)' };
            if (idx === 2) posStyle = { top: '50%', right: '20px', transform: 'translateY(-50%)' };
          }

          return (
            <div key={opp.id} style={{ position: 'absolute', ...posStyle, textAlign: 'center', opacity: opp.connected ? 1 : 0.5 }}>
              <div style={{ marginBottom: '8px', fontWeight: 'bold', fontSize: '24px' }}>{opp.name}</div>
              <div style={{ fontSize: '18px', color: 'var(--text-muted)' }}>Cards: {opp.handSize} | Bid: {opp.bid !== null ? opp.bid : '?'}</div>
            </div>
          );
        })}

        {/* Modals for phases */}
        {gameState.phase === 'Bidding' && me?.bid === null && me?.isBidder && (
          <div className="glass-panel" style={{ position: 'absolute', padding: '48px', zIndex: 10, textAlign: 'center', minWidth: '500px' }}>
            <h2 style={{ marginBottom: '24px', fontSize: '32px' }}>Place Your Bid {gameState.mode !== 'Solo' ? '(For Team)' : ''}</h2>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '32px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {Array.from({ length: gameState.currentRoundIndex + 1 }, (_, i) => i).map(b => (
                <button 
                  key={b} 
                  className={`btn-secondary ${bidValue === b ? 'btn-primary' : ''}`}
                  onClick={() => setBidValue(b)}
                  style={{ padding: '12px 20px', fontSize: '20px' }}
                >
                  {b === 0 && gameState.allowNil && gameState.currentRoundIndex === gameState.totalRounds ? 'NIL' : b}
                </button>
              ))}
            </div>
            <button className="btn-primary" onClick={handleBid} style={{ width: '100%', fontSize: '24px', padding: '16px' }}>Confirm Bid: {bidValue === 0 && gameState.allowNil && gameState.currentRoundIndex === gameState.totalRounds ? 'NIL' : bidValue}</button>
          </div>
        )}

        {gameState.phase === 'Bidding' && me?.bid === null && !me?.isBidder && (
          <div className="glass-panel" style={{ position: 'absolute', padding: '48px', zIndex: 10, textAlign: 'center', minWidth: '500px' }}>
             <h2 style={{ marginBottom: '24px', fontSize: '32px' }}>Waiting for Team Bid...</h2>
             <p style={{ fontSize: '20px', color: 'var(--text-muted)' }}>Your team's designated bidder is deciding.</p>
          </div>
        )}

        {gameState.phase === 'RoundOver' && gameState.players[0]?.id === playerId && (
           <div className="glass-panel" style={{ position: 'absolute', padding: '48px', zIndex: 10, textAlign: 'center' }}>
             <h2 style={{ marginBottom: '24px', fontSize: '36px' }}>Round Over!</h2>
             <button className="btn-primary" onClick={handleNextRound} style={{ fontSize: '24px' }}>Start Next Round</button>
           </div>
        )}

        {gameState.phase === 'GameOver' && (
           <div className="glass-panel" style={{ position: 'absolute', padding: '48px', zIndex: 20, textAlign: 'center', minWidth: '500px', background: 'rgba(15, 23, 42, 0.95)' }}>
             <h2 style={{ marginBottom: '24px', fontSize: '48px', color: 'var(--primary)' }}>Game Over!</h2>
             <h3 style={{ marginBottom: '32px', fontSize: '28px' }}>Final Leaderboard</h3>
             
             <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '48px', textAlign: 'left' }}>
               {gameState.mode === 'Solo' ? (
                 [...gameState.players].sort((a, b) => b.score - a.score).map((p: any, idx: number) => (
                   <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '24px', padding: '12px', background: idx === 0 ? 'rgba(251, 191, 36, 0.2)' : 'rgba(0,0,0,0.2)', borderRadius: '8px', border: idx === 0 ? '1px solid #fbbf24' : 'none' }}>
                     <span><span style={{fontWeight: 'bold', width: '30px', display: 'inline-block'}}>{idx + 1}.</span> {p.name} {p.id === playerId ? '(You)' : ''}</span>
                     <span style={{fontWeight: 'bold'}}>{p.score} pts</span>
                   </div>
                 ))
               ) : (
                 Object.entries(gameState.teamScores).sort(([,scoreA]: any, [,scoreB]: any) => scoreB - scoreA).map(([teamId, score]: any, idx: number) => (
                   <div key={teamId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '24px', padding: '12px', background: idx === 0 ? 'rgba(251, 191, 36, 0.2)' : 'rgba(0,0,0,0.2)', borderRadius: '8px', border: idx === 0 ? '1px solid #fbbf24' : 'none' }}>
                     <span><span style={{fontWeight: 'bold', width: '30px', display: 'inline-block'}}>{idx + 1}.</span> Team {teamId}</span>
                     <span style={{fontWeight: 'bold'}}>{score} pts</span>
                   </div>
                 ))
               )}
             </div>

             <button className="btn-primary" onClick={onLeave} style={{ fontSize: '24px', padding: '16px 32px', width: '100%' }}>Return to Lobby</button>
           </div>
        )}
      </div>

      {/* Player Hand Area */}
      <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ marginBottom: '24px', fontWeight: 'bold', fontSize: '24px', color: myTurn ? 'var(--primary)' : 'white' }}>
          {myTurn ? 'YOUR TURN' : 'Waiting for others...'}
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {me?.hand.map((card: any, idx: number) => (
            <CardComponent 
              key={`${card.suit}-${card.rank}-${idx}`} 
              suit={card.suit} 
              rank={card.rank} 
              playable={myTurn && gameState.phase === 'Playing'}
              onClick={() => handlePlayCard(card)}
              style={{
                marginLeft: idx === 0 ? 0 : '-60px',
                transition: 'margin 0.2s',
              }}
            />
          ))}
        </div>
      </div>
      
      {/* Absolute positioned Chat */}
      <div style={{ position: 'absolute', right: '20px', bottom: '20px', height: '300px' }}>
        <Chat />
      </div>
    </div>
  );
}
