// functions/api/roster.js
// Cloudflare Pages Functions: 免費 KV 資料同步 API
// 綁定 KV 命名為 ROSTER_KV (在 Cloudflare Pages 後台設定)

const STORAGE_KEY = 'offlineDutyRoster_cloud_v1';

export async function onRequestGet(context) {
  const { env } = context;
  if (!env.ROSTER_KV) {
    return new Response(JSON.stringify({ 
      ok: false, 
      error: 'KV 未綁定。請至 Cloudflare Pages 後台設定 KV 命名空間，變數名稱設為 ROSTER_KV。' 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json;charset=utf-8' }
    });
  }

  try {
    const data = await env.ROSTER_KV.get(STORAGE_KEY, { type: 'json' });
    return new Response(JSON.stringify({ ok: true, data: data || null }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json;charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=utf-8' }
    });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.ROSTER_KV) {
    return new Response(JSON.stringify({ 
      ok: false, 
      error: 'KV 未綁定。請至 Cloudflare Pages 後台設定 KV 命名空間，變數名稱設為 ROSTER_KV。' 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json;charset=utf-8' }
    });
  }

  try {
    const payload = await request.json();
    if (!payload || typeof payload !== 'object') {
      return new Response(JSON.stringify({ ok: false, error: '無效的資料格式' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=utf-8' }
      });
    }

    // 將最新完整狀態寫入 KV
    await env.ROSTER_KV.put(STORAGE_KEY, JSON.stringify(payload));

    return new Response(JSON.stringify({ 
      ok: true, 
      updatedAt: new Date().toISOString() 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json;charset=utf-8' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=utf-8' }
    });
  }
}
