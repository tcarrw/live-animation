// api/config.js — Vercel Edge Function
// Handles GET / POST for stream settings so the browser never sees private keys
// Requires env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE

import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "edge" };

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE  // service‑role key (keep **only** on server)
);

export default async function handler(req) {
  const { method } = req;

  if (method === "GET") {
    const { data, error } = await supabase
      .from("stream_cfg")
      .select("*")
      .limit(1)
      .single();

    if (error) return json({ error: error.message }, 500);
    return json(data, 200);
  }

  if (method === "POST") {
    const body = await req.json();
    const row  = { id: 1, ...body };           // single‑row table
    const { error } = await supabase
      .from("stream_cfg")
      .upsert(row, { onConflict: "id" });

    if (error) return json({ error: error.message }, 500);
    return json({ success: true }, 200);
  }

  return new Response(null, { status: 405, headers: { Allow: "GET, POST" } });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}
