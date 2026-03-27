import type { PriceData, OHLCVBar, NewsItem, ChatContact, ChatMessage, EarningsMetric, Position, RiskMetrics, Order, Bond } from '../types';

// ─── Securities Universe ───────────────────────────────────────────────────────
export const SECURITIES = [
  { ticker: 'AAPL', name: 'Apple Inc', exchange: 'NASDAQ', sector: 'Technology', currency: 'USD' },
  { ticker: 'MSFT', name: 'Microsoft Corp', exchange: 'NASDAQ', sector: 'Technology', currency: 'USD' },
  { ticker: 'NVDA', name: 'NVIDIA Corp', exchange: 'NASDAQ', sector: 'Technology', currency: 'USD' },
  { ticker: 'AMZN', name: 'Amazon.com Inc', exchange: 'NASDAQ', sector: 'Consumer Disc', currency: 'USD' },
  { ticker: 'GOOGL', name: 'Alphabet Inc', exchange: 'NASDAQ', sector: 'Technology', currency: 'USD' },
  { ticker: 'META', name: 'Meta Platforms', exchange: 'NASDAQ', sector: 'Technology', currency: 'USD' },
  { ticker: 'TSLA', name: 'Tesla Inc', exchange: 'NASDAQ', sector: 'Consumer Disc', currency: 'USD' },
  { ticker: 'JPM', name: 'JPMorgan Chase', exchange: 'NYSE', sector: 'Financials', currency: 'USD' },
  { ticker: 'V', name: 'Visa Inc', exchange: 'NYSE', sector: 'Financials', currency: 'USD' },
  { ticker: 'JNJ', name: 'Johnson & Johnson', exchange: 'NYSE', sector: 'Healthcare', currency: 'USD' },
  { ticker: 'WMT', name: 'Walmart Inc', exchange: 'NYSE', sector: 'Consumer Staples', currency: 'USD' },
  { ticker: 'UNH', name: 'UnitedHealth Group', exchange: 'NYSE', sector: 'Healthcare', currency: 'USD' },
  { ticker: 'XOM', name: 'Exxon Mobil', exchange: 'NYSE', sector: 'Energy', currency: 'USD' },
  { ticker: 'LLY', name: 'Eli Lilly & Co', exchange: 'NYSE', sector: 'Healthcare', currency: 'USD' },
  { ticker: 'MA', name: 'Mastercard Inc', exchange: 'NYSE', sector: 'Financials', currency: 'USD' },
  { ticker: 'HD', name: 'Home Depot', exchange: 'NYSE', sector: 'Consumer Disc', currency: 'USD' },
  { ticker: 'PG', name: 'Procter & Gamble', exchange: 'NYSE', sector: 'Consumer Staples', currency: 'USD' },
  { ticker: 'AVGO', name: 'Broadcom Inc', exchange: 'NASDAQ', sector: 'Technology', currency: 'USD' },
  { ticker: 'MRK', name: 'Merck & Co', exchange: 'NYSE', sector: 'Healthcare', currency: 'USD' },
  { ticker: 'CVX', name: 'Chevron Corp', exchange: 'NYSE', sector: 'Energy', currency: 'USD' },
  { ticker: 'COST', name: 'Costco Wholesale', exchange: 'NASDAQ', sector: 'Consumer Staples', currency: 'USD' },
  { ticker: 'AMD', name: 'Advanced Micro Devices', exchange: 'NASDAQ', sector: 'Technology', currency: 'USD' },
  { ticker: 'NFLX', name: 'Netflix Inc', exchange: 'NASDAQ', sector: 'Communication', currency: 'USD' },
  { ticker: 'CRM', name: 'Salesforce Inc', exchange: 'NYSE', sector: 'Technology', currency: 'USD' },
  { ticker: 'BAC', name: 'Bank of America', exchange: 'NYSE', sector: 'Financials', currency: 'USD' },
  { ticker: 'GS', name: 'Goldman Sachs', exchange: 'NYSE', sector: 'Financials', currency: 'USD' },
  { ticker: 'MS', name: 'Morgan Stanley', exchange: 'NYSE', sector: 'Financials', currency: 'USD' },
  { ticker: 'INTC', name: 'Intel Corp', exchange: 'NASDAQ', sector: 'Technology', currency: 'USD' },
  { ticker: 'QCOM', name: 'Qualcomm Inc', exchange: 'NASDAQ', sector: 'Technology', currency: 'USD' },
  { ticker: 'SPX', name: 'S&P 500 Index', exchange: 'INDEX', sector: 'Index', currency: 'USD' },
  { ticker: 'NDX', name: 'NASDAQ 100', exchange: 'INDEX', sector: 'Index', currency: 'USD' },
  { ticker: 'RUT', name: 'Russell 2000', exchange: 'INDEX', sector: 'Index', currency: 'USD' },
  { ticker: 'DJIA', name: 'Dow Jones Ind Avg', exchange: 'INDEX', sector: 'Index', currency: 'USD' },
  { ticker: 'VIX', name: 'CBOE Volatility Index', exchange: 'INDEX', sector: 'Index', currency: 'USD' },
];

// ─── Base Prices ──────────────────────────────────────────────────────────────
const BASE_PRICES: Record<string, number> = {
  AAPL: 213.5, MSFT: 415.2, NVDA: 875.4, AMZN: 195.8, GOOGL: 178.9,
  META: 545.3, TSLA: 248.7, JPM: 225.4, V: 312.8, JNJ: 158.3,
  WMT: 92.4, UNH: 528.6, XOM: 112.3, LLY: 874.2, MA: 498.7,
  HD: 385.9, PG: 165.4, AVGO: 1285.6, MRK: 128.7, CVX: 158.2,
  COST: 925.3, AMD: 178.4, NFLX: 632.8, CRM: 312.5, BAC: 44.8,
  GS: 542.3, MS: 112.4, INTC: 22.5, QCOM: 168.7,
  SPX: 5842.3, NDX: 20345.6, RUT: 2187.4, DJIA: 43254.8, VIX: 18.4,
};

// Seeded random for consistent mock data
let seed = 42;
function seededRandom() {
  seed = (seed * 1664525 + 1013904223) & 0xffffffff;
  return (seed >>> 0) / 0xffffffff;
}

// ─── Generate Price Data ───────────────────────────────────────────────────────
export function generatePriceData(ticker: string): PriceData {
  seed = ticker.split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 137;
  const base = BASE_PRICES[ticker] || 100;
  const change = (seededRandom() - 0.48) * base * 0.025;
  const last = base + change;
  const open = base + (seededRandom() - 0.5) * base * 0.01;
  const high = Math.max(last, open) * (1 + seededRandom() * 0.01);
  const low = Math.min(last, open) * (1 - seededRandom() * 0.01);
  return {
    ticker,
    last: +last.toFixed(2),
    open: +open.toFixed(2),
    high: +high.toFixed(2),
    low: +low.toFixed(2),
    close: +last.toFixed(2),
    prevClose: +base.toFixed(2),
    change: +change.toFixed(2),
    changePct: +((change / base) * 100).toFixed(2),
    volume: Math.floor(seededRandom() * 50000000 + 1000000),
    vwap: +(last * (1 + (seededRandom() - 0.5) * 0.002)).toFixed(2),
    bid: +(last - 0.05).toFixed(2),
    ask: +(last + 0.05).toFixed(2),
    bidSize: Math.floor(seededRandom() * 5000 + 100),
    askSize: Math.floor(seededRandom() * 5000 + 100),
    timestamp: Date.now(),
  };
}

// ─── Generate OHLCV History ────────────────────────────────────────────────────
export function generateOHLCV(ticker: string, days = 252): OHLCVBar[] {
  seed = ticker.split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 31337;
  const base = BASE_PRICES[ticker] || 100;
  const bars: OHLCVBar[] = [];
  let price = base * 0.75;
  const now = Date.now();
  for (let i = days; i >= 0; i--) {
    const ts = now - i * 86400000;
    const open = price;
    const change = (seededRandom() - 0.48) * price * 0.025;
    const close = Math.max(1, open + change);
    const high = Math.max(open, close) * (1 + seededRandom() * 0.01);
    const low = Math.min(open, close) * (1 - seededRandom() * 0.01);
    bars.push({ timestamp: ts, open: +open.toFixed(2), high: +high.toFixed(2), low: +low.toFixed(2), close: +close.toFixed(2), volume: Math.floor(seededRandom() * 50000000 + 1000000) });
    price = close;
  }
  return bars;
}

// ─── All Prices ───────────────────────────────────────────────────────────────
export function getAllPrices(): PriceData[] {
  return SECURITIES.map(s => generatePriceData(s.ticker));
}

// ─── Top/Bottom Performers ────────────────────────────────────────────────────
export function getTopPerformers(n = 10): PriceData[] {
  return getAllPrices().sort((a, b) => b.changePct - a.changePct).slice(0, n);
}
export function getBottomPerformers(n = 10): PriceData[] {
  return getAllPrices().sort((a, b) => a.changePct - b.changePct).slice(0, n);
}

// ─── News ─────────────────────────────────────────────────────────────────────
export const MOCK_NEWS: NewsItem[] = [
  { id: '1', headline: 'Fed Signals Pause in Rate Cuts Amid Sticky Inflation Data', source: 'Reuters', timestamp: Date.now() - 300000, summary: 'Federal Reserve officials indicated they are in no rush to cut interest rates further, citing persistent inflation pressures and resilient labor market conditions.', tags: ['Fed', 'Macro', 'Rates'], sentiment: 'bearish', tickers: ['SPX', 'TLT'] },
  { id: '2', headline: 'NVIDIA Reports Record Q4 Revenue, Beats Estimates on AI Demand', source: 'Bloomberg', timestamp: Date.now() - 600000, summary: 'NVIDIA posted record quarterly revenue driven by surging demand for AI accelerators. Data center revenue grew 112% YoY to $35.6B.', tags: ['Earnings', 'AI'], sentiment: 'bullish', tickers: ['NVDA'] },
  { id: '3', headline: 'Apple Plans Major AI Features for iPhone 18 Lineup', source: 'WSJ', timestamp: Date.now() - 900000, summary: 'Apple is planning comprehensive AI integration across iPhone 18 lineup, including on-device LLM capabilities and enhanced Siri functionality.', tags: ['AI', 'Analyst'], sentiment: 'bullish', tickers: ['AAPL'] },
  { id: '4', headline: 'China GDP Growth Disappoints, Renewing Trade War Concerns', source: 'FT', timestamp: Date.now() - 1800000, summary: 'China posted weaker than expected Q1 GDP growth of 4.2%, below the 4.8% consensus estimate, raising concerns about global demand and potential trade escalations.', tags: ['Macro', 'China'], sentiment: 'bearish', tickers: ['SPX', 'AMZN'] },
  { id: '5', headline: 'Microsoft Azure Revenue Grows 31% as Enterprise AI Adoption Accelerates', source: 'CNBC', timestamp: Date.now() - 2700000, summary: 'Microsoft Cloud segment delivered strong growth driven by Azure AI services. Management raised full-year guidance citing strong enterprise pipeline.', tags: ['Earnings', 'Cloud', 'AI'], sentiment: 'bullish', tickers: ['MSFT'] },
  { id: '6', headline: 'Oil Prices Drop 3% on Surprise Inventory Build, OPEC+ Output Concerns', source: 'Reuters', timestamp: Date.now() - 3600000, summary: 'Crude oil prices fell sharply after EIA data showed a larger-than-expected inventory build of 6.8M barrels, while OPEC+ members debated production increase.', tags: ['Commodities', 'Energy'], sentiment: 'bearish', tickers: ['XOM', 'CVX'] },
  { id: '7', headline: 'Goldman Sachs Raises S&P 500 Year-End Target to 6,200', source: 'Bloomberg', timestamp: Date.now() - 5400000, summary: 'Goldman Sachs equity strategy team raised its S&P 500 year-end price target citing better earnings trajectory and easing financial conditions.', tags: ['Analyst', 'Macro'], sentiment: 'bullish', tickers: ['SPX'] },
  { id: '8', headline: 'Tesla Deliveries Miss Q1 Estimates, Shares Slide 8%', source: 'WSJ', timestamp: Date.now() - 7200000, summary: 'Tesla delivered 336,681 vehicles in Q1 2026, missing analyst estimates of 375,000 units. The company cited factory upgrades and macroeconomic headwinds.', tags: ['Earnings', 'EV'], sentiment: 'bearish', tickers: ['TSLA'] },
];

// ─── IB Chat Data ─────────────────────────────────────────────────────────────
export const MOCK_CONTACTS: ChatContact[] = [
  { id: 'c1', name: 'Morning Note', firm: 'Research', status: 'active', unread: 3, type: 'forum', lastMessage: 'Pre-market: SPX futures +0.4%...', lastMessageTime: Date.now() - 120000 },
  { id: 'c2', name: 'Industrials', firm: 'Research Forums', status: 'active', unread: 0, type: 'forum', lastMessage: 'CAT beat on revenue but missed EPS', lastMessageTime: Date.now() - 600000 },
  { id: 'c3', name: 'Technology', firm: 'Research Forums', status: 'idle', unread: 7, type: 'forum', lastMessage: 'NVDA data center margins expanding', lastMessageTime: Date.now() - 1800000 },
  { id: 'c4', name: 'FI Trading', firm: 'Group Chats', status: 'active', unread: 2, type: 'group', lastMessage: '10Y at 4.32, watch the auction', lastMessageTime: Date.now() - 300000 },
  { id: 'c5', name: 'FX Trading', firm: 'Group Chats', status: 'active', unread: 0, type: 'group', lastMessage: 'EUR/USD consolidating at 1.085', lastMessageTime: Date.now() - 900000 },
  { id: 'c6', name: 'SPW Working Group', firm: 'Group Chats', status: 'idle', unread: 1, type: 'group', lastMessage: 'Model update deployed', lastMessageTime: Date.now() - 3600000 },
  { id: 'c7', name: 'JOELLE FLETCHER', firm: 'Goldman Sachs', status: 'active', unread: 1, type: 'counterparty', lastMessage: 'Offer: SMH DESCA .395 06/13/25', lastMessageTime: Date.now() - 180000 },
  { id: 'c8', name: 'DAN MINHUM', firm: 'JPMorgan', status: 'active', unread: 0, type: 'counterparty', lastMessage: 'Pass on that one, pricing too tight', lastMessageTime: Date.now() - 450000 },
  { id: 'c9', name: 'SARAH CHEN', firm: 'Morgan Stanley', status: 'idle', unread: 0, type: 'counterparty', lastMessage: 'Will circle back on the 5yr', lastMessageTime: Date.now() - 7200000 },
  { id: 'c10', name: 'FXGO Chatbot', firm: 'Apps', status: 'active', unread: 0, type: 'app', lastMessage: 'EUR/USD: 1.0852/1.0854', lastMessageTime: Date.now() - 60000 },
];

export const MOCK_MESSAGES: Record<string, ChatMessage[]> = {
  c7: [
    { id: 'm1', chatId: 'c7', senderId: 'c7', senderName: 'JOELLE FLETCHER', content: 'Hi, where are you in AAPL? Looking to work a block', timestamp: Date.now() - 3600000, type: 'text' },
    { id: 'm2', chatId: 'c7', senderId: 'me', senderName: 'You', content: 'Offer started SMH: DESCA .395 06/13/25 144A Settle: 07/26/25', timestamp: Date.now() - 3500000, type: 'text' },
    { id: 'm3', chatId: 'c7', senderId: 'c7', senderName: 'JOELLE FLETCHER', content: 'Interested in 500k AAPL at 212.50. Can you work it?', timestamp: Date.now() - 3400000, type: 'text', parsed: { ticker: 'AAPL', side: 'BUY', quantity: 500000, price: 212.50, currency: 'USD', intent: 'block purchase inquiry', confidence: 0.95 } },
    { id: 'm4', chatId: 'c7', senderId: 'me', senderName: 'You', content: 'Pass', timestamp: Date.now() - 180000, type: 'text' },
  ],
  c4: [
    { id: 'm5', chatId: 'c4', senderId: 'c8', senderName: 'DAN MINHUM', content: '10Y treasury at 4.32 — watching the 2pm auction closely', timestamp: Date.now() - 900000, type: 'text' },
    { id: 'm6', chatId: 'c4', senderId: 'c9', senderName: 'SARAH CHEN', content: 'Bid side looks thin, might gap higher on supply', timestamp: Date.now() - 600000, type: 'text' },
    { id: 'm7', chatId: 'c4', senderId: 'me', senderName: 'You', content: 'Concur. Reducing duration into the auction', timestamp: Date.now() - 300000, type: 'text' },
  ],
};

// ─── Earnings Data ────────────────────────────────────────────────────────────
export const MOCK_EARNINGS: EarningsMetric[] = [
  { label: 'Diluted EPS', actual: 1.64, consensus: 1.69, gsEst: 1.52, jpmEst: 1.52, msEst: 1.91, unit: '$', beatMissPct: -2.96, category: 'highlight' },
  { label: 'Revenue', actual: 124300, consensus: 124377, gsEst: 112500, jpmEst: 108540, msEst: 124500, unit: '$M', beatMissPct: -0.06, category: 'highlight' },
  { label: 'Gross Margin (%)', actual: 46.88, consensus: 46.50, gsEst: 45.90, jpmEst: 45.00, msEst: 48.50, unit: '%', beatMissPct: 0.38, category: 'highlight' },
  { label: 'Operating Margin (%)', actual: 31.69, consensus: 29.10, gsEst: 24.70, jpmEst: 45.90, msEst: 48.05, unit: '%', beatMissPct: 2.59, category: 'highlight' },
  { label: 'Services', actual: 26340, consensus: 25890, gsEst: 25200, jpmEst: 25500, msEst: 26100, unit: '$M', beatMissPct: 1.74, category: 'segment' },
  { label: 'iPhone', actual: 69140, consensus: 70200, gsEst: 68500, jpmEst: 67800, msEst: 71200, unit: '$M', beatMissPct: -1.51, category: 'segment' },
  { label: 'iPad', actual: 8088, consensus: 7950, gsEst: 7800, jpmEst: 7900, msEst: 8100, unit: '$M', beatMissPct: 1.74, category: 'segment' },
  { label: 'Mac', actual: 9963, consensus: 9800, gsEst: 9600, jpmEst: 9700, msEst: 10100, unit: '$M', beatMissPct: 1.66, category: 'segment' },
  { label: 'Wearables & Home', actual: 11894, consensus: 11540, gsEst: 11200, jpmEst: 11400, msEst: 11800, unit: '$M', beatMissPct: 3.07, category: 'segment' },
  { label: 'Americas', actual: 50338, consensus: 49800, gsEst: 48900, jpmEst: 49200, msEst: 50500, unit: '$M', beatMissPct: 1.08, category: 'regional' },
  { label: 'Europe', actual: 30296, consensus: 30100, gsEst: 29400, jpmEst: 29800, msEst: 30500, unit: '$M', beatMissPct: 0.65, category: 'regional' },
  { label: 'Greater China', actual: 21758, consensus: 22400, gsEst: 21200, jpmEst: 21000, msEst: 22800, unit: '$M', beatMissPct: -2.86, category: 'regional' },
  { label: 'Japan', actual: 7226, consensus: 7100, gsEst: 6900, jpmEst: 7000, msEst: 7200, unit: '$M', beatMissPct: 1.77, category: 'regional' },
  { label: 'FCF', actual: 32000, consensus: 30800, gsEst: 30200, jpmEst: 31000, msEst: 31500, unit: '$M', beatMissPct: 3.90, category: 'fcf' },
  { label: 'Cash & Equivalents', actual: 48580, consensus: 47200, gsEst: 46800, jpmEst: 47000, msEst: 47600, unit: '$M', beatMissPct: 2.92, category: 'fcf' },
];

// ─── Portfolio / Risk ─────────────────────────────────────────────────────────
export const MOCK_POSITIONS: Position[] = [
  { ticker: 'AAPL', name: 'Apple Inc', qty: 5000, avgCost: 195.4, marketValue: 1067500, pnl: 90500, pnlPct: 9.27, delta: 1.0, beta: 1.18, var1d: 21350, sector: 'Technology' },
  { ticker: 'NVDA', name: 'NVIDIA Corp', qty: 1200, avgCost: 720.0, marketValue: 1050480, pnl: 186480, pnlPct: 21.57, delta: 1.0, beta: 1.85, var1d: 42019, sector: 'Technology' },
  { ticker: 'MSFT', name: 'Microsoft Corp', qty: 2500, avgCost: 388.0, marketValue: 1038000, pnl: 68000, pnlPct: 7.01, delta: 1.0, beta: 0.92, var1d: 18684, sector: 'Technology' },
  { ticker: 'JPM', name: 'JPMorgan Chase', qty: 4000, avgCost: 210.0, marketValue: 901600, pnl: 61600, pnlPct: 7.33, delta: 1.0, beta: 1.12, var1d: 18032, sector: 'Financials' },
  { ticker: 'XOM', name: 'Exxon Mobil', qty: 6000, avgCost: 118.5, marketValue: 673800, pnl: -27000, pnlPct: -3.85, delta: 1.0, beta: 0.78, var1d: 13476, sector: 'Energy' },
  { ticker: 'LLY', name: 'Eli Lilly & Co', qty: 800, avgCost: 820.0, marketValue: 699360, pnl: 43360, pnlPct: 6.60, delta: 1.0, beta: 0.65, var1d: 13987, sector: 'Healthcare' },
  { ticker: 'AMZN', name: 'Amazon.com Inc', qty: 3500, avgCost: 188.0, marketValue: 685300, pnl: 26300, pnlPct: 3.99, delta: 1.0, beta: 1.32, var1d: 18184, sector: 'Consumer Disc' },
  { ticker: 'TSLA', name: 'Tesla Inc', qty: 2000, avgCost: 280.0, marketValue: 497400, pnl: -62600, pnlPct: -11.18, delta: 1.0, beta: 2.05, var1d: 24870, sector: 'Consumer Disc' },
];

export const MOCK_RISK_METRICS: RiskMetrics = {
  portfolioVar95: 89432,
  portfolioVar99: 142187,
  cvar: 168543,
  sharpe: 1.47,
  sortino: 2.12,
  maxDrawdown: -14.32,
  beta: 1.18,
  totalValue: 6613440,
  totalPnl: 386640,
};

// ─── Orders ───────────────────────────────────────────────────────────────────
export const MOCK_ORDERS: Order[] = [
  { id: 'o1', ticker: 'AAPL', side: 'BUY', qty: 10000, filled: 10000, remaining: 0, orderType: 'LIMIT', price: 212.50, status: 'FILLED', trader: 'J.SMITH', timestamp: Date.now() - 3600000, account: 'PROP-001' },
  { id: 'o2', ticker: 'NVDA', side: 'SELL', qty: 500, filled: 250, remaining: 250, orderType: 'ALGO', price: 880.00, status: 'PARTIAL', trader: 'J.SMITH', timestamp: Date.now() - 1800000, account: 'PROP-001' },
  { id: 'o3', ticker: 'TSLA', side: 'SHORT', qty: 2000, filled: 0, remaining: 2000, orderType: 'LIMIT', price: 252.00, status: 'PENDING', trader: 'M.JONES', timestamp: Date.now() - 900000, account: 'PROP-002' },
  { id: 'o4', ticker: 'JPM', side: 'BUY', qty: 3000, filled: 3000, remaining: 0, orderType: 'MARKET', price: null, status: 'FILLED', trader: 'S.LEE', timestamp: Date.now() - 7200000, account: 'CLIENT-A' },
  { id: 'o5', ticker: 'MSFT', side: 'BUY', qty: 1500, filled: 0, remaining: 1500, orderType: 'LIMIT', price: 413.00, status: 'CANCELLED', trader: 'J.SMITH', timestamp: Date.now() - 10800000, account: 'PROP-001' },
];

// ─── Bonds ────────────────────────────────────────────────────────────────────
export const MOCK_BONDS: Bond[] = [
  { isin: 'US14912L1298', issuer: 'CATERPILLAR FIN. SERVICE', coupon: 3.75, maturity: '02/23/2029', rating: 'A/A2', sector: 'Machinery-Constr&Mining', amtOutstanding: 550000000, bid: 99.901, ask: 99.930, mid: 99.916, yield: 3.785, gSpread: 27.62, iSpread: 52.79, structure: 'Bullet', couponFreq: 'Semi', dayCount: '30/360', issueDate: '02/24/2026' },
  { isin: 'US459200HU68', issuer: 'IBM CORP', coupon: 4.15, maturity: '07/27/2027', rating: 'A-/A3', sector: 'Technology', amtOutstanding: 1000000000, bid: 100.842, ask: 100.872, mid: 100.857, yield: 3.840, gSpread: 31.20, iSpread: 56.45, structure: 'Bullet', couponFreq: 'Semi', dayCount: '30/360', issueDate: '07/27/2022' },
  { isin: 'US037833DV97', issuer: 'APPLE INC', coupon: 2.65, maturity: '02/08/2051', rating: 'AA+/Aaa', sector: 'Technology', amtOutstanding: 2500000000, bid: 74.250, ask: 74.450, mid: 74.350, yield: 4.720, gSpread: 45.80, iSpread: 68.20, structure: 'Bullet', couponFreq: 'Semi', dayCount: 'A/360', issueDate: '02/08/2021' },
];

// ─── Global Indices for Top Bar ───────────────────────────────────────────────
export const GLOBAL_INDICES = [
  { ticker: 'SPX', name: 'S&P 500', price: 5842.3, change: 18.4, changePct: 0.32 },
  { ticker: 'NDX', name: 'NASDAQ', price: 20345.6, change: 124.5, changePct: 0.62 },
  { ticker: 'DJIA', name: 'DOW', price: 43254.8, change: -45.2, changePct: -0.10 },
  { ticker: 'RUT', name: 'RUSS 2K', price: 2187.4, change: 8.9, changePct: 0.41 },
  { ticker: 'VIX', name: 'VIX', price: 18.4, change: -0.8, changePct: -4.17 },
  { ticker: 'DXY', name: 'USD IDX', price: 103.42, change: 0.15, changePct: 0.15 },
  { ticker: 'GLD', name: 'GOLD', price: 2385.4, change: 12.3, changePct: 0.52 },
  { ticker: 'OIL', name: 'WTI', price: 78.42, change: -1.24, changePct: -1.55 },
];
