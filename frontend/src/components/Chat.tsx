import { useState, useEffect, useRef } from 'react';
import { socket } from '../socket';

export default function Chat() {
  const [messages, setMessages] = useState<{ playerName: string; text: string; timestamp: number }[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMessage = (msg: any) => {
      setMessages(prev => [...prev, msg]);
    };
    socket.on('chat_message', handleMessage);
    return () => {
      socket.off('chat_message', handleMessage);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    socket.emit('send_message', input);
    setInput('');
  };

  return (
    <div className="glass-panel" style={{ width: '300px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '12px', borderBottom: '1px solid var(--glass-border)', fontWeight: 'bold' }}>
        Game Chat
      </div>
      <div style={{ flex: 1, padding: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ fontSize: '14px' }}>
            <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{m.playerName}: </span>
            <span>{m.text}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={sendMessage} style={{ display: 'flex', borderTop: '1px solid var(--glass-border)' }}>
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..." 
          style={{ flex: 1, padding: '12px', background: 'transparent', border: 'none', color: 'white', outline: 'none' }}
        />
        <button type="submit" style={{ padding: '0 16px', background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 'bold' }}>Send</button>
      </form>
    </div>
  );
}
