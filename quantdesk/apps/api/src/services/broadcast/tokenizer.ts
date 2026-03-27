import Handlebars from 'handlebars';
import { formatInTimeZone } from 'date-fns-tz';
import { format } from 'date-fns';
import { query } from '../../db/postgres';

// ─── Token interface ────────────────────────────────────────────────────────

export interface PersonalizationTokens {
  firstName:       string;
  lastName:        string;
  fullName:        string;
  preferredName:   string;
  email:           string;
  role:            string;
  orgName:         string;
  orgDisplayName:  string;
  teamName:        string;
  teamNames:       string;
  positionCount:   string;
  topHolding:      string;
  portfolioValue:  string;
  dailyPnl:        string;
  date:            string;
  time:            string;
  marketStatus:    string;
  coverageTickers: string;
  greeting:        string;
}

// ─── Register Handlebars helpers ────────────────────────────────────────────

Handlebars.registerHelper('upper',    (v: unknown) => String(v ?? '').toUpperCase());
Handlebars.registerHelper('lower',    (v: unknown) => String(v ?? '').toLowerCase());
Handlebars.registerHelper('currency', (v: unknown) => {
  const n = Number(v);
  if (isNaN(n)) return String(v ?? '');
  return '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0 });
});
Handlebars.registerHelper('ifRole', function(
  this: unknown,
  role: string,
  targetRole: string,
  ifMatch: string,
  ifNot: string,
) {
  return role === targetRole ? ifMatch : ifNot;
});

// Cache compiled templates
const templateCache = new Map<string, Handlebars.TemplateDelegate>();

function compile(tpl: string): Handlebars.TemplateDelegate {
  if (!templateCache.has(tpl)) {
    templateCache.set(tpl, Handlebars.compile(tpl, { noEscape: true }));
  }
  return templateCache.get(tpl)!;
}

// ─── Render ─────────────────────────────────────────────────────────────────

export function renderTemplate(template: string, tokens: PersonalizationTokens): string {
  try {
    return compile(template)(tokens);
  } catch (err) {
    // Never expose raw placeholders — fallback to safe string replacement
    return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
      return (tokens as unknown as Record<string, string>)[key] ?? key;
    });
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getGreeting(tz: string): string {
  const hour = parseInt(formatInTimeZone(new Date(), tz, 'HH'), 10);
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getMarketStatus(): string {
  const nyHour = parseInt(formatInTimeZone(new Date(), 'America/New_York', 'HH'), 10);
  const nyMin  = parseInt(formatInTimeZone(new Date(), 'America/New_York', 'mm'), 10);
  const nyDay  = parseInt(formatInTimeZone(new Date(), 'America/New_York', 'i'), 10); // 1=Mon,7=Sun
  const mins   = nyHour * 60 + nyMin;
  if (nyDay === 6 || nyDay === 7) return 'Closed';
  if (mins < 570)  return 'Pre-Market';  // before 09:30
  if (mins < 960)  return 'Open';        // 09:30–16:00
  if (mins < 1200) return 'After Hours'; // 16:00–20:00
  return 'Closed';
}

const TZ_ABBR: Record<string, string> = {
  'America/New_York':    'ET',
  'America/Chicago':     'CT',
  'America/Los_Angeles': 'PT',
  'Europe/London':       'GMT',
  'Asia/Tokyo':          'JST',
  'Asia/Hong_Kong':      'HKT',
};

function formatPnl(pnl: number): string {
  const sign = pnl >= 0 ? '+' : '-';
  const abs  = Math.abs(pnl);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `${sign}$${Math.round(abs / 1_000)}K`;
  return `${sign}$${abs.toLocaleString('en-US')}`;
}

// ─── Token builder ──────────────────────────────────────────────────────────

export async function buildTokensForUser(
  userId: string,
  orgId:  string,
): Promise<PersonalizationTokens> {
  // 1. Fetch user + personalization + org in one query
  const rows = await query<{
    display_name:     string;
    email:            string;
    firm:             string | null;
    org_role:         string;
    team_ids:         string[];
    preferred_name:   string | null;
    timezone:         string | null;
    coverage_tickers: string[] | null;
    org_name:         string | null;
    org_display_name: string | null;
  }>(
    `SELECT u.display_name, u.email, u.firm, u.org_role, u.team_ids,
            p.preferred_name, p.timezone, p.coverage_tickers,
            o.name AS org_name, o.display_name AS org_display_name
     FROM users u
     LEFT JOIN user_personalization p ON p.user_id = u.id
     LEFT JOIN organizations o ON o.id = $2
     WHERE u.id = $1`,
    [userId, orgId],
  );

  if (!rows[0]) return defaultTokens();
  const r = rows[0];

  const nameParts  = (r.display_name ?? '').trim().split(/\s+/);
  const firstName  = nameParts[0]  ?? 'Trader';
  const lastName   = nameParts.slice(1).join(' ');
  const tz         = r.timezone ?? 'America/New_York';
  const tzAbbr     = TZ_ABBR[tz] ?? 'UTC';

  // 2. Fetch team names
  let teamNames = '';
  if (r.team_ids?.length) {
    const teams = await query<{ name: string }>(
      'SELECT name FROM teams WHERE id = ANY($1) AND is_active = true ORDER BY name',
      [r.team_ids],
    );
    teamNames = teams.map(t => t.name).join(', ');
  }

  // 3. Portfolio context
  let positionCount = '0', topHolding = 'N/A', portfolioValue = 'N/A', dailyPnl = 'N/A';
  try {
    const [pf] = await query<{ id: string }>(
      'SELECT id FROM portfolios WHERE user_id = $1 LIMIT 1', [userId],
    );
    if (pf) {
      const positions = await query<{ ticker: string; quantity: number; avg_cost: number | null }>(
        'SELECT ticker, quantity, avg_cost FROM positions WHERE portfolio_id = $1', [pf.id],
      );
      positionCount = String(positions.length);
      const byValue = positions
        .map(p => ({ ticker: p.ticker, mv: p.quantity * (p.avg_cost ?? 0) }))
        .sort((a, b) => b.mv - a.mv);
      if (byValue[0]) topHolding = byValue[0].ticker;
      const totalVal = byValue.reduce((s, p) => s + p.mv, 0);
      if (totalVal >= 1_000_000) portfolioValue = `$${(totalVal / 1_000_000).toFixed(1)}M`;
      else if (totalVal >= 1000) portfolioValue = `$${Math.round(totalVal / 1000)}K`;
    }
  } catch { /* no portfolio */ }

  // 4. Date / time in user's timezone
  const now     = new Date();
  const dateStr = formatInTimeZone(now, tz, 'EEEE, MMMM d');
  const timeStr = formatInTimeZone(now, tz, 'HH:mm') + ' ' + tzAbbr;

  return {
    firstName,
    lastName,
    fullName:        r.display_name,
    preferredName:   r.preferred_name ?? firstName,
    email:           r.email,
    role:            capitalize(r.org_role ?? 'member'),
    orgName:         r.org_name         ?? 'QuantDesk',
    orgDisplayName:  r.org_display_name ?? 'QuantDesk',
    teamName:        teamNames.split(',')[0].trim() || r.org_name || 'General',
    teamNames:       teamNames || r.org_name || 'General',
    positionCount,
    topHolding,
    portfolioValue,
    dailyPnl,
    date:            dateStr,
    time:            timeStr,
    marketStatus:    getMarketStatus(),
    coverageTickers: (r.coverage_tickers ?? []).join(', ') || 'N/A',
    greeting:        getGreeting(tz),
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}

function defaultTokens(): PersonalizationTokens {
  const now = new Date();
  return {
    firstName: 'Trader', lastName: '', fullName: 'Trader', preferredName: 'Trader',
    email: '', role: 'Member', orgName: 'QuantDesk', orgDisplayName: 'QuantDesk',
    teamName: 'General', teamNames: 'General',
    positionCount: '0', topHolding: 'N/A', portfolioValue: 'N/A', dailyPnl: 'N/A',
    date: format(now, 'EEEE, MMMM d'),
    time: format(now, 'HH:mm') + ' UTC',
    marketStatus: getMarketStatus(),
    coverageTickers: 'N/A', greeting: getGreeting('America/New_York'),
  };
}
