const express = require('express');
const { pool } = require('../schema');
const auth = require('../middleware/auth');
const { createNativeAIRequest } = require('../services/nativeAIRequest');
const { aiRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5';

async function callAI(systemPrompt, userMessage, apiKey, aiRequest) {
  aiRequest.assertActive();
  const response = await fetch(OPENROUTER_API_URL, {
    signal: aiRequest.signal,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'AI Nonprofit Field Operations',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });
  const data = await response.json();
  aiRequest.assertActive();
  if (!response.ok || data.error) throw new Error(String(data.error?.message || 'OpenRouter error').replaceAll(apiKey, '[redacted]'));
  const choice = data.choices?.[0];
  if (choice?.message?.refusal || ['length', 'content_filter'].includes(choice?.finish_reason) || typeof choice?.message?.content !== 'string' || !choice.message.content.trim()) throw new Error('OpenRouter did not return a complete response. Please try again.');
  return choice.message.content;
}

function parseJSON(text) {
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
  if (jsonMatch) { try { return JSON.parse(jsonMatch[1]); } catch (_) {} }
  try { return JSON.parse(text); } catch (_) { return { raw: text }; }
}

async function persistResult(userId, endpoint, inputData, result, aiRequest, options = {}) {
  try {
    await aiRequest.query(
      'INSERT INTO ai_results (user_id, endpoint, input_data, result) VALUES ($1, $2, $3, $4)',
      [userId, endpoint, JSON.stringify(inputData), JSON.stringify(result)]
    );
  } catch (err) { if (aiRequest.signal.aborted || options.strict) throw err;  console.error('Failed to persist AI result:', err.message); }
}

// Apply auth + rate limit to all AI routes
router.use(auth, aiRateLimiter);

// POST /api/ai/triage-case
router.post('/triage-case', async (req, res) => {
  const aiRequest = createNativeAIRequest(req, res, pool);
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'OpenRouter API key not configured' });

    const { case_id, client_name, needs, urgency_score, demographics } = req.body;

    const systemPrompt = `You are a nonprofit case management AI. Analyze the case and respond ONLY with a JSON object:
{
  "urgency_score": <1-10>,
  "urgency_label": "critical|high|medium|low",
  "need_types": ["<type>"],
  "recommended_program": "<program name>",
  "routing_rationale": "<explanation>",
  "immediate_actions": ["<action>"],
  "resource_requirements": ["<resource>"]
}`;

    const userMsg = `Client: ${client_name || 'Unknown'}
Needs: ${Array.isArray(needs) ? needs.join(', ') : needs || 'Not specified'}
Initial Urgency Score: ${urgency_score || 5}/10
Demographics: ${demographics || 'Not provided'}`;

    const raw = await callAI(systemPrompt, userMsg, apiKey, aiRequest);
    const parsed = parseJSON(raw);

    if (case_id) {
      await aiRequest.query('UPDATE cases SET ai_triage = $1 WHERE id = $2', [JSON.stringify(parsed), case_id]).catch(() => {});
    }
    await persistResult(req.user.id, 'triage-case', req.body, parsed, aiRequest);

    await aiRequest.commit();
    res.json({ success: true, result: parsed });
  } catch (err) {
    await aiRequest.rollback();
    if (aiRequest.disconnected) return;
    if (aiRequest.timedOut) return res.status(504).json({ error: 'AI request timed out. Please try again.' });
    res.status(500).json({ error: err.message }); } finally { await aiRequest.dispose(); }
});

// POST /api/ai/dispatch-volunteer
router.post('/dispatch-volunteer', async (req, res) => {
  const aiRequest = createNativeAIRequest(req, res, pool);
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'OpenRouter API key not configured' });

    const { shift_requirements, volunteer_ids } = req.body;

    // Fetch available volunteers from DB
    let volunteers = [];
    if (volunteer_ids && volunteer_ids.length > 0) {
      const r = await aiRequest.query('SELECT * FROM volunteers WHERE id = ANY($1) AND status = $2', [volunteer_ids, 'active']);
      volunteers = r.rows;
    } else {
      const r = await aiRequest.query("SELECT * FROM volunteers WHERE status = 'active' LIMIT 50");
      volunteers = r.rows;
    }

    const systemPrompt = `You are a volunteer dispatch AI for a nonprofit. Analyze the shift requirements and available volunteers, then respond ONLY with a JSON object:
{
  "recommended_volunteers": [
    {
      "volunteer_id": <id>,
      "volunteer_name": "<name>",
      "match_score": <1-100>,
      "match_reasons": ["<reason>"],
      "concerns": ["<concern>"]
    }
  ],
  "dispatch_notes": "<overall notes>",
  "alternative_options": ["<option>"]
}`;

    const userMsg = `Shift Requirements: ${JSON.stringify(shift_requirements)}
Available Volunteers: ${JSON.stringify(volunteers.map(v => ({ id: v.id, name: v.name, skills: v.skills, location: v.location, availability: v.availability })))}`;

    const raw = await callAI(systemPrompt, userMsg, apiKey, aiRequest);
    const parsed = parseJSON(raw);

    await persistResult(req.user.id, 'dispatch-volunteer', req.body, parsed, aiRequest);
    await aiRequest.commit();
    res.json({ success: true, result: parsed });
  } catch (err) {
    await aiRequest.rollback();
    if (aiRequest.disconnected) return;
    if (aiRequest.timedOut) return res.status(504).json({ error: 'AI request timed out. Please try again.' });
    res.status(500).json({ error: err.message }); } finally { await aiRequest.dispose(); }
});

// POST /api/ai/grant-report
router.post('/grant-report', async (req, res) => {
  const aiRequest = createNativeAIRequest(req, res, pool);
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'OpenRouter API key not configured' });

    const { program_id, grant_name, reporting_period } = req.body;

    // Query stats from DB
    const programResult = program_id
      ? await aiRequest.query('SELECT * FROM programs WHERE id = $1', [program_id])
      : { rows: [] };
    const caseCountResult = program_id
      ? await aiRequest.query("SELECT COUNT(*) FROM cases WHERE program_id = $1 AND status != 'open'", [program_id])
      : await aiRequest.query("SELECT COUNT(*) FROM cases WHERE status != 'open'");
    const volunteerHours = await aiRequest.query(`
      SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (check_out_time - check_in_time))/3600), 0) as total_hours
      FROM shifts WHERE status = 'completed' AND check_in_time IS NOT NULL AND check_out_time IS NOT NULL
      ${program_id ? 'AND program_id = $1' : ''}
    `, program_id ? [program_id] : []);

    const program = programResult.rows[0] || {};
    const stats = {
      program: program.name || 'All Programs',
      cases_served: parseInt(caseCountResult.rows[0].count),
      volunteer_hours: parseFloat(volunteerHours.rows[0].total_hours).toFixed(1),
    };

    const systemPrompt = `You are a grant writing AI for nonprofits. Draft a comprehensive grant outcome report based on the statistics provided.`;

    const userMsg = `Grant: ${grant_name || 'General Operations Grant'}
Reporting Period: ${reporting_period || 'Current Quarter'}
Statistics:
- Program: ${stats.program}
- Cases Served: ${stats.cases_served}
- Volunteer Hours Logged: ${stats.volunteer_hours} hours

Please draft a professional grant outcome report with: Executive Summary, Program Impact, Quantitative Outcomes, Qualitative Impact, Challenges & Solutions, and Next Steps.`;

    const raw = await callAI(systemPrompt, userMsg, apiKey, aiRequest);

    await persistResult(req.user.id, 'grant-report', req.body, { report: raw, stats }, aiRequest);
    await aiRequest.commit();
    res.json({ success: true, result: { report: raw, stats } });
  } catch (err) {
    await aiRequest.rollback();
    if (aiRequest.disconnected) return;
    if (aiRequest.timedOut) return res.status(504).json({ error: 'AI request timed out. Please try again.' });
    res.status(500).json({ error: err.message }); } finally { await aiRequest.dispose(); }
});

// POST /api/ai/incident-cluster
router.post('/incident-cluster', async (req, res) => {
  const aiRequest = createNativeAIRequest(req, res, pool);
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'OpenRouter API key not configured' });

    // Fetch last 90 days incidents
    const incidentsResult = await aiRequest.query(
      "SELECT id, location, incident_type, description, severity, created_at FROM incidents WHERE created_at >= NOW() - INTERVAL '90 days' ORDER BY created_at DESC"
    );
    const incidents = incidentsResult.rows;

    const systemPrompt = `You are a safety analytics AI for a nonprofit. Analyze the incident data and respond ONLY with a JSON object:
{
  "clusters": [
    {
      "cluster_name": "<name>",
      "location_pattern": "<pattern>",
      "incident_types": ["<type>"],
      "frequency": <number>,
      "severity_trend": "increasing|stable|decreasing",
      "risk_level": "critical|high|medium|low",
      "recommendations": ["<action>"]
    }
  ],
  "overall_risk_assessment": "<assessment>",
  "priority_interventions": ["<intervention>"],
  "data_gaps": ["<gap>"]
}`;

    const userMsg = `Incidents from last 90 days (${incidents.length} total):\n${JSON.stringify(incidents, null, 2)}`;

    const raw = await callAI(systemPrompt, userMsg, apiKey, aiRequest);
    const parsed = parseJSON(raw);

    await persistResult(req.user.id, 'incident-cluster', { incident_count: incidents.length }, parsed, aiRequest);
    await aiRequest.commit();
    res.json({ success: true, result: parsed, incident_count: incidents.length });
  } catch (err) {
    await aiRequest.rollback();
    if (aiRequest.disconnected) return;
    if (aiRequest.timedOut) return res.status(504).json({ error: 'AI request timed out. Please try again.' });
    res.status(500).json({ error: err.message }); } finally { await aiRequest.dispose(); }
});

// POST /api/ai/inventory-restock
router.post('/inventory-restock', async (req, res) => {
  const aiRequest = createNativeAIRequest(req, res, pool);
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'OpenRouter API key not configured' });

    const { program_id, constraints, priority_areas } = req.body || {};
    let programContext = 'All saved programs';
    if (program_id) {
      const program = await aiRequest.query('SELECT id, name FROM programs WHERE id = $1', [program_id]);
      if (!program.rows[0]) return res.status(404).json({ error: 'The selected saved program is unavailable.' });
      programContext = program.rows[0].name;
    }
    // Fetch items below min_threshold
    const result = await aiRequest.query('SELECT * FROM inventory WHERE quantity <= min_threshold ORDER BY (min_threshold - quantity) DESC');
    const lowItems = result.rows;

    const systemPrompt = `You are an inventory and donor relations AI for a nonprofit. Generate a restocking wish list and donor appeal text. Respond ONLY with a JSON object:
{
  "wish_list": [
    {
      "item_name": "<name>",
      "category": "<category>",
      "current_quantity": <number>,
      "needed_quantity": <number>,
      "urgency": "critical|high|medium|low",
      "use_case": "<description>"
    }
  ],
  "donor_appeal": "<compelling donor appeal letter>",
  "priority_items": ["<item>"],
  "estimated_cost": "<estimate>",
  "campaign_suggestions": ["<suggestion>"]
}`;

    const userMsg = `Inventory items at or below minimum threshold (${lowItems.length} items):\n${JSON.stringify(lowItems, null, 2)}\nProgram context: ${programContext}\nUser-supplied planning constraints: ${constraints || 'Not provided'}\nUser-supplied priority areas: ${priority_areas || 'Not provided'}\nThese constraints and priorities are draft planning context. Do not infer budget, approval, supply allocation, or verified outcomes.`;

    const raw = await callAI(systemPrompt, userMsg, apiKey, aiRequest);
    const parsed = parseJSON(raw);

    await persistResult(req.user.id, 'inventory-restock', { low_items_count: lowItems.length, program_id: program_id || null, constraints: constraints || '', priority_areas: priority_areas || '' }, parsed, aiRequest);
    await aiRequest.commit();
    res.json({ success: true, result: parsed, low_items: lowItems });
  } catch (err) {
    await aiRequest.rollback();
    if (aiRequest.disconnected) return;
    if (aiRequest.timedOut) return res.status(504).json({ error: 'AI request timed out. Please try again.' });
    res.status(500).json({ error: err.message }); } finally { await aiRequest.dispose(); }
});

// POST /api/ai/impact-report — generate program impact report
router.post('/impact-report', async (req, res) => {
  const aiRequest = createNativeAIRequest(req, res, pool);
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'OpenRouter API key not configured' });

    const { program_id, period, custom_metrics } = req.body;

    // Fetch data from multiple tables
    const programResult = program_id
      ? await aiRequest.query('SELECT * FROM programs WHERE id = $1', [program_id])
      : { rows: [] };

    const [caseCount, volunteerCount, incidentCount] = await Promise.all([
      aiRequest.query(program_id ? 'SELECT COUNT(*), status FROM cases WHERE program_id = $1 GROUP BY status' : 'SELECT COUNT(*), status FROM cases GROUP BY status', program_id ? [program_id] : []),
      aiRequest.query("SELECT COUNT(*) FROM volunteers WHERE status = 'active'"),
      aiRequest.query("SELECT COUNT(*) FROM incidents WHERE created_at >= NOW() - INTERVAL '90 days'")
    ]);

    const caseStats = {};
    caseCount.rows.forEach(r => { caseStats[r.status] = parseInt(r.count); });
    const totalCases = Object.values(caseStats).reduce((a, b) => a + b, 0);
    const resolvedCases = (caseStats['closed'] || 0) + (caseStats['referred'] || 0);

    const program = programResult.rows[0] || {};
    const stats = {
      program: program.name || 'All Programs',
      period: period || 'Current Period',
      total_cases: totalCases,
      resolved_cases: resolvedCases,
      resolution_rate: totalCases > 0 ? ((resolvedCases / totalCases) * 100).toFixed(1) + '%' : 'N/A',
      active_volunteers: parseInt(volunteerCount.rows[0].count),
      recent_incidents: parseInt(incidentCount.rows[0].count),
      custom_metrics: custom_metrics || ''
    };

    const systemPrompt = `You are an impact reporting AI for nonprofits. Generate a compelling, data-driven impact report.`;
    const userMsg = `Program: ${stats.program}
Period: ${stats.period}
Total Cases Served: ${stats.total_cases}
Cases Resolved: ${stats.resolved_cases} (${stats.resolution_rate})
Active Volunteers: ${stats.active_volunteers}
Safety Incidents (90 days): ${stats.recent_incidents}
Additional Metrics: ${stats.custom_metrics || 'None provided'}

Draft a comprehensive impact report including: Executive Summary, Quantitative Outcomes, Volunteer Impact, Safety Record, Stories of Change (1-2 illustrative examples), Challenges & Learnings, Looking Forward.`;

    const raw = await callAI(systemPrompt, userMsg, apiKey, aiRequest);
    await persistResult(req.user.id, 'impact-report', req.body, { report: raw, stats }, aiRequest);
    await aiRequest.commit();
    res.json({ success: true, result: { report: raw, stats } });
  } catch (err) {
    await aiRequest.rollback();
    if (aiRequest.disconnected) return;
    if (aiRequest.timedOut) return res.status(504).json({ error: 'AI request timed out. Please try again.' });
    res.status(500).json({ error: err.message }); } finally { await aiRequest.dispose(); }
});

// POST /api/ai/beneficiary-needs — assess beneficiary needs
router.post('/beneficiary-needs', async (req, res) => {
  const aiRequest = createNativeAIRequest(req, res, pool);
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'OpenRouter API key not configured' });

    const { beneficiary_name, demographics, situation, location, case_id } = req.body;

    // Fetch recent similar cases for context
    const similarCases = await aiRequest.query(
      "SELECT client_name, needs, status FROM cases ORDER BY created_at DESC LIMIT 10"
    );

    const systemPrompt = `You are a nonprofit case assessment AI. Evaluate beneficiary needs and provide comprehensive support recommendations. Respond ONLY with a JSON object:
{
  "immediate_needs": ["<need>"],
  "underlying_needs": ["<need>"],
  "risk_factors": ["<risk>"],
  "protective_factors": ["<factor>"],
  "recommended_services": [{"service": "<name>", "priority": "critical|high|medium|low", "rationale": "<why>"}],
  "referral_suggestions": ["<agency/resource>"],
  "barriers_to_services": ["<barrier>"],
  "estimated_support_duration": "<timeframe>",
  "success_indicators": ["<indicator>"],
  "urgency_assessment": {"score": <1-10>, "label": "critical|high|medium|low", "reasoning": "<why>"}
}`;

    const userMsg = `Beneficiary: ${beneficiary_name || 'Anonymous'}
Location: ${location || 'Not specified'}
Demographics: ${demographics || 'Not provided'}
Situation: ${situation || 'Not provided'}

Context from similar recent cases:
${similarCases.rows.map(c => `- ${c.client_name}: needs=${JSON.stringify(c.needs)}, status=${c.status}`).join('\n')}`;

    const raw = await callAI(systemPrompt, userMsg, apiKey, aiRequest);
    const parsed = parseJSON(raw);

    if (case_id) {
      await aiRequest.query('UPDATE cases SET ai_triage = $1 WHERE id = $2', [JSON.stringify(parsed), case_id]).catch(() => {});
    }
    await persistResult(req.user.id, 'beneficiary-needs', req.body, parsed, aiRequest);
    await aiRequest.commit();
    res.json({ success: true, result: parsed });
  } catch (err) {
    await aiRequest.rollback();
    if (aiRequest.disconnected) return;
    if (aiRequest.timedOut) return res.status(504).json({ error: 'AI request timed out. Please try again.' });
    res.status(500).json({ error: err.message }); } finally { await aiRequest.dispose(); }
});

// POST /api/ai/grant-application — draft grant application
router.post('/grant-application', async (req, res) => {
  const aiRequest = createNativeAIRequest(req, res, pool);
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'OpenRouter API key not configured' });

    const { funder, program_id, amount_requested, project_description, deadline } = req.body;
    if (amount_requested !== undefined && (!Number.isFinite(Number(amount_requested)) || Number(amount_requested) < 0)) return res.status(400).json({ error: 'amount_requested must be a nonnegative number' });
    if (program_id && (!Number.isInteger(Number(program_id)) || Number(program_id) < 1)) return res.status(400).json({ error: 'program_id must identify a saved program' });

    const programResult = program_id
      ? await aiRequest.query('SELECT * FROM programs WHERE id = $1', [program_id])
      : { rows: [] };
    if (program_id && !programResult.rows[0]) return res.status(404).json({ error: 'The selected saved program is unavailable.' });
    const program = programResult.rows[0] || {};

    const [caseStats, volCount] = await Promise.all([
      aiRequest.query(program_id ? "SELECT COUNT(*) FROM cases WHERE program_id = $1" : "SELECT COUNT(*) FROM cases", program_id ? [program_id] : []),
      aiRequest.query("SELECT COUNT(*) FROM volunteers WHERE status = 'active'")
    ]);

    const systemPrompt = `You are an expert grant writer AI for nonprofits. Draft a compelling grant application narrative.`;
    const userMsg = `Funder: ${funder}
Program: ${program.name || project_description || 'Community Support Program'}
Amount Requested: $${amount_requested || 'TBD'}
Deadline: ${deadline || 'Not specified'}
Description: ${project_description || program.description || 'Not provided'}
Current Stats: ${caseStats.rows[0].count} cases served, ${volCount.rows[0].count} active volunteers

Draft a grant application including:
1. Executive Summary (2-3 paragraphs)
2. Statement of Need (with data)
3. Project Description and Goals
4. Implementation Plan (timeline)
5. Organizational Capacity
6. Evaluation Plan
7. Budget Justification Summary
8. Sustainability Plan`;

    const raw = await callAI(systemPrompt, userMsg, apiKey, aiRequest);
    await persistResult(req.user.id, 'grant-application', req.body, { application: raw }, aiRequest, { strict: true });
    await aiRequest.commit();
    res.json({ success: true, result: { application: raw } });
  } catch (err) {
    await aiRequest.rollback();
    if (aiRequest.disconnected) return;
    if (aiRequest.timedOut) return res.status(504).json({ error: 'AI request timed out. Please try again.' });
    res.status(500).json({ error: err.message }); } finally { await aiRequest.dispose(); }
});

// POST /api/ai/program-evaluation — evaluate program effectiveness
router.post('/program-evaluation', async (req, res) => {
  const aiRequest = createNativeAIRequest(req, res, pool);
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'OpenRouter API key not configured' });

    const { program_id } = req.body;

    const [program, cases, incidents] = await Promise.all([
      program_id ? aiRequest.query('SELECT * FROM programs WHERE id = $1', [program_id]) : { rows: [{}] },
      aiRequest.query(program_id ? 'SELECT status, urgency_score, needs FROM cases WHERE program_id = $1' : 'SELECT status, urgency_score, needs FROM cases', program_id ? [program_id] : []),
      aiRequest.query(program_id ? "SELECT severity, incident_type FROM incidents WHERE created_at >= NOW() - INTERVAL '90 days'" : "SELECT severity, incident_type FROM incidents WHERE created_at >= NOW() - INTERVAL '90 days'")
    ]);

    if (program_id && !program.rows[0]) return res.status(404).json({ error: 'The selected saved program is unavailable.' });
    const prog = program.rows[0] || {};
    const caseList = cases.rows;
    const incidentList = incidents.rows;

    const avgUrgency = caseList.length ? (caseList.reduce((s, c) => s + (c.urgency_score || 5), 0) / caseList.length).toFixed(1) : 'N/A';
    const resolvedPct = caseList.length ? ((caseList.filter(c => ['closed', 'referred'].includes(c.status)).length / caseList.length) * 100).toFixed(0) : 0;

    const systemPrompt = `You are a program evaluation AI for nonprofits. Provide an objective evidence-based evaluation. Respond ONLY with a JSON object:
{
  "effectiveness_score": <1-10>,
  "strengths": ["<strength>"],
  "weaknesses": ["<weakness>"],
  "opportunities": ["<opportunity>"],
  "threats": ["<threat>"],
  "kpi_assessment": {"metric": "<name>", "value": "<value>", "benchmark": "<industry standard>", "status": "exceeds|meets|below"},
  "recommendations": [{"action": "<action>", "priority": "high|medium|low", "expected_impact": "<impact>"}],
  "overall_assessment": "<summary>"
}`;

    const userMsg = `Program: ${prog.name || 'All Programs'}
Total Cases: ${caseList.length}
Resolution Rate: ${resolvedPct}%
Avg Urgency Score: ${avgUrgency}/10
Organization-wide recent incidents (native incidents have no program link): ${incidentList.length}
Critical Incidents: ${incidentList.filter(i => i.severity === 'critical' || i.severity === 'high').length}`;

    const raw = await callAI(systemPrompt, userMsg, apiKey, aiRequest);
    const parsed = parseJSON(raw);
    await persistResult(req.user.id, 'program-evaluation', req.body, parsed, aiRequest, { strict: true });
    await aiRequest.commit();
    res.json({ success: true, result: parsed });
  } catch (err) {
    await aiRequest.rollback();
    if (aiRequest.disconnected) return;
    if (aiRequest.timedOut) return res.status(504).json({ error: 'AI request timed out. Please try again.' });
    res.status(500).json({ error: err.message }); } finally { await aiRequest.dispose(); }
});

// GET /api/ai/history
router.get('/history', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const countResult = await pool.query('SELECT COUNT(*) FROM ai_results');
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      'SELECT * FROM ai_results ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    res.json({
      data: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/ai/case-resolution-predict
router.post('/case-resolution-predict', async (req, res) => {
  const aiRequest = createNativeAIRequest(req, res, pool);
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'OpenRouter API key not configured' });
    const { case_id, needs, urgency, history_summary, available_resources } = req.body || {};
    let caseRow = null;
    if (case_id) {
      if (!Number.isInteger(Number(case_id)) || Number(case_id) < 1) return res.status(400).json({ error: 'case_id must identify an existing saved case' });
      const saved = await aiRequest.query('SELECT * FROM cases WHERE id=$1', [case_id]);
      caseRow = saved.rows[0];
      if (!caseRow) return res.status(404).json({ error: 'The selected saved case is unavailable.' });
    }
    const systemPrompt = `Predict case-resolution time and resources. Respond ONLY with JSON:
{ "estimated_days_to_close": number, "confidence": "low"|"medium"|"high", "resources_needed": [string], "blockers_predicted": [string], "recommended_steps": [string] }`;
    const userMsg = `Saved case evidence: ${JSON.stringify(caseRow)}
User-supplied planning context (unverified; does not update case evidence): ${JSON.stringify({ needs, urgency, history_summary, available_resources })}
Source scope: ${caseRow ? 'Use the saved case as the factual source; distinguish supplied planning assumptions.' : 'Unlinked fictional planning scenario; no actual case history is asserted.'}`;
    const raw = await callAI(systemPrompt, userMsg, apiKey, aiRequest);
    const parsed = parseJSON(raw);
    await persistResult(req.user.id, 'case-resolution-predict', req.body, parsed, aiRequest, { strict: true });
    await aiRequest.commit();
    res.json({ success: true, result: parsed });
  } catch (err) {
    await aiRequest.rollback();
    if (aiRequest.disconnected) return;
    if (aiRequest.timedOut) return res.status(504).json({ error: 'AI request timed out. Please try again.' });
    res.status(500).json({ error: err.message }); } finally { await aiRequest.dispose(); }
});

// POST /api/ai/donation-forecast
router.post('/donation-forecast', async (req, res) => {
  const aiRequest = createNativeAIRequest(req, res, pool);
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'OpenRouter API key not configured' });
    const { period, horizon_months, historical_data, upcoming_campaigns, economic_context, donor_id } = req.body || {};
    if (donor_id !== undefined && donor_id !== null && donor_id !== '') return res.status(400).json({ error: 'This workspace has no saved donor identifier catalog. Review the organization-wide donation records instead.' });
    const horizon = horizon_months === undefined ? ({ next_month: 1, next_quarter: 3, next_year: 12 }[period] || 6) : Number(horizon_months);
    if (!Number.isInteger(horizon) || horizon < 1 || horizon > 36) return res.status(400).json({ error: 'horizon_months must be an integer from 1 to 36' });
    const donations = (await aiRequest.query('SELECT id,donor_name,type,item_description,quantity,weight_lbs,location,status,created_at FROM donations ORDER BY created_at DESC LIMIT 200')).rows;
    const systemPrompt = `Forecast donation activity. Distinguish saved in-kind records from user-supplied hypothetical monetary totals; do not assert saved dollar amounts where none exist. Respond ONLY with JSON:
{ "horizon_months": number, "total_forecast_usd": number, "monthly_breakdown": [{"month": string, "amount": number}], "recommendations": [string], "assumptions": [string], "data_gaps": [string] }`;
    const userMsg = `Horizon (months): ${horizon}
Planning period: ${period || 'Not supplied'}
User-supplied historical planning data (unverified): ${JSON.stringify(historical_data)}
Upcoming campaigns (draft): ${JSON.stringify(upcoming_campaigns)}
Economic context (draft): ${economic_context || 'Not supplied'}
Saved donation evidence (in-kind schema; no donor_id, donation_date or amount column): ${JSON.stringify(donations).slice(0, 6000)}`;
    const raw = await callAI(systemPrompt, userMsg, apiKey, aiRequest);
    const parsed = parseJSON(raw);
    await persistResult(req.user.id, 'donation-forecast', { ...req.body, horizon_months: horizon }, parsed, aiRequest, { strict: true });
    await aiRequest.commit();
    res.json({ success: true, result: parsed });
  } catch (err) {
    await aiRequest.rollback();
    if (aiRequest.disconnected) return;
    if (aiRequest.timedOut) return res.status(504).json({ error: 'AI request timed out. Please try again.' });
    res.status(500).json({ error: err.message }); } finally { await aiRequest.dispose(); }
});

// POST /api/ai/shift-optimization
router.post('/shift-optimization', async (req, res) => {
  const aiRequest = createNativeAIRequest(req, res, pool);
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'OpenRouter API key not configured' });
    const { period_start, period_end, date_range, open_shifts, constraints } = req.body || {};
    const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
    if ((period_start && !validDate(period_start)) || (period_end && !validDate(period_end)) || (period_start && period_end && period_start > period_end)) return res.status(400).json({ error: 'The shift planning dates must be valid and ordered.' });
    if (open_shifts !== undefined && (!Array.isArray(open_shifts) || open_shifts.some(shift => !shift || typeof shift.location !== 'string' || !validDate(shift.date) || !Number.isFinite(shift.hours) || shift.hours <= 0 || !Array.isArray(shift.skills) || shift.skills.some(skill => typeof skill !== 'string') || Object.keys(shift).some(key => !['location', 'date', 'hours', 'skills'].includes(key))))) return res.status(400).json({ error: 'Each hypothetical open shift needs location, date, positive hours and a string skills array; do not supply invented record IDs.' });
    const shifts = (await aiRequest.query("SELECT * FROM shifts WHERE ($1::date IS NULL OR start_time >= $1::date) AND ($2::date IS NULL OR start_time < $2::date + INTERVAL '1 day') ORDER BY start_time DESC LIMIT 100", [period_start || null, period_end || null])).rows;
    const volunteers = (await aiRequest.query('SELECT id, name, skills, availability FROM volunteers LIMIT 100')).rows;
    const systemPrompt = `Balance volunteer shift load and satisfaction. Keep fictional open-shift scenarios separate from saved shift/volunteer identifiers; recommendations do not book or assign anything. Respond ONLY with JSON:
{ "shift_assignments": [{"shift_id": any, "volunteer_id": any, "fit_score": number, "rationale": string}], "underloaded_volunteers": [any], "overloaded_volunteers": [any], "rebalancing_actions": [string], "predicted_satisfaction_delta": number }`;
    const userMsg = `Date range: ${period_start || 'Not supplied'} through ${period_end || 'Not supplied'}; legacy planning label: ${date_range || 'next 14 days'}
Constraints (draft): ${JSON.stringify(constraints || {})}
Hypothetical open shifts (not saved records): ${JSON.stringify(open_shifts || [])}
Saved shifts: ${JSON.stringify(shifts).slice(0,3500)}
Saved volunteers: ${JSON.stringify(volunteers).slice(0,3500)}`;
    const raw = await callAI(systemPrompt, userMsg, apiKey, aiRequest);
    const parsed = parseJSON(raw);
    await persistResult(req.user.id, 'shift-optimization', req.body, parsed, aiRequest, { strict: true });
    await aiRequest.commit();
    res.json({ success: true, result: parsed });
  } catch (err) {
    await aiRequest.rollback();
    if (aiRequest.disconnected) return;
    if (aiRequest.timedOut) return res.status(504).json({ error: 'AI request timed out. Please try again.' });
    res.status(500).json({ error: err.message }); } finally { await aiRequest.dispose(); }
});

// POST /api/ai/program-risk-assessment
router.post('/program-risk-assessment', async (req, res) => {
  const aiRequest = createNativeAIRequest(req, res, pool);
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'AI service unavailable: OPENROUTER_API_KEY not configured' });
    const { program_id, lookback_days } = req.body || {};
    const days = Math.min(365, Math.max(1, parseInt(lookback_days, 10) || 90));

    let program = null;
    if (program_id) {
      if (!Number.isInteger(Number(program_id)) || Number(program_id) < 1) return res.status(400).json({ error: 'program_id must identify an existing saved program' });
      const saved = await aiRequest.query('SELECT * FROM programs WHERE id = $1', [program_id]);
      program = saved.rows[0];
      if (!program) return res.status(404).json({ error: 'The selected saved program is unavailable.' });
    }
    const cutoff = "NOW() - ($1::int * INTERVAL '1 day')";
    const recentCases = (await aiRequest.query('SELECT id,status,urgency_score,created_at,program_id FROM cases WHERE created_at > ' + cutoff + ' AND ($2::int IS NULL OR program_id=$2) ORDER BY created_at DESC LIMIT 200', [days, program_id || null])).rows;
    const recentShifts = (await aiRequest.query('SELECT id,start_time,end_time,status,program_id FROM shifts WHERE start_time > ' + cutoff + ' AND ($2::int IS NULL OR program_id=$2) ORDER BY start_time DESC LIMIT 200', [days, program_id || null])).rows;
    const recentIncidents = (await aiRequest.query('SELECT id,severity,created_at,location FROM incidents WHERE created_at > ' + cutoff + ' ORDER BY created_at DESC LIMIT 200', [days])).rows;
    const recentDonations = (await aiRequest.query('SELECT id,type,item_description,quantity,weight_lbs,created_at FROM donations WHERE created_at > ' + cutoff + ' ORDER BY created_at DESC LIMIT 500', [days])).rows;
    const systemPrompt = `You are a nonprofit program-risk analyst. Score multidimensional risk to a program based on the data summary. Respond ONLY with a JSON object:
{
  "overall_risk_level": "low|moderate|high|critical",
  "risk_score": 0-100,
  "dimensions": {
    "operational_risk": {"score": 0-100, "drivers": [string]},
    "financial_risk": {"score": 0-100, "drivers": [string]},
    "compliance_risk": {"score": 0-100, "drivers": [string]},
    "staffing_risk": {"score": 0-100, "drivers": [string]},
    "beneficiary_risk": {"score": 0-100, "drivers": [string]}
  },
  "leading_indicators": [string],
  "mitigation_actions": [string],
  "review_window_days": 1-90,
  "rationale": string
}`;

    const userMsg = `Program: ${JSON.stringify(program).slice(0, 1500)}
Lookback (days): ${days}
Cases (sample): ${JSON.stringify(recentCases).slice(0, 2500)}
Organization-wide incidents (not program-linked): ${JSON.stringify(recentIncidents).slice(0, 2000)}
Organization-wide in-kind donations (not program-linked; no saved monetary amounts): ${JSON.stringify(recentDonations).slice(0, 2000)}
Shifts (sample): ${JSON.stringify(recentShifts).slice(0, 2000)}
Counts: cases=${recentCases.length}, incidents=${recentIncidents.length}, donations=${recentDonations.length}, shifts=${recentShifts.length}`;

    const raw = await callAI(systemPrompt, userMsg, apiKey, aiRequest);
    const parsed = parseJSON(raw);
    await persistResult(req.user.id, 'program-risk-assessment', { program_id: program_id || null, lookback_days: days, source_scope: { cases: program_id ? 'selected program' : 'organization-wide', shifts: program_id ? 'selected program' : 'organization-wide', incidents: 'organization-wide; no native program link', donations: 'organization-wide in-kind records; no native program link or monetary amount' } }, parsed, aiRequest, { strict: true });
    await aiRequest.commit();
    res.json({ success: true, result: parsed, input_summary: { program_id: program_id || null, lookback_days: days, cases: recentCases.length, incidents: recentIncidents.length, donations: recentDonations.length, shifts: recentShifts.length } });
  } catch (err) {
    await aiRequest.rollback();
    if (aiRequest.disconnected) return;
    if (aiRequest.timedOut) return res.status(504).json({ error: 'AI request timed out. Please try again.' });
    res.status(500).json({ error: err.message }); } finally { await aiRequest.dispose(); }
});

module.exports = router;
