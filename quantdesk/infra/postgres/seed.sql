-- ─── Seed data for local development ─────────────────────────────────────────
-- Run after all migrations have completed.
-- Safe to re-run (uses ON CONFLICT DO NOTHING).

-- ── Organization ──────────────────────────────────────────────────────────────
INSERT INTO organizations (id, name, slug, display_name, domain, plan, settings)
VALUES (
  'f0000000-0000-0000-0000-000000000001',
  'Apex Capital', 'apex-capital', 'Apex Capital Partners LLC',
  'apexcapital.com', 'enterprise',
  '{"autoJoin": true, "allowCrossOrgContacts": false, "encryptionRequired": true}'::jsonb
) ON CONFLICT (slug) DO NOTHING;

-- ── Users ─────────────────────────────────────────────────────────────────────
INSERT INTO users (id, firebase_uid, email, display_name, firm, role, org_id, org_role) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'mock_admin_001',  'admin@apexcapital.com',   'Alice Chen',    'Apex Capital', 'Admin',            'f0000000-0000-0000-0000-000000000001', 'super_admin'),
  ('a0000000-0000-0000-0000-000000000002', 'mock_trader_001', 'bob@apexcapital.com',     'Bob Matthews',  'Apex Capital', 'Trader',           'f0000000-0000-0000-0000-000000000001', 'member'),
  ('a0000000-0000-0000-0000-000000000003', 'mock_analyst_01', 'carol@apexcapital.com',   'Carol Davis',   'Apex Capital', 'Equity Analyst',   'f0000000-0000-0000-0000-000000000001', 'team_lead'),
  ('a0000000-0000-0000-0000-000000000004', 'mock_pm_001',     'david@apexcapital.com',   'David Park',    'Apex Capital', 'Portfolio Manager','f0000000-0000-0000-0000-000000000001', 'admin')
ON CONFLICT (firebase_uid) DO UPDATE
  SET org_id = EXCLUDED.org_id, org_role = EXCLUDED.org_role;

-- System bot for Apex Capital
INSERT INTO users (id, firebase_uid, email, display_name, org_id, org_role, is_org_visible)
VALUES (
  'a0000000-0000-0000-0000-000000000099',
  'bot-f0000000-0000-0000-0000-000000000001',
  'broadcasts@apex-capital.quantdesk.internal',
  'Apex Capital Broadcasts',
  'f0000000-0000-0000-0000-000000000001',
  'system', false
) ON CONFLICT (firebase_uid) DO NOTHING;

UPDATE organizations
SET settings = settings || '{"botUserId": "a0000000-0000-0000-0000-000000000099"}'::jsonb
WHERE id = 'f0000000-0000-0000-0000-000000000001';

-- ── Teams ─────────────────────────────────────────────────────────────────────
INSERT INTO teams (id, org_id, name, team_type, color, created_by) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'FI Trading Desk', 'trading_desk', '#ff6600', 'a0000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', 'Equity Research',  'research',     '#00c8ff', 'a0000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000001', 'Risk Management',  'risk',         '#ff3d3d', 'a0000000-0000-0000-0000-000000000001')
ON CONFLICT (org_id, name) DO NOTHING;

INSERT INTO team_members (team_id, user_id, team_role) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'lead'),
  ('c1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'member'),
  ('c1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 'lead'),
  ('c1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004', 'member')
ON CONFLICT DO NOTHING;

-- Update team_ids on users
UPDATE users SET team_ids = ARRAY['c1000000-0000-0000-0000-000000000001'::uuid] WHERE id = 'a0000000-0000-0000-0000-000000000001';
UPDATE users SET team_ids = ARRAY['c1000000-0000-0000-0000-000000000001'::uuid] WHERE id = 'a0000000-0000-0000-0000-000000000002';
UPDATE users SET team_ids = ARRAY['c1000000-0000-0000-0000-000000000002'::uuid] WHERE id = 'a0000000-0000-0000-0000-000000000003';
UPDATE users SET team_ids = ARRAY['c1000000-0000-0000-0000-000000000002'::uuid] WHERE id = 'a0000000-0000-0000-0000-000000000004';

-- ── Securities ────────────────────────────────────────────────────────────────
INSERT INTO securities (id, ticker, exchange, name, asset_class, sector, industry, currency) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'AAPL',  'NASDAQ', 'Apple Inc.',            'Equity', 'Technology',      'Consumer Electronics',    'USD'),
  ('b0000000-0000-0000-0000-000000000002', 'MSFT',  'NASDAQ', 'Microsoft Corporation', 'Equity', 'Technology',      'Software—Infrastructure', 'USD'),
  ('b0000000-0000-0000-0000-000000000003', 'NVDA',  'NASDAQ', 'NVIDIA Corporation',    'Equity', 'Technology',      'Semiconductors',          'USD'),
  ('b0000000-0000-0000-0000-000000000004', 'TSLA',  'NASDAQ', 'Tesla Inc.',            'Equity', 'Consumer Cyclical','Auto Manufacturers',     'USD'),
  ('b0000000-0000-0000-0000-000000000005', 'AMZN',  'NASDAQ', 'Amazon.com Inc.',       'Equity', 'Consumer Cyclical','Internet Retail',        'USD'),
  ('b0000000-0000-0000-0000-000000000006', 'META',  'NASDAQ', 'Meta Platforms Inc.',   'Equity', 'Technology',      'Internet Content',        'USD'),
  ('b0000000-0000-0000-0000-000000000007', 'GOOGL', 'NASDAQ', 'Alphabet Inc.',         'Equity', 'Technology',      'Internet Content',        'USD'),
  ('b0000000-0000-0000-0000-000000000008', 'JPM',   'NYSE',   'JPMorgan Chase & Co.',  'Equity', 'Financial Services','Banks—Diversified',     'USD'),
  ('b0000000-0000-0000-0000-000000000009', 'GS',    'NYSE',   'Goldman Sachs Group',   'Equity', 'Financial Services','Capital Markets',       'USD'),
  ('b0000000-0000-0000-0000-000000000010', 'SPY',   'NYSE',   'SPDR S&P 500 ETF',      'Equity', 'ETF',             'Broad Market ETF',        'USD')
ON CONFLICT (ticker, exchange) DO NOTHING;

-- ── Portfolio + Positions ─────────────────────────────────────────────────────
INSERT INTO portfolios (id, user_id, name, description, is_paper) VALUES
  ('c0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000002',
   'MAIN_US_EQUITY',
   'Primary US equities long/short book',
   false)
ON CONFLICT DO NOTHING;

INSERT INTO positions (portfolio_id, security_id, quantity, avg_cost, side) VALUES
  ('c0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001', 5000,  215.50, 'Long'),
  ('c0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002',  800,  418.30, 'Long'),
  ('c0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000003', 1200,  880.00, 'Long'),
  ('c0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000004', -500,  248.00, 'Short')
ON CONFLICT (portfolio_id, security_id, side) DO NOTHING;

-- ── Watchlist ─────────────────────────────────────────────────────────────────
INSERT INTO watchlists (id, user_id, name, is_default) VALUES
  ('d0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002','US Tech', true)
ON CONFLICT DO NOTHING;

INSERT INTO watchlist_items (watchlist_id, security_id, sort_order) VALUES
  ('d0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001',1),
  ('d0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002',2),
  ('d0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000003',3),
  ('d0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000004',4)
ON CONFLICT (watchlist_id, security_id) DO NOTHING;

-- ── Chat rooms ────────────────────────────────────────────────────────────────
INSERT INTO chat_rooms (id, name, room_type, created_by) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'Morning Note',  'ResearchForum', 'a0000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000002', 'FI Trading',    'GroupChat',     'a0000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000003', NULL,            'DirectMessage', 'a0000000-0000-0000-0000-000000000002')
ON CONFLICT DO NOTHING;

INSERT INTO chat_members (room_id, user_id) VALUES
  ('e0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002'),
  ('e0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000003'),
  ('e0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000002'),
  ('e0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000004'),
  ('e0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000002'),
  ('e0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000003')
ON CONFLICT DO NOTHING;

-- ── Sample orders ─────────────────────────────────────────────────────────────
INSERT INTO orders (user_id, portfolio_id, security_id, side, order_type, quantity, limit_price, filled_qty, avg_fill_price, status) VALUES
  ('a0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','Buy', 'Limit',  1000, 212.50,    0, NULL,   'Pending'),
  ('a0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002','Sell','Market',  200, NULL,     200, 415.20, 'Filled'),
  ('a0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000003','Buy', 'Limit',   500, 875.00,  300, 874.50, 'PartialFill')
ON CONFLICT DO NOTHING;

-- ── Contact groups ─────────────────────────────────────────────────────────────
INSERT INTO contact_groups (owner_id, name, color, sort_order) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Internal',       '#ff6600', 0),
  ('a0000000-0000-0000-0000-000000000001', 'Counterparties', '#00c8ff', 1),
  ('a0000000-0000-0000-0000-000000000002', 'Internal',       '#ff6600', 0),
  ('a0000000-0000-0000-0000-000000000002', 'Research',       '#a8ff78', 2)
ON CONFLICT (owner_id, name) DO NOTHING;

-- ── Mutual contacts: Alice ↔ Bob ───────────────────────────────────────────────
INSERT INTO contacts (owner_id, contact_user_id, is_favorite)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', true),
  ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', false),
  ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', false),
  ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', false)
ON CONFLICT (owner_id, contact_user_id) DO NOTHING;

-- ── User personalization ───────────────────────────────────────────────────────
INSERT INTO user_personalization (user_id, preferred_name, timezone, coverage_tickers) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Ali',  'America/New_York', ARRAY['AAPL','MSFT','NVDA']),
  ('a0000000-0000-0000-0000-000000000002', 'Bob',  'Europe/London',    ARRAY['AMZN','GOOGL','META']),
  ('a0000000-0000-0000-0000-000000000003', 'Carol','America/New_York', ARRAY['JPM','GS','BAC']),
  ('a0000000-0000-0000-0000-000000000004', 'Dave', 'America/Chicago',  ARRAY['SPY','QQQ','IWM'])
ON CONFLICT (user_id) DO NOTHING;

-- ── Broadcast templates ────────────────────────────────────────────────────────
INSERT INTO broadcast_templates (org_id, created_by, name, category, body_template, default_audience_type, default_priority) VALUES
  (
    'f0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Morning Note',
    'morning_note',
    '{{greeting}} {{preferredName}},

Morning note for {{date}} — Market Status: {{marketStatus}}.

As a {{role}} on the {{teamName}} desk, here is your daily briefing:
- Your {{positionCount}} open positions require attention.
- Largest exposure: {{topHolding}}
- Daily P&L: {{dailyPnl}}

Coverage: {{coverageTickers}}

Best,
{{orgName}} Research',
    'org_wide',
    'normal'
  ),
  (
    'f0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Risk Alert',
    'risk_alert',
    '⚠ RISK ALERT — {{date}}

{{greeting}} {{preferredName}},

This is an urgent risk update for the {{teamName}} team.

Your current exposure:
- Open positions: {{positionCount}}
- Largest holding: {{topHolding}}
- P&L impact: {{dailyPnl}}

Please review your positions immediately and contact risk management if needed.

— {{orgDisplayName}} Risk Management',
    'org_wide',
    'high'
  )
ON CONFLICT (org_id, name) DO NOTHING;

-- ── Sample sent broadcast ─────────────────────────────────────────────────────
INSERT INTO broadcasts (id, org_id, created_by, title, body_template, broadcast_type, priority, audience_type, audience_config, status, approved_by, sent_at, total_recipients, delivered_count, read_count)
VALUES (
  'bc000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Morning Risk Update — March 24',
  '{{greeting}} {{preferredName}}, as a {{role}} on the {{teamName}} desk — markets are open. Your top holding {{topHolding}} is moving. P&L: {{dailyPnl}}.',
  'morning_note', 'normal', 'org_wide', '{}'::jsonb,
  'sent',
  'a0000000-0000-0000-0000-000000000004',
  NOW() - INTERVAL '2 hours',
  2, 2, 1
) ON CONFLICT DO NOTHING;

INSERT INTO broadcast_deliveries (broadcast_id, recipient_id, personalized_body, status, delivered_at, read_at) VALUES
  (
    'bc000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Good morning Ali, as a Super Admin on the FI Trading Desk desk — markets are open. Your top holding AAPL is moving. P&L: N/A.',
    'read',
    NOW() - INTERVAL '2 hours',
    NOW() - INTERVAL '1 hour'
  ),
  (
    'bc000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000002',
    'Good afternoon Bob, as a Member on the FI Trading Desk desk — markets are open. Your top holding AMZN is moving. P&L: N/A.',
    'delivered',
    NOW() - INTERVAL '2 hours',
    NULL
  )
ON CONFLICT (broadcast_id, recipient_id) DO NOTHING;
