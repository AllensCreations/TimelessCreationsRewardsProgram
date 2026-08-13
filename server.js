require('dotenv').config();
const express = require('express');
const webhookHandler = require('./api/webhook');

const app = express();
app.use(express.json());

app.all('/api/webhook', (req, res) => webhookHandler(req, res));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(` TCRP Local Server running on port ${PORT}`);
  console.log(` Webhook Endpoint: http://localhost:${PORT}/api/webhook`);
  console.log(`==================================================`);
});
