/**
 * AI / operations backlog endpoints (apply pass 5).
 *
 * Endpoints:
 *   - POST /api/ai/multi-language/translate         (MECHANICAL — text-only LLM)
 *   - POST /api/ai/bulk-sms                          (NEEDS-CREDS — TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM_NUMBER)
 *   - POST /api/ai/bulk-email                        (NEEDS-CREDS — SENDGRID_API_KEY + SENDGRID_FROM_EMAIL)
 *   - GET  /api/ai/reports/cases.csv                 (MECHANICAL — additive)
 *   - GET  /api/ai/reports/donations.csv             (MECHANICAL — additive)
 *   - GET  /api/ai/audit-trail                        (MECHANICAL — additive; CREATE TABLE IF NOT EXISTS)
 *   - POST /api/ai/audit-trail/log                    (MECHANICAL — additive)
 *   - POST /api/ai/field-photo                        (PRODUCT-DECISION: local FS storage default at ./uploads/field_photos;
 *                                                     swap to S3 by setting FIELD_PHOTO_S3_BUCKET in a future pass)
 *   - GET  /api/ai/field-photos                       (MECHANICAL — list)
 *
 * PRODUCT-DECISIONS:
 *   - multi-language: supported = ['en','es','fr','ar','zh-CN','vi'] (top languages
 *     in U.S. social-services contact data per HHS Title VI guidance).
 *   - field photo storage: local filesystem under uploads/field_photos with
 *     SHA-1 content hash filenames. EXIF metadata (lat/lon/timestamp) parsed
 *     server-side when present. PII tagging deferred to NEEDS-PRODUCT-DECISION.
 *
 * Env vars consumed:
 *   - OPENROUTER_API_KEY                    — multi-language translation
 *   - TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER — bulk SMS
 *   - SENDGRID_API_KEY, SENDGRID_FROM_EMAIL — bulk email
 *   - FIELD_PHOTO_DIR                       — override default upload dir
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { pool } = require('../schema');
const auth = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'anthropic/claude-3-5-sonnet-20241022';
const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'ar', 'zh-CN', 'vi'];
const FIELD_PHOTO_DIR = process.env.FIELD_PHOTO_DIR || path.join(__dirname, '..', 'uploads', 'field_photos');

router.use(auth);

// ---------------------------------------------------------------------------
// Idempotent table for audit trail
// ---------------------------------------------------------------------------
async function ensureAuditTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_trail (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        action VARCHAR(120) NOT NULL,
        entity_type VARCHAR(80),
        entity_id INTEGER,
        details JSONB,
        ip_address VARCHAR(64),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  } catch (err) {
    console.error('[aiBacklog] audit_trail create:', err.message);
  }
}
async function ensureFieldPhotoTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS field_photos (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        case_id INTEGER,
        program_id INTEGER,
        path VARCHAR(512) NOT NULL,
        sha1 VARCHAR(64) NOT NULL,
        size_bytes INTEGER,
        mime_type VARCHAR(80),
        latitude NUMERIC(9,6),
        longitude NUMERIC(9,6),
        captured_at TIMESTAMPTZ,
        tags TEXT[],
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  } catch (err) {
    console.error('[aiBacklog] field_photos create:', err.message);
  }
}
(async () => {
  await ensureAuditTable();
  await ensureFieldPhotoTable();
  try { fs.mkdirSync(FIELD_PHOTO_DIR, { recursive: true }); } catch {}
})();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function callOpenRouter(systemPrompt, userMessage, apiKey, opts = {}) {
  const r = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'AI Nonprofit Field Operations',
    },
    body: JSON.stringify({
      model: opts.model || MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.max_tokens || 1500,
    }),
  });
  const data = await r.json();
  if (data.error) throw new Error(data.error.message || 'OpenRouter error');
  return data.choices?.[0]?.message?.content || '';
}

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v).replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
}

// ---------------------------------------------------------------------------
// 1. Multi-language translation
// ---------------------------------------------------------------------------
router.post('/multi-language/translate', aiRateLimiter, async (req, res) => {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'AI service unavailable', missing: 'OPENROUTER_API_KEY' });

    const { text, target_language, source_language, context } = req.body || {};
    if (!text || !target_language) return res.status(400).json({ error: 'text and target_language are required' });
    if (!SUPPORTED_LANGUAGES.includes(target_language)) {
      return res.status(400).json({ error: 'Unsupported target_language', supported: SUPPORTED_LANGUAGES });
    }
    const sys = 'You are a professional translator for U.S. nonprofit social-services materials. Preserve formal register, do not paraphrase. Respond ONLY with valid JSON: {"translation": string, "notes": [string]}';
    const userMsg = `Translate to ${target_language}${source_language ? ` (from ${source_language})` : ''}.\nContext: ${context || 'general client communication'}\n\nText:\n${text}`;
    const raw = await callOpenRouter(sys, userMsg, apiKey, { temperature: 0.2 });
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = { translation: raw, notes: [] }; }
    res.json({ success: true, target_language, supported_languages: SUPPORTED_LANGUAGES, ...parsed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// 2. Bulk SMS — Twilio
// ---------------------------------------------------------------------------
router.post('/bulk-sms', aiRateLimiter, async (req, res) => {
  try {
    const missing = [];
    if (!process.env.TWILIO_ACCOUNT_SID) missing.push('TWILIO_ACCOUNT_SID');
    if (!process.env.TWILIO_AUTH_TOKEN) missing.push('TWILIO_AUTH_TOKEN');
    if (!process.env.TWILIO_FROM_NUMBER) missing.push('TWILIO_FROM_NUMBER');
    if (missing.length) return res.status(503).json({ error: 'Bulk SMS not configured', missing: missing.join(',') });

    const { recipients = [], body } = req.body || {};
    if (!Array.isArray(recipients) || recipients.length === 0) return res.status(400).json({ error: 'recipients[] required' });
    if (!body) return res.status(400).json({ error: 'body required' });
    if (recipients.length > 200) return res.status(400).json({ error: 'recipients limited to 200 per request' });

    const sid = process.env.TWILIO_ACCOUNT_SID;
    const tkn = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;
    const basic = Buffer.from(`${sid}:${tkn}`).toString('base64');

    const results = [];
    for (const to of recipients) {
      try {
        const params = new URLSearchParams({ To: String(to), From: from, Body: String(body).slice(0, 1500) });
        const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
          method: 'POST',
          headers: { 'Authorization': `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        });
        const data = await r.json().catch(() => ({}));
        results.push({ to, ok: r.ok, sid: data.sid || null, status: data.status || r.status });
      } catch (e) {
        results.push({ to, ok: false, error: e.message });
      }
    }
    res.json({ success: true, sent: results.filter(x => x.ok).length, total: results.length, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// 3. Bulk Email — SendGrid
// ---------------------------------------------------------------------------
router.post('/bulk-email', aiRateLimiter, async (req, res) => {
  try {
    const missing = [];
    if (!process.env.SENDGRID_API_KEY) missing.push('SENDGRID_API_KEY');
    if (!process.env.SENDGRID_FROM_EMAIL) missing.push('SENDGRID_FROM_EMAIL');
    if (missing.length) return res.status(503).json({ error: 'Bulk email not configured', missing: missing.join(',') });

    const { recipients = [], subject, body, html } = req.body || {};
    if (!Array.isArray(recipients) || recipients.length === 0) return res.status(400).json({ error: 'recipients[] required' });
    if (!subject || !(body || html)) return res.status(400).json({ error: 'subject and (body or html) required' });
    if (recipients.length > 1000) return res.status(400).json({ error: 'recipients limited to 1000 per request' });

    const personalizations = recipients.map((to) => ({ to: [{ email: String(to) }] }));
    const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations,
        from: { email: process.env.SENDGRID_FROM_EMAIL },
        subject,
        content: html
          ? [{ type: 'text/html', value: html }]
          : [{ type: 'text/plain', value: body }],
      }),
    });
    if (r.status >= 400) {
      const txt = await r.text();
      return res.status(502).json({ ok: false, status: r.status, body: txt.slice(0, 2000) });
    }
    res.json({ success: true, total: recipients.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// 4. CSV reports — cases & donations
// ---------------------------------------------------------------------------
router.get('/reports/cases.csv', async (req, res) => {
  try {
    const r = await pool.query('SELECT id, client_name, status, urgency_score, program_id, created_at FROM cases ORDER BY created_at DESC LIMIT 5000').catch(() => ({ rows: [] }));
    const lines = ['id,client_name,status,urgency_score,program_id,created_at'];
    for (const row of r.rows) {
      lines.push([row.id, row.client_name, row.status, row.urgency_score, row.program_id, row.created_at?.toISOString?.() || row.created_at].map(csvEscape).join(','));
    }
    res.set('Content-Type', 'text/csv');
    res.set('Content-Disposition', 'attachment; filename="cases.csv"');
    res.send(lines.join('\n'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/reports/donations.csv', async (req, res) => {
  try {
    const r = await pool.query('SELECT id, donor_name, amount, currency, donation_date, program_id FROM donations ORDER BY donation_date DESC LIMIT 5000').catch(() => ({ rows: [] }));
    const lines = ['id,donor_name,amount,currency,donation_date,program_id'];
    for (const row of r.rows) {
      lines.push([row.id, row.donor_name, row.amount, row.currency, row.donation_date?.toISOString?.() || row.donation_date, row.program_id].map(csvEscape).join(','));
    }
    res.set('Content-Type', 'text/csv');
    res.set('Content-Disposition', 'attachment; filename="donations.csv"');
    res.send(lines.join('\n'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// 5. Audit trail
// ---------------------------------------------------------------------------
router.post('/audit-trail/log', async (req, res) => {
  try {
    const { action, entity_type, entity_id, details } = req.body || {};
    if (!action) return res.status(400).json({ error: 'action required' });
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;
    await pool.query(
      'INSERT INTO audit_trail (user_id, action, entity_type, entity_id, details, ip_address) VALUES ($1,$2,$3,$4,$5,$6)',
      [req.user?.id || null, action, entity_type || null, entity_id || null, JSON.stringify(details || {}), ip]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/audit-trail', async (req, res) => {
  try {
    const limit = Math.min(500, parseInt(req.query.limit, 10) || 100);
    const r = await pool.query('SELECT id, user_id, action, entity_type, entity_id, details, created_at FROM audit_trail ORDER BY id DESC LIMIT $1', [limit]);
    res.json({ entries: r.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// 6. Field photo upload — base64 payload (no multer dep)
// PRODUCT-DECISION: local FS storage. EXIF parsing deferred to a future pass.
// ---------------------------------------------------------------------------
router.post('/field-photo', async (req, res) => {
  try {
    const { case_id, program_id, image_base64, mime_type = 'image/jpeg', captured_at, latitude, longitude, tags } = req.body || {};
    if (!image_base64) return res.status(400).json({ error: 'image_base64 required' });
    const buf = Buffer.from(image_base64, 'base64');
    if (buf.length === 0) return res.status(400).json({ error: 'invalid image_base64' });
    if (buf.length > 8 * 1024 * 1024) return res.status(413).json({ error: 'photo exceeds 8MB' });

    const sha1 = crypto.createHash('sha1').update(buf).digest('hex');
    const ext = (mime_type || '').includes('png') ? 'png' : 'jpg';
    const filename = `${sha1}.${ext}`;
    const filepath = path.join(FIELD_PHOTO_DIR, filename);
    try { fs.writeFileSync(filepath, buf); } catch (e) { return res.status(500).json({ error: 'write failed: ' + e.message }); }

    const r = await pool.query(
      `INSERT INTO field_photos (user_id, case_id, program_id, path, sha1, size_bytes, mime_type, latitude, longitude, captured_at, tags)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [
        req.user?.id || null,
        case_id || null,
        program_id || null,
        filepath,
        sha1,
        buf.length,
        mime_type,
        latitude || null,
        longitude || null,
        captured_at || null,
        Array.isArray(tags) ? tags : null,
      ]
    );
    res.json({ success: true, id: r.rows[0].id, sha1, size_bytes: buf.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/field-photos', async (req, res) => {
  try {
    const limit = Math.min(200, parseInt(req.query.limit, 10) || 50);
    const r = await pool.query('SELECT id, case_id, program_id, sha1, size_bytes, mime_type, latitude, longitude, captured_at, tags, created_at FROM field_photos ORDER BY id DESC LIMIT $1', [limit]);
    res.json({ photos: r.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
