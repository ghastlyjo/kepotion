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
      const { results } = await db.prepare("SELECT * FROM notes ORDER BY updated_at DESC").all();
      const parsed = results.map(r => ({ ...r, hashtags: JSON.parse(r.hashtags || '[]'), pinned: !!r.pinned }));
      return new Response(JSON.stringify(parsed), { headers: cors });
    }
    if (method === 'POST') {
      const body = await context.request.json();
      const newId = body.id || 'n_' + Math.random().toString(36).slice(2,8);
      const now = Date.now();
      const hashtags = JSON.stringify(body.hashtags || []);
      if (body.hashtags && body.hashtags.length > 0) {
        for (const tag of body.hashtags) {
          const existing = await db.prepare("SELECT id FROM folders WHERE LOWER(name) = LOWER(?)").bind(tag).all();
          if (existing.results.length === 0) {
            const fid = 'f_' + Math.random().toString(36).slice(2,8);
            await db.prepare("INSERT INTO folders (id, name, emoji, color, created_at) VALUES (?, ?, ?, ?, ?)").bind(fid, tag.toLowerCase(), '📁', '#E8E8E8', now).run();
          }
        }
        const firstTag = body.hashtags[0].toLowerCase();
        const folderMatch = await db.prepare("SELECT id FROM folders WHERE LOWER(name) = ?").bind(firstTag).all();
        if (folderMatch.results.length > 0 && !body.folder_id) body.folder_id = folderMatch.results[0].id;
      }
      await db.prepare("INSERT OR REPLACE INTO notes (id, title, content, folder_id, hashtags, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(newId, body.title || 'Untitled', body.content || '', body.folder_id || null, hashtags, body.pinned ? 1 : 0, body.created_at || now, now).run();
      const { results } = await db.prepare("SELECT * FROM notes WHERE id = ?").bind(newId).all();
      const note = { ...results[0], hashtags: JSON.parse(results[0].hashtags), pinned: !!results[0].pinned };
      return new Response(JSON.stringify(note), { headers: cors });
    }
    if (method === 'PUT' && id) {
      const body = await context.request.json();
      const now = Date.now();
      const existing = await db.prepare("SELECT * FROM notes WHERE id = ?").bind(id).all();
      if (existing.results.length === 0) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: cors });
      const hashtags = body.hashtags ? JSON.stringify(body.hashtags) : existing.results[0].hashtags;
      await db.prepare("UPDATE notes SET title = ?, content = ?, folder_id = ?, hashtags = ?, pinned = ?, updated_at = ? WHERE id = ?")
        .bind(body.title ?? existing.results[0].title, body.content ?? existing.results[0].content, body.folder_id !== undefined ? body.folder_id : existing.results[0].folder_id, hashtags, body.pinned !== undefined ? (body.pinned ? 1 : 0) : existing.results[0].pinned, now, id).run();
      const { results } = await db.prepare("SELECT * FROM notes WHERE id = ?").bind(id).all();
      const note = { ...results[0], hashtags: JSON.parse(results[0].hashtags), pinned: !!results[0].pinned };
      return new Response(JSON.stringify(note), { headers: cors });
    }
    if (method === 'DELETE' && id) {
      await db.prepare("DELETE FROM notes WHERE id = ?").bind(id).run();
      return new Response(JSON.stringify({ success: true }), { headers: cors });
    }
    return new Response(JSON.stringify({ error: 'Invalid' }), { status: 400, headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: cors });
  }
}
