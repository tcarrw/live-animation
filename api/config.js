// api/config.js — Vercel *Node* Function (not Edge)
// Securely reads & writes the single-row `stream_cfg` table in Supabase.
// Requires env vars:
//   SUPABASE_URL           – https://xxxx.supabase.co
//   SUPABASE_SERVICE_ROLE  – service‑role secret key (**keep server‑side only**)

const { createClient } = require('@supabase/supabase-js');

// Initialise client once per invocation
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

module.exports = async (req, res) => {
  const method = req.method;

  // ===== GET  /api/config  =====
  if (method === 'GET') {
    const { data, error } = await supabase
      .from('stream_cfg')
      .select('*')
      .limit(1)
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data || {});
  }

  // ===== POST  /api/config  =====
  if (method === 'POST') {
    const body = req.body || {};
    const row  = { id: 1, ...body }; // single-row table

    const { error } = await supabase
      .from('stream_cfg')
      .upsert(row, { onConflict: 'id' });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  // ===== Unsupported method =====
  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).end(`Method ${method} Not Allowed`);
};
