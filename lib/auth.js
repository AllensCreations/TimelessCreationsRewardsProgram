export function requireAdmin(req, res) {
  const key = req.headers['x-admin-key'] || req.query?.admin_key;
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) {
    res.status(500).json({ ok: false, error: 'Server misconfigured: ADMIN_API_KEY not set' });
    return false;
  }
  if (key !== expected) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return false;
  }
  return true;
}
