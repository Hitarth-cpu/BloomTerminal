import { NewsFeed } from '../../components/news/NewsFeed';

export function NewsFeedPage() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--bg-border)', flexShrink: 0 }}>
        <h1 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
          News Feed
        </h1>
        <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          Real-time financial news · Reuters · Bloomberg · CNBC · MarketWatch
        </p>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <NewsFeed />
      </div>
    </div>
  );
}
