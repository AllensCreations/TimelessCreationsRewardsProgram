const TURSO_URL = (process.env.TURSO_DATABASE_URL || '').trim();
const TURSO_TOKEN = (process.env.TURSO_AUTH_TOKEN || '').trim();

const getHttpUrl = (url) => {
  if (!url) return '';
  return url.replace(/^libsql:\/\//, 'https://').replace(/^turso:\/\//, 'https://');
};

export async function queryTurso(statements) {
  const endpoint = `${getHttpUrl(TURSO_URL)}/v2/pipeline`;
  
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

// Universal parser matching the successful tester.sh output
export async function runSql(sql, args = []) {
  const formattedArgs = args.map(val => {
    if (val === null || val === undefined) return { type: "null" };
    if (typeof val === "number") return { type: "integer", value: String(val) };
    return { type: "text", value: String(val) };
  });

  const data = await queryTurso([{ type: "execute", stmt: { sql, args: formattedArgs } }]);
  const results = data.results || [];
  
  let targetResult = null;
  for (const r of results) {
    if (r && r.response && r.response.result && r.response.result.cols) {
      targetResult = r.response.result;
      break;
    }
  }
  if (!targetResult && results.length > 0) {
    targetResult = results[0]?.response?.result;
  }

  if (!targetResult || !targetResult.cols) return [];

  const cols = targetResult.cols.map(c => (typeof c === 'object' ? c.name : c));
  return (targetResult.rows || []).map(row => {
    const obj = {};
    row.forEach((cell, idx) => { obj[cols[idx]] = unwrap(cell); });
    return obj;
  });
}

export async function logSystemEvent(level, message) {
  try {
    await queryTurso([{ 
      type: "execute", 
      stmt: { 
        sql: "INSERT INTO system_logs (level, message) VALUES (?, ?)", 
        args: [{type:"text", value: level}, {type:"text", value: message}] 
      } 
    }]);
  } catch (e) {}
}
