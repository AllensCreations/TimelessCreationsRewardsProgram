import { queryTurso, unwrap } from '../lib/db.js';

async function runSql(sql, args = []) {
  const formattedArgs = args.map(val => {
    if (val === null || val === undefined) return { type: "null" };
    if (typeof val === "number") return { type: "integer", value: String(val) };
    return { type: "text", value: String(val) };
  });
  const data = await queryTurso([{ type: "execute", stmt: { sql, args: formattedArgs } }]);
  const results = data.results || [];
  const targetBatch = results[results.length - 2]?.response?.result || results[0]?.response?.result;
  if (!targetBatch || !targetBatch.cols) return [];
  const cols = targetBatch.cols.map(c => (typeof c === 'object' ? c.name : c));
  return (targetBatch.rows || []).map(row => {
    const obj = {};
    row.forEach((cell, idx) => { obj[cols[idx]] = unwrap(cell); });
    return obj;
  });
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const champions = await runSql("SELECT name, email, points, referral_code FROM missionaries WHERE status = 'active' ORDER BY points DESC LIMIT 25");
      return res.status(200).json({ ok: true, champions });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
