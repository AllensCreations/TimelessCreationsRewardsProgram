import { queryTurso } from '../../lib/db.js';

export default async function handler(req, res) {
  try {
    await queryTurso([
      { type: "execute", stmt: { sql: "CREATE INDEX IF NOT EXISTS idx_missionaries_email ON missionaries(email);" } },
      { type: "execute", stmt: { sql: "CREATE INDEX IF NOT EXISTS idx_missionaries_status ON missionaries(status);" } },
      { type: "execute", stmt: { sql: "CREATE INDEX IF NOT EXISTS idx_invoices_id ON cash_invoices(invoice_id);" } },
      { type: "execute", stmt: { sql: "CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);" } },
      { type: "execute", stmt: { sql: "CREATE INDEX IF NOT EXISTS idx_chat_psid ON chat_messages(psid);" } }
    ]);
    return res.status(200).json({ ok: true, message: "Database indexes successfully applied for lightning-fast lookups!" });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
