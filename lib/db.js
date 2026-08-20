const TURSO_URL = (process.env.TURSO_DATABASE_URL || '').trim();
const TURSO_TOKEN = (process.env.TURSO_AUTH_TOKEN || '').trim();

// Convert turso:// or libsql:// to https://
const getHttpUrl = (url) => {
  if (!url) return '';
  return url.replace(/^libsql:\/\//, 'https://').replace(/^turso:\/\//, 'https://');
};

export async function queryTurso(statements) {
  const endpoint = `${getHttpUrl(TURSO_URL)}/v2/pipeline`;
  
  // Transform statements into Turso pipeline format
  const requests = statements.map(stmt => {
    if (typeof stmt === 'string') {
      return { type: "execute", stmt: { sql: stmt, args: [] } };
    }
    return stmt;
  });

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TURSO_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Turso HTTP Error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data;
}

export function unwrap(cell) {
  if (!cell) return null;
  if (cell.type === 'integer') return parseInt(cell.value, 10);
  if (cell.type === 'float') return parseFloat(cell.value);
  if (cell.type === 'null') return null;
  return cell.value;
}

export async function logSystemEvent(level, message) {
  try {
    await queryTurso([{ type: "execute", stmt: { sql: "INSERT INTO system_logs (level, message) VALUES (?, ?)", args: [{type:"text", value: level}, {type:"text", value: message}] } }]);
  } catch (e) {}
}
