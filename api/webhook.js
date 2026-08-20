export default async function handler(req, res) {
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === (process.env.VERIFY_TOKEN || 'tcrp_token')) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Verification failed');
  }
  if (req.method === 'POST') {
    return res.status(200).send('EVENT_RECEIVED');
  }
  return res.status(405).send('Method not allowed');
}
