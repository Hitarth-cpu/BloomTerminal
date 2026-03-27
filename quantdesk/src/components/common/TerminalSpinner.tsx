import { useEffect, useState } from 'react';

const FRAMES = ['|', '/', '—', '\\'];

export function TerminalSpinner({ text = 'LOADING...' }: { text?: string }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setFrame(f => (f + 1) % FRAMES.length), 120);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      fontFamily: 'var(--font-mono)', fontSize: 12,
      color: 'var(--accent-primary, #ff6600)',
    }}>
      <span style={{ width: 12, display: 'inline-block', textAlign: 'center' }}>{FRAMES[frame]}</span>
      <span style={{ letterSpacing: '0.05em' }}>{text}</span>
    </div>
  );
}
