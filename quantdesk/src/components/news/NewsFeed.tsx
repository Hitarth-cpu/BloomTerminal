import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, Minus, ExternalLink, Zap, Rss } from 'lucide-react';
import { fetchNews, type NewsItem } from '../../services/api/newsApi';
import { fetchAllRssFeeds, type RssItem, RSS_FEEDS } from '../../services/rssProxy';
import { useSmartPoll } from '../../hooks/useSmartPoll';

// Dispatch a custom event to switch the research tab to ASKB
function openAskbWithQuery(query: string) {
  window.dispatchEvent(new CustomEvent('research:open-askb', { detail: { query } }));
}

const CATEGORIES = ['All', 'Markets', 'Earnings', 'Macro', 'Energy', 'Crypto', 'Tech'];
const RSS_CATEGORY_MAP: Record<string, string[]> = {
  Markets: ['Markets'],
  Earnings: ['Earnings'],
  Macro: ['Macro'],
  Energy: ['Energy'],
  Crypto: ['Crypto'],
  Tech: ['Tech'],
};

function timeAgo(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const SOURCE_COLORS: Record<string, string> = {
  'Reuters': '#ff6600',
  'Reuters Markets': '#ff6600',
  'Reuters Business': '#ff6600',
  'Bloomberg': '#1a73e8',
  'CNBC': '#00c8ff',
  'MarketWatch': '#22c55e',
  'Yahoo Finance': '#6d28d9',
  'Polygon': '#f59e0b',
  'Investing.com': '#ef4444',
  'BBC Business': '#bb1919',
  'Hacker News': '#ff6600',
  'Ars Technica': '#ff4c00',
  'The Verge': '#e529af',
  'CoinDesk': '#2c56dd',
  'Fed Reserve': '#1d4ed8',
  'Earnings News': '#f59e0b',
  'Energy News': '#16a34a',
  'Crypto News': '#8b5cf6',
};

type DataSource = 'api' | 'rss';

// Normalize RSS items to NewsItem format for unified rendering
function rssToNewsItem(rss: RssItem): NewsItem {
  return {
    id: rss.id,
    title: rss.title,
    summary: rss.summary || null,
    url: rss.link,
    source: rss.source,
    published_at: rss.publishedAt.toISOString(),
    tickers: [],
    categories: [rss.category],
    sentiment: null,
    ai_summary: null,
    is_breaking: rss.isBreaking,
    image_url: null,
  };
}

export function NewsFeed({ ticker }: { ticker?: string }) {
  const [items, setItems]               = useState<NewsItem[]>([]);
  const [loading, setLoading]           = useState(true);
  const [category, setCategory]         = useState('All');
  const [search, setSearch]             = useState('');
  const [debouncedSearch, setDebounced] = useState('');
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [breakingItem, setBreakingItem] = useState<NewsItem | null>(null);
  const [sortBreaking, setSortBreaking] = useState(false);
  const [dataSource, setDataSource]     = useState<DataSource>('api');
  const [feedCount, setFeedCount]       = useState(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const breakingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebounced(search), 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Try backend API first (has DB, sentiment, AI summaries)
      const params: Parameters<typeof fetchNews>[0] = { limit: 40 };
      if (ticker) params.tickers = ticker;
      if (category !== 'All') params.categories = category;
      const data = await fetchNews(params);
      if (data.items.length > 0) {
        setItems(data.items);
        setDataSource('api');
        setFeedCount(data.items.length);
        setLoading(false);
        return;
      }
    } catch {
      // Backend unavailable — fall through to RSS
    }

    // Fallback: Direct RSS feed fetching (no backend needed)
    try {
      const rssCategories = category !== 'All' ? RSS_CATEGORY_MAP[category] : undefined;
      const rssItems = await fetchAllRssFeeds(rssCategories);
      const normalized = rssItems.map(rssToNewsItem);
      setItems(normalized);
      setDataSource('rss');
      setFeedCount(Object.values(RSS_FEEDS).flat().length);
    } catch {
      // Both failed
    } finally {
      setLoading(false);
    }
  }, [ticker, category]);

  useEffect(() => { void load(); }, [load]);

  // Smart polling: 60s base, backs off on errors, pauses when tab hidden
  useSmartPoll(load, { intervalMs: 60_000, pauseWhenHidden: true, refreshOnVisible: true });

  // WebSocket listener for NEWS_UPDATE
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string) as { type: string; item: NewsItem };
        if (msg.type === 'NEWS_UPDATE' && msg.item) {
          setItems(prev => [msg.item, ...prev.slice(0, 99)]);
          if (msg.item.is_breaking) {
            setBreakingItem(msg.item);
            if (breakingTimer.current) clearTimeout(breakingTimer.current);
            breakingTimer.current = setTimeout(() => setBreakingItem(null), 30000);
          }
        }
      } catch { /* ignore */ }
    };

    // Attach to any existing WebSocket on the window object
    const ws = (window as unknown as { __quantdeskWs?: WebSocket }).__quantdeskWs;
    if (ws) ws.addEventListener('message', handler);
    return () => {
      if (ws) ws.removeEventListener('message', handler);
      if (breakingTimer.current) clearTimeout(breakingTimer.current);
    };
  }, []);

  const filtered = items
    .filter(item => {
      if (!debouncedSearch) return true;
      const q = debouncedSearch.toLowerCase();
      return item.title.toLowerCase().includes(q) || (item.summary ?? '').toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sortBreaking) {
        if (a.is_breaking && !b.is_breaking) return -1;
        if (!a.is_breaking && b.is_breaking)  return 1;
      }
      return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
    });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'var(--font-mono)' }}>

      {/* Breaking news banner */}
      {breakingItem && (
        <div
          style={{
            background: '#ff3d3d',
            color: '#000',
            padding: '8px 16px',
            fontSize: 11,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            animation: 'slideDown 0.3s ease',
            flexShrink: 0,
          }}
          onClick={() => setBreakingItem(null)}
        >
          <Zap size={12} />
          BREAKING: {breakingItem.title} · click to dismiss
        </div>
      )}

      {/* Header */}
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid var(--bg-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search news…"
            style={{
              padding: '4px 8px',
              fontSize: 11,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--bg-border)',
              color: 'var(--text-primary)',
              borderRadius: 2,
              width: 160,
              fontFamily: 'var(--font-mono)',
            }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={sortBreaking}
              onChange={e => setSortBreaking(e.target.checked)}
              style={{ width: 12, height: 12 }}
            />
            Breaking first
          </label>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 8, color: dataSource === 'rss' ? '#f59e0b' : '#22c55e',
            display: 'flex', alignItems: 'center', gap: 3,
          }}>
            <Rss size={8} />
            {dataSource === 'rss' ? `RSS · ${feedCount} feeds` : `API · ${feedCount} items`}
          </span>
          <button
            onClick={() => void load()}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
            }}
          >
            <RefreshCw size={11} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Category filters */}
      <div style={{
        display: 'flex',
        gap: 2,
        padding: '6px 12px',
        borderBottom: '1px solid var(--bg-border)',
        overflowX: 'auto',
        flexShrink: 0,
      }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            style={{
              padding: '3px 10px',
              fontSize: 10,
              fontWeight: 700,
              borderRadius: 2,
              border: 'none',
              background: category === cat ? 'var(--accent-primary, #ff6600)' : 'var(--bg-secondary)',
              color: category === cat ? '#000' : 'var(--text-muted)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* News list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && items.length === 0 ? (
          // Loading skeleton
          [1, 2, 3].map(i => (
            <div key={i} style={{ padding: '10px 14px', borderBottom: '1px solid var(--bg-border)', opacity: 0.4 }}>
              <div style={{ height: 10, background: 'var(--bg-secondary)', borderRadius: 2, marginBottom: 6, width: '80%' }} />
              <div style={{ height: 8, background: 'var(--bg-secondary)', borderRadius: 2, width: '60%' }} />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>No news found.</div>
        ) : (
          filtered.map(item => {
            const isExpanded = expandedId === item.id;
            const sentColor =
              item.sentiment === 'bullish' ? 'var(--positive, #22c55e)' :
              item.sentiment === 'bearish' ? 'var(--negative, #ef4444)' :
              'var(--bg-border)';
            const srcColor = SOURCE_COLORS[item.source] ?? 'var(--text-muted)';

            return (
              <div
                key={item.id}
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
                style={{
                  borderBottom: '1px solid var(--bg-border)',
                  borderLeft: `3px solid ${sentColor}`,
                  padding: '8px 12px 8px 10px',
                  cursor: 'pointer',
                  background: isExpanded ? 'var(--bg-secondary)' : 'transparent',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => {
                  if (!isExpanded) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.02)';
                }}
                onMouseLeave={e => {
                  if (!isExpanded) (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                }}
              >
                {/* Meta row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: srcColor, letterSpacing: '0.05em' }}>
                    {item.source.toUpperCase()}
                  </span>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>·</span>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{timeAgo(item.published_at)}</span>
                  {item.is_breaking && (
                    <span style={{
                      fontSize: 8,
                      fontWeight: 700,
                      color: '#ff3d3d',
                      border: '1px solid #ff3d3d',
                      borderRadius: 2,
                      padding: '1px 4px',
                      letterSpacing: '0.1em',
                    }}>
                      BREAKING
                    </span>
                  )}
                </div>

                {/* Headline */}
                <div style={{
                  fontSize: 12,
                  color: 'var(--text-primary)',
                  fontWeight: 500,
                  lineHeight: 1.4,
                  marginBottom: 4,
                }}>
                  {item.title}
                </div>

                {/* Summary (collapsed) */}
                {!isExpanded && item.summary && (
                  <div style={{
                    fontSize: 10,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    marginBottom: 4,
                  }}>
                    {item.summary}
                  </div>
                )}

                {/* Bottom row: tickers + sentiment */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                  {item.tickers.slice(0, 4).map(t => (
                    <span key={t} style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: 'var(--accent-primary, #ff6600)',
                      background: 'rgba(255,102,0,0.08)',
                      borderRadius: 2,
                      padding: '1px 5px',
                      border: '1px solid rgba(255,102,0,0.2)',
                    }}>
                      {t}
                    </span>
                  ))}
                  {item.sentiment && (
                    <span style={{
                      fontSize: 9,
                      fontWeight: 700,
                      marginLeft: 'auto',
                      color:
                        item.sentiment === 'bullish' ? 'var(--positive)' :
                        item.sentiment === 'bearish' ? 'var(--negative)' :
                        'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                    }}>
                      {item.sentiment === 'bullish' ? <TrendingUp size={9} /> :
                       item.sentiment === 'bearish' ? <TrendingDown size={9} /> :
                       <Minus size={9} />}
                      {item.sentiment.toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div style={{ marginTop: 10, borderTop: '1px solid var(--bg-border)', paddingTop: 10 }}>
                    {item.ai_summary && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{
                          fontSize: 9,
                          fontWeight: 700,
                          color: 'var(--accent-primary)',
                          letterSpacing: '0.1em',
                          marginBottom: 4,
                        }}>
                          AI SUMMARY
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                          {item.ai_summary}
                        </div>
                      </div>
                    )}
                    {item.summary && !item.ai_summary && (
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 10 }}>
                        {item.summary}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 10,
                          color: 'var(--accent-primary)',
                          textDecoration: 'none',
                        }}
                      >
                        <ExternalLink size={10} /> Read full article
                      </a>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          openAskbWithQuery(`Analyze this news: ${item.title}`);
                        }}
                        style={{
                          fontSize: 10,
                          background: 'none',
                          border: '1px solid var(--bg-border)',
                          color: 'var(--text-muted)',
                          borderRadius: 2,
                          padding: '2px 8px',
                          cursor: 'pointer',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        Ask ASKB
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-100%); }
          to   { transform: translateY(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
