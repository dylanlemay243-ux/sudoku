// Sudoku backend — one Cloudflare Worker + one D1 database.
// No accounts: each install generates a random device id and picks a display
// name. The name is a label on the id, not an identity.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...CORS } });

// The day's puzzle seed. Every device generates the same grid from this string,
// so nothing about the puzzle travels over the wire and the solution is never
// sent to the client.
function todaySeed() {
  return new Date().toISOString().slice(0, 10);
}

const MODES = ['gentle', 'easy', 'steady', 'hard', 'fiendish', 'daily'];
// Difficulty weights used for the rating: a slow fiendish solve beats a fast
// gentle one.
const WEIGHT = { gentle: 1, easy: 1.4, steady: 2, hard: 2.8, fiendish: 4, daily: 2.2 };

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '');

    try {
      if (path === '/api/daily') {
        return json({ seed: todaySeed(), clues: 32 });
      }

      if (path === '/api/solve' && request.method === 'POST') {
        const body = await request.json();
        const device = String(body.device || '').slice(0, 64);
        const name = String(body.name || 'anonymous').slice(0, 24).replace(/[^\w.\- ]/g, '');
        const mode = MODES.includes(body.mode) ? body.mode : 'steady';
        const seconds = Math.round(Number(body.seconds));

        if (!device || !Number.isFinite(seconds) || seconds < 20 || seconds > 86400) {
          return json({ error: 'bad request' }, 400);
        }

        // One ranked daily result per device per day.
        if (mode === 'daily') {
          const seed = todaySeed();
          const seen = await env.DB.prepare(
            'SELECT 1 FROM solves WHERE device = ? AND mode = ? AND seed = ?'
          ).bind(device, 'daily', seed).first();
          if (seen) return json({ ok: true, duplicate: true });
          await env.DB.prepare(
            'INSERT INTO solves (device, name, mode, seed, seconds, day) VALUES (?,?,?,?,?,?)'
          ).bind(device, name, 'daily', seed, seconds, seed).run();
        } else {
          await env.DB.prepare(
            'INSERT INTO solves (device, name, mode, seed, seconds, day) VALUES (?,?,?,?,?,?)'
          ).bind(device, name, mode, '', seconds, todaySeed()).run();
        }
        return json({ ok: true });
      }

      if (path === '/api/board') {
        const type = url.searchParams.get('type') || 'daily';
        const device = url.searchParams.get('device') || '';
        const rows = await board(env, type, device);
        return json({ type, rows });
      }

      return json({ error: 'not found' }, 404);
    } catch (err) {
      return json({ error: String(err) }, 500);
    }
  },
};

async function board(env, type, device) {
  const seed = todaySeed();

  if (type === 'fastest') {
    const r = await env.DB.prepare(
      `SELECT name, MIN(seconds) AS v FROM solves
       WHERE mode = 'fiendish' AND created_at > datetime('now','-1 day')
       GROUP BY device ORDER BY v ASC LIMIT 100`
    ).all();
    return withYou(r.results, device, await myBest(env, device, 'fiendish'));
  }

  if (type === 'streaks') {
    const r = await env.DB.prepare(
      `SELECT name, COUNT(DISTINCT day) AS v FROM solves
       GROUP BY device ORDER BY v DESC LIMIT 100`
    ).all();
    return r.results.map(fmtNum);
  }

  if (type === 'rating') {
    const r = await env.DB.prepare(
      `SELECT name, device, mode, seconds FROM solves
       WHERE created_at > datetime('now','-30 day')`
    ).all();
    const acc = {};
    for (const s of r.results) {
      const score = Math.max(0, 3000 * (WEIGHT[s.mode] || 2) / Math.max(60, s.seconds));
      const a = acc[s.device] || (acc[s.device] = { name: s.name, total: 0, n: 0 });
      a.name = s.name; a.total += score; a.n++;
    }
    return Object.values(acc)
      .map(a => ({ name: a.name, v: Math.round(1200 + a.total / Math.max(1, a.n) * 8) }))
      .sort((x, y) => y.v - x.v).slice(0, 100).map(fmtNum);
  }

  // daily
  const r = await env.DB.prepare(
    `SELECT name, seconds AS v FROM solves
     WHERE mode = 'daily' AND seed = ? ORDER BY v ASC LIMIT 100`
  ).bind(seed).all();
  return withYou(r.results, device, null);
}

async function myBest(env, device, mode) {
  if (!device) return null;
  return await env.DB.prepare(
    `SELECT name, MIN(seconds) AS v FROM solves WHERE device = ? AND mode = ?`
  ).bind(device, mode).first();
}

const clock = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
const fmtNum = r => ({ name: r.name, val: String(r.v) });

function withYou(rows, device, mine) {
  const out = rows.map(r => ({ name: r.name, val: clock(r.v) }));
  return out;
}
