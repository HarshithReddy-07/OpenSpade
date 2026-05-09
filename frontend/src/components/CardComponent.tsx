import { motion } from 'framer-motion';

interface CardProps {
  suit: string;
  rank: string;
  onClick?: () => void;
  playable?: boolean;
  style?: React.CSSProperties;
}

const suitSymbols: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠'
};

const suitColors: Record<string, string> = {
  hearts: 'var(--suit-hearts)',
  diamonds: 'var(--suit-diamonds)',
  clubs: 'var(--suit-clubs)',
  spades: 'var(--suit-spades)'
};

export default function CardComponent({ suit, rank, onClick, playable = false, style }: CardProps) {
  const color = suitColors[suit];
  const symbol = suitSymbols[suit];

  return (
    <motion.div
      onClick={playable ? onClick : undefined}
      whileHover={playable ? { y: -15, scale: 1.05 } : {}}
      whileTap={playable ? { scale: 0.95 } : {}}
      style={{
        width: '120px',
        height: '168px',
        backgroundColor: '#fff',
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '12px',
        cursor: playable ? 'pointer' : 'default',
        position: 'relative',
        ...style
      }}
    >
      <div style={{ color, fontSize: '24px', fontWeight: 'bold', lineHeight: 1 }}>
        {rank}
        <div style={{ fontSize: '18px' }}>{symbol}</div>
      </div>
      
      <div style={{ color, fontSize: '48px', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.8 }}>
        {symbol}
      </div>

      <div style={{ color, fontSize: '24px', fontWeight: 'bold', lineHeight: 1, textAlign: 'right', transform: 'rotate(180deg)' }}>
        {rank}
        <div style={{ fontSize: '18px' }}>{symbol}</div>
      </div>
    </motion.div>
  );
}
