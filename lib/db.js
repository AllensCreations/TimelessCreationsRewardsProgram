import 'dotenv/config';

export async function runSql(query, params = []) {
  const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN || process.env.AUTH_TOKEN;

  if (!url || !url.startsWith('libsql://') && !url.startsWith('https://')) {
    // Local In-Memory / Safe Mock Fallback if no remote DB URL configured
    return [];
  }

  // Convert libsql:// to https:// for HTTP pipeline endpoint
  const httpEndpoint = url.replace('libsql://', 'https://') + '/v2/pipeline';

  // Format parameterized arguments for Turso pipeline protocol
  const formattedArgs = params.map(p => {
    if (p === null || p === undefined) return { type: 'null' };
    if (typeof p === 'number') {
      return Number.isInteger(p) ? { type: 'integer', value: String(p) } : { type: 'float', value: p };
    }
    return { type: 'text', value: String(p) };
  });

  const requestBody = {
    requests: [
      {
        type: 'execute',
        stmt: {
          sql: query,
          args: formattedArgs
        }
      },
      { type: 'close' }
    ]
  };

  const response = await fetch(httpEndpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Turso HTTP Error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const execResult = data.results?.[0]?.response?.result;

  if (!execResult) return [];

  const cols = execResult.cols?.map(c => c.name) || [];
  const rows = execResult.rows || [];

  return rows.map(r => {
    const obj = {};
    cols.forEach((col, idx) => {
      obj[col] = r[idx]?.value !== undefined ? r[idx].value : null;
    });
    return obj;
  });
}
