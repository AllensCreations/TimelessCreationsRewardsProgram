import express from 'express';
import 'dotenv/config';
import dashboardHandler from './api/dashboard-data.js';
import webhookHandler from './api/webhook.js';
import cronHandler from './api/cron-drip.js';

const app = express();
app.use(express.json());
app.use(express.static('public'));

app.all('/api/dashboard-data', async (req, res) => {
  return dashboardHandler(req, res);
});

app.all('/api/webhook', async (req, res) => {
  return webhookHandler(req, res);
});

app.all('/api/cron-drip', async (req, res) => {
  return cronHandler(req, res);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Timeless Creations local server running at http://localhost:${PORT}`);
});
