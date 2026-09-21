export async function onRequest(context) {
  const db = context.env.DB;
  const url = new URL(context.request.url);
  const method = context.request.method;
  const id = url.searchParams.get('id');
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (method === 'OPTIONS') return new Response(null, { headers: cors });
  try {
    if (method === 'GET') {
      const { results } = await db.prepare("SELECT * FROM folders ORDER BY created_at ASC").all();
      return new Response(JSON.stringify(results), { headers: cors });
    }
    if (method === 'POST') {
      const body = await context.request.json();
      const newId = body.id || 'f_' + Math.random().toString(36).slice(2,8);
      const name = (body.name || 'untitled').toLowerCase().trim();
      await db.prepare("INSERT OR REPLACE INTO folders (id, name, emoji, color, created_at) VALUES (?, ?, ?, ?, ?)")
        .bind(newId, name, body.emoji || '📁', body.color || '#E8E8E8', Date.now()).run();
      const { results } = await db.prepare("SELECT * FROM folders WHERE id = ?").bind(newId).all();
      return new Response(JSON.stringify(results[0]), { headers: cors });
    }
    if (method === 'PUT' && id) {
      const body = await context.request.json();
      const fields = []; const values = [];
      if (body.name) { fields.push("name = ?"); values.push(body.name.toLowerCase().trim()); }
      if (body.emoji) { fields.push("emoji = ?"); values.push(body.emoji); }
      if (body.color) { fields.push("color = ?"); values.push(body.color); }
      if (fields.length) { values.push(id); await db.prepare(`UPDATE folders SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run(); }
      const { results } = await db.prepare("SELECT * FROM folders WHERE id = ?").bind(id).all();
      return new Response(JSON.stringify(results[0]), { headers: cors });
    }
    if (method === 'DELETE' && id) {
      await db.prepare("UPDATE notes SET folder_id = NULL WHERE folder_id = ?").bind(id).run();
      await db.prepare("DELETE FROM folders WHERE id = ?").bind(id).run();
      return new Response(JSON.stringify({ success: true }), { headers: cors });
    }
    return new Response(JSON.stringify({ error: 'Invalid' }), { status: 400, headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: cors });
  }
}
