/**
 * Full Postgres seed script — run ONCE to bootstrap the database.
 *
 * Usage:
 *   cd d:/programming/Quant/quantdesk
 *   ALICE_FIREBASE_UID=xxx BOB_FIREBASE_UID=yyy ADMIN_FIREBASE_UID=zzz \
 *     npx ts-node -e "require('./apps/api/src/db/postgres')" scripts/seedDatabase.ts
 *
 * Or set UIDs in .env and run:
 *   npx ts-node --project apps/api/tsconfig.json scripts/seedDatabase.ts
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';

// Read Firebase UIDs from env or use placeholders
const ALICE_FIREBASE_UID = process.env.ALICE_FIREBASE_UID ?? 'REPLACE_WITH_ALICE_UID';
const BOB_FIREBASE_UID   = process.env.BOB_FIREBASE_UID   ?? 'REPLACE_WITH_BOB_UID';
const ADMIN_FIREBASE_UID = process.env.ADMIN_FIREBASE_UID ?? 'REPLACE_WITH_ADMIN_UID';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const ORG_ID         = '00000000-0000-0000-0001-000000000001';
const ALICE_ID       = '00000000-0000-0000-0002-000000000001';
const BOB_ID         = '00000000-0000-0000-0002-000000000002';
const ADMIN_ID       = '00000000-0000-0000-0002-000000000003';
const BOT_ID         = '00000000-0000-0000-0002-000000000099';
const TEAM_TRADING   = '00000000-0000-0000-0003-000000000001';
const TEAM_RESEARCH  = '00000000-0000-0000-0003-000000000002';
const TEAM_RISK      = '00000000-0000-0000-0003-000000000003';
const ROOM_AB        = '00000000-0000-0000-0004-000000000001';

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── ORGANIZATION ──
    await client.query(`
      INSERT INTO organizations (id, name, slug, display_name, domain, plan, settings)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (slug) DO UPDATE SET display_name=EXCLUDED.display_name
    `, [ORG_ID,'Apex Capital','apex-capital','Apex Capital Partners LLC',
        'apexcapital.com','enterprise',
        JSON.stringify({ allowCrossOrgContacts:false, broadcastRequireApproval:false,
                         retentionDays:90, encryptionRequired:true })]);

    // ── USERS ──
    await client.query(`
      INSERT INTO users (id,firebase_uid,email,display_name,firm,role,org_id,org_role,is_active)
      VALUES
        ($1,$2,'alice@apexcapital.com','Alice Chen','Apex Capital','Trader',$3,'member',true),
        ($4,$5,'bob@apexcapital.com','Bob Matthews','Apex Capital','Analyst',$6,'member',true),
        ($7,$8,'admin@apexcapital.com','System Administrator','Apex Capital','Admin',$9,'super_admin',true),
        ($10,$11,'broadcasts@apex-capital.quantdesk.internal','Apex Capital Broadcasts','Apex Capital','System',$12,'system',true)
      ON CONFLICT (firebase_uid) DO UPDATE
        SET email=EXCLUDED.email, display_name=EXCLUDED.display_name
    `, [ALICE_ID,ALICE_FIREBASE_UID,ORG_ID,
        BOB_ID,BOB_FIREBASE_UID,ORG_ID,
        ADMIN_ID,ADMIN_FIREBASE_UID,ORG_ID,
        BOT_ID,`bot-${ORG_ID}`,ORG_ID]);

    // ── USER PERSONALIZATION ──
    await client.query(`
      INSERT INTO user_personalization (user_id,preferred_name,timezone,coverage_tickers,notification_prefs)
      VALUES
        ($1,'Ali','America/New_York','{AAPL,MSFT,NVDA,TSLA}','{"broadcasts":true,"contactRequests":true}'),
        ($2,'Bob','Europe/London','{AMZN,GOOGL,META,NFLX}','{"broadcasts":true,"contactRequests":true}')
      ON CONFLICT (user_id) DO NOTHING
    `, [ALICE_ID, BOB_ID]);

    // ── TEAMS ──
    await client.query(`
      INSERT INTO teams (id,org_id,name,team_type,color,created_by)
      VALUES
        ($1,$2,'FI Trading Desk','trading_desk','#ff6600',$3),
        ($4,$5,'Equity Research','research','#00d4aa',$6),
        ($7,$8,'Risk Management','risk','#ffcc00',$9)
      ON CONFLICT (org_id,name) DO NOTHING
    `, [TEAM_TRADING,ORG_ID,ADMIN_ID, TEAM_RESEARCH,ORG_ID,ADMIN_ID, TEAM_RISK,ORG_ID,ADMIN_ID]);

    await client.query(`
      INSERT INTO team_members (team_id,user_id,team_role)
      VALUES ($1,$2,'lead'),($3,$4,'member')
      ON CONFLICT (team_id,user_id) DO NOTHING
    `, [TEAM_TRADING,ALICE_ID, TEAM_RESEARCH,BOB_ID]);

    await client.query(`UPDATE users SET team_ids=$1 WHERE id=$2`,[`{${TEAM_TRADING}}`,ALICE_ID]);
    await client.query(`UPDATE users SET team_ids=$1 WHERE id=$2`,[`{${TEAM_RESEARCH}}`,BOB_ID]);

    // ── CONTACT GROUPS ──
    const AG = randomUUID(), BG = randomUUID();
    await client.query(`
      INSERT INTO contact_groups (id,owner_id,name,color,sort_order)
      VALUES ($1,$2,'Internal','#ff6600',0),($3,$4,'Internal','#ff6600',0)
      ON CONFLICT (owner_id,name) DO NOTHING
    `, [AG,ALICE_ID, BG,BOB_ID]);

    // ── BIDIRECTIONAL CONTACTS ──
    await client.query(`
      INSERT INTO contacts (owner_id,contact_user_id,group_id,is_favorite)
      VALUES ($1,$2,$3,true),($4,$5,$6,true)
      ON CONFLICT (owner_id,contact_user_id) DO NOTHING
    `, [ALICE_ID,BOB_ID,AG, BOB_ID,ALICE_ID,BG]);

    // ── CHAT ROOM ──
    await client.query(`
      INSERT INTO chat_rooms (id,name,room_type,created_by)
      VALUES ($1,'Alice / Bob','DirectMessage',$2)
      ON CONFLICT DO NOTHING
    `, [ROOM_AB,ALICE_ID]);

    await client.query(`
      INSERT INTO chat_members (room_id,user_id)
      VALUES ($1,$2),($1,$3)
      ON CONFLICT (room_id,user_id) DO NOTHING
    `, [ROOM_AB,ALICE_ID,BOB_ID]);

    // ── SECURITIES ──
    const secs = [
      ['AAPL','NASDAQ','Apple Inc','Equity','USD','Technology','Large Cap'],
      ['MSFT','NASDAQ','Microsoft Corp','Equity','USD','Technology','Large Cap'],
      ['NVDA','NASDAQ','NVIDIA Corp','Equity','USD','Technology','Large Cap'],
      ['TSLA','NASDAQ','Tesla Inc','Equity','USD','Consumer Discretionary','Large Cap'],
      ['AMZN','NASDAQ','Amazon.com Inc','Equity','USD','Consumer Discretionary','Large Cap'],
      ['GOOGL','NASDAQ','Alphabet Inc','Equity','USD','Communication Services','Large Cap'],
      ['META','NASDAQ','Meta Platforms Inc','Equity','USD','Communication Services','Large Cap'],
      ['JPM','NYSE','JPMorgan Chase & Co','Equity','USD','Financials','Large Cap'],
      ['GS','NYSE','Goldman Sachs Group','Equity','USD','Financials','Large Cap'],
      ['SPY','NYSE','SPDR S&P 500 ETF','ETF','USD','Broad Market','ETF'],
    ];
    for (const [t,e,n,ac,cur,sec,ind] of secs) {
      await client.query(`
        INSERT INTO securities (ticker,exchange,name,asset_class,currency,sector,industry)
        VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (ticker,exchange) DO NOTHING
      `, [t,e,n,ac,cur,sec,ind]);
    }

    // ── PORTFOLIOS ──
    const AP = randomUUID(), BP = randomUUID();
    await client.query(`
      INSERT INTO portfolios (id,user_id,name,currency)
      VALUES ($1,$2,'Main Trading Book','USD'),($3,$4,'Research Portfolio','USD')
      ON CONFLICT DO NOTHING
    `, [AP,ALICE_ID, BP,BOB_ID]);

    // ── PERFORMANCE SNAPSHOTS (7 days) ──
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate()-i);
      const ds = d.toISOString().split('T')[0];
      const pnl = (Math.random()-0.4)*50000;
      const trades = Math.floor(Math.random()*8)+2;
      await client.query(`
        INSERT INTO performance_snapshots
          (user_id,org_id,snapshot_date,daily_pnl,trades_count,winning_trades,volume_traded)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (user_id,snapshot_date) DO UPDATE SET daily_pnl=EXCLUDED.daily_pnl
      `, [ALICE_ID,ORG_ID,ds,pnl,trades,Math.floor(trades*0.6),Math.abs(pnl)*10]);
    }

    // ── IB PUBLIC KEYS (placeholder) ──
    await client.query(`
      INSERT INTO ib_public_keys (user_id,public_key,key_version)
      VALUES ($1,'PENDING_CLIENT_KEY_GENERATION',1),($2,'PENDING_CLIENT_KEY_GENERATION',1)
      ON CONFLICT (user_id) DO NOTHING
    `, [ALICE_ID, BOB_ID]);

    await client.query('COMMIT');
    console.log('✅ Database seeded successfully');
    console.log(`   Org:       ${ORG_ID}`);
    console.log(`   Alice:     ${ALICE_ID} (${ALICE_FIREBASE_UID})`);
    console.log(`   Bob:       ${BOB_ID}   (${BOB_FIREBASE_UID})`);
    console.log(`   Admin:     ${ADMIN_ID} (${ADMIN_FIREBASE_UID})`);
    console.log(`   Chat Room: ${ROOM_AB}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(e => { console.error(e); process.exit(1); });
