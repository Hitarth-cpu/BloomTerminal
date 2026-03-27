const TICKERS = [
  { sym: 'SPX',     price: '5,842.34', change: '+0.29%', up: true  },
  { sym: 'NDX',     price: '20,341.5', change: '+0.47%', up: true  },
  { sym: 'DJIA',    price: '43,239',   change: '-0.11%', up: false },
  { sym: 'AAPL',    price: '264.58',   change: '+0.34%', up: true  },
  { sym: 'MSFT',    price: '415.20',   change: '+0.18%', up: true  },
  { sym: 'NVDA',    price: '887.42',   change: '+1.22%', up: true  },
  { sym: 'TSLA',    price: '248.50',   change: '+1.53%', up: true  },
  { sym: 'AMZN',    price: '197.30',   change: '+0.66%', up: true  },
  { sym: 'META',    price: '541.22',   change: '+0.91%', up: true  },
  { sym: 'BTC',     price: '87,234',   change: '+2.14%', up: true  },
  { sym: 'GLD',     price: '2,341',    change: '-0.08%', up: false },
  { sym: 'EUR/USD', price: '1.0821',   change: '-0.04%', up: false },
  { sym: 'WTI',     price: '78.34',    change: '-0.31%', up: false },
];

// Duplicate for seamless infinite loop
const ALL = [...TICKERS, ...TICKERS];

export function TerminalTickerBar() {
  return (
    <div style={{ overflow: 'hidden', flex: 1, height: '100%', display: 'flex', alignItems: 'center' }}>
      <div className="auth-ticker-track">
        {ALL.map((t, i) => (
          <span
            key={i}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '0 16px', whiteSpace: 'nowrap',
              borderRight: '1px solid var(--bg-border)',
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-secondary)', letterSpacing: 0.5 }}>
              {t.sym}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-primary)' }}>
              {t.price}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: t.up ? 'var(--positive)' : 'var(--negative)' }}>
              {t.up ? '▲' : '▼'}{t.change}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
