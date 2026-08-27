export function requireAdmin(req, res) {
  const key = req.headers['x-admin-key'] || req.query?.admin_key || req.headers['authorization']?.replace('Bearer ', '');
  const expected = process.env.ADMIN_API_KEY || process.env.ADMIN_SECRET;
  if (!expected) {
    res.status(500).json({ ok: false, error: 'Server misconfigured: ADMIN_API_KEY not set' });
    return false;
  }
  if (key !== expected) {
    res.status(401).json({ ok: false, error: 'Unauthorized: Invalid or missing admin key' });
    return false;
  }
  return true;
}
