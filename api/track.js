import 'dotenv/config';
import { handleEmailAction } from '../lib/handlers/emailHandler.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const result = await handleEmailAction('track_open', req, req.body || {});
  if (result) {
    if (result.headers) {
      for (const [k, v] of Object.entries(result.headers)) {
        res.setHeader(k, v);
      }
    }
    if (result.buffer) {
      if (typeof res.status === 'function') res.status(result.status || 200);
      else res.statusCode = result.status || 200;

      if (typeof res.send === 'function') {
        return res.send(result.buffer);
      }
      return res.end(result.buffer);
    }
    return res.status(result.status || 200).json(result.json);
  }

  return res.status(200).end();
}
