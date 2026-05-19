// Custom Views: 4 endpoints for nonprofit field operations
// VIZ: program-impact, volunteer-heatmap | NON-VIZ: impact-report (PDF), program-rules (CRUD)
const express = require('express');
const { pool } = require('../schema');
const auth = require('../middleware/auth');

const router = express.Router();

// Ensure program_rules table exists (eligibility CRUD)
async function ensureRulesTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS program_rules (
        id SERIAL PRIMARY KEY,
        program_id INTEGER REFERENCES programs(id) ON DELETE CASCADE,
        rule_name VARCHAR(255) NOT NULL,
        rule_type VARCHAR(64) DEFAULT 'eligibility',
        condition TEXT,
        threshold NUMERIC,
        active BOOLEAN DEFAULT true,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
  } catch (err) {
    console.error('ensureRulesTable error:', err.message);
  }
}
ensureRulesTable();

// ---- VIZ 1: Program Impact Chart ----
// Returns per-program impact metrics: cases served, donations received, shift hours, volunteer count.
router.get('/program-impact', auth, async (req, res) => {
  try {
    const programs = await pool.query('SELECT id, name, capacity, status FROM programs ORDER BY id ASC');
    const rows = [];
    for (const p of programs.rows) {
      const [cases, donations, shifts, vols] = await Promise.all([
        pool.query('SELECT COUNT(*)::int AS c FROM cases WHERE program_id = $1', [p.id]),
        pool.query('SELECT COALESCE(SUM(weight_lbs),0)::float AS w, COUNT(*)::int AS c FROM donations WHERE location ILIKE $1', [`%${p.name}%`]),
        pool.query(`SELECT COUNT(*)::int AS c,
                           COALESCE(SUM(EXTRACT(EPOCH FROM (end_time - start_time))/3600.0),0)::float AS hours
                    FROM shifts WHERE program_id = $1`, [p.id]),
        pool.query('SELECT COUNT(DISTINCT volunteer_id)::int AS c FROM shifts WHERE program_id = $1', [p.id]),
      ]);
      rows.push({
        program_id: p.id,
        program_name: p.name,
        capacity: p.capacity || 0,
        status: p.status,
        cases_served: cases.rows[0].c,
        donation_lbs: donations.rows[0].w,
        donation_count: donations.rows[0].c,
        shift_count: shifts.rows[0].c,
        shift_hours: Math.round(shifts.rows[0].hours * 10) / 10,
        volunteer_count: vols.rows[0].c,
        impact_score: Math.round((cases.rows[0].c * 3 + shifts.rows[0].c * 2 + donations.rows[0].c) * 10) / 10,
      });
    }
    res.json({
      data: rows,
      summary: {
        total_programs: rows.length,
        total_cases: rows.reduce((a, r) => a + r.cases_served, 0),
        total_shift_hours: Math.round(rows.reduce((a, r) => a + r.shift_hours, 0) * 10) / 10,
        total_volunteers: rows.reduce((a, r) => a + r.volunteer_count, 0),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- VIZ 2: Volunteer Activity Heatmap (volunteer x program) ----
router.get('/volunteer-heatmap', auth, async (req, res) => {
  try {
    const vols = await pool.query('SELECT id, name FROM volunteers ORDER BY name ASC LIMIT 25');
    const progs = await pool.query('SELECT id, name FROM programs ORDER BY name ASC LIMIT 15');
    const cells = await pool.query(`
      SELECT volunteer_id, program_id, COUNT(*)::int AS shift_count,
             COALESCE(SUM(EXTRACT(EPOCH FROM (end_time - start_time))/3600.0),0)::float AS hours
      FROM shifts
      WHERE volunteer_id IS NOT NULL AND program_id IS NOT NULL
      GROUP BY volunteer_id, program_id
    `);
    const map = {};
    cells.rows.forEach(c => {
      map[`${c.volunteer_id}_${c.program_id}`] = { shift_count: c.shift_count, hours: Math.round(c.hours * 10) / 10 };
    });
    const matrix = vols.rows.map(v => ({
      volunteer_id: v.id,
      volunteer_name: v.name,
      cells: progs.rows.map(p => ({
        program_id: p.id,
        program_name: p.name,
        shift_count: map[`${v.id}_${p.id}`]?.shift_count || 0,
        hours: map[`${v.id}_${p.id}`]?.hours || 0,
      })),
    }));
    let maxShift = 0;
    matrix.forEach(r => r.cells.forEach(c => { if (c.shift_count > maxShift) maxShift = c.shift_count; }));
    res.json({
      volunteers: vols.rows,
      programs: progs.rows,
      matrix,
      max_shift_count: maxShift,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- NON-VIZ 1: Impact/Donor Report PDF ----
// Generates a minimal valid PDF as a Buffer (no external deps required)
function buildPdf(title, lines) {
  // Build a minimal PDF 1.4 doc with one page, embedded Helvetica, one text block.
  const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  let contentStream = 'BT /F1 16 Tf 50 770 Td (' + esc(title) + ') Tj ET\n';
  let y = 740;
  lines.forEach((ln) => {
    contentStream += `BT /F1 11 Tf 50 ${y} Td (${esc(ln)}) Tj ET\n`;
    y -= 16;
    if (y < 60) y = 60; // safety; no pagination, single-page
  });
  const objects = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>');
  objects.push(`<< /Length ${Buffer.byteLength(contentStream)} >>\nstream\n${contentStream}endstream`);
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((off) => {
    pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'binary');
}

router.get('/impact-report.pdf', auth, async (req, res) => {
  try {
    const [progs, cases, donations, vols] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS c FROM programs'),
      pool.query('SELECT COUNT(*)::int AS c FROM cases'),
      pool.query('SELECT COUNT(*)::int AS c, COALESCE(SUM(weight_lbs),0)::float AS w FROM donations'),
      pool.query('SELECT COUNT(*)::int AS c FROM volunteers'),
    ]);
    const topProg = await pool.query(`
      SELECT p.name, COUNT(c.id)::int AS cases_n
      FROM programs p LEFT JOIN cases c ON c.program_id = p.id
      GROUP BY p.id, p.name ORDER BY cases_n DESC LIMIT 5
    `);
    const topDonors = await pool.query(`
      SELECT donor_name, COUNT(*)::int AS gifts, COALESCE(SUM(weight_lbs),0)::float AS lbs
      FROM donations WHERE donor_name IS NOT NULL
      GROUP BY donor_name ORDER BY gifts DESC LIMIT 5
    `);
    const lines = [
      `Generated: ${new Date().toISOString()}`,
      ``,
      `Summary:`,
      `  Programs: ${progs.rows[0].c}`,
      `  Cases:    ${cases.rows[0].c}`,
      `  Donations: ${donations.rows[0].c}  (Total lbs: ${donations.rows[0].w})`,
      `  Volunteers: ${vols.rows[0].c}`,
      ``,
      `Top Programs by Cases:`,
      ...topProg.rows.map((r, i) => `  ${i + 1}. ${r.name} - ${r.cases_n} cases`),
      ``,
      `Top Donors:`,
      ...topDonors.rows.map((r, i) => `  ${i + 1}. ${r.donor_name} - ${r.gifts} gifts (${r.lbs} lbs)`),
    ];
    if (req.query.format === 'json') {
      return res.json({
        summary: {
          programs: progs.rows[0].c,
          cases: cases.rows[0].c,
          donations: donations.rows[0].c,
          donation_lbs: donations.rows[0].w,
          volunteers: vols.rows[0].c,
        },
        top_programs: topProg.rows,
        top_donors: topDonors.rows,
        generated_at: new Date().toISOString(),
      });
    }
    const pdf = buildPdf('Nonprofit Impact & Donor Report', lines);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="impact-report.pdf"');
    res.setHeader('Content-Length', pdf.length);
    res.send(pdf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- NON-VIZ 2: Program Rules Editor (CRUD eligibility) ----
router.get('/program-rules', auth, async (req, res) => {
  try {
    const programId = req.query.program_id;
    let result;
    if (programId) {
      result = await pool.query(
        `SELECT r.*, p.name AS program_name FROM program_rules r
         LEFT JOIN programs p ON p.id = r.program_id
         WHERE r.program_id = $1 ORDER BY r.id ASC`,
        [programId]
      );
    } else {
      result = await pool.query(
        `SELECT r.*, p.name AS program_name FROM program_rules r
         LEFT JOIN programs p ON p.id = r.program_id
         ORDER BY r.id ASC`
      );
    }
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/program-rules', auth, async (req, res) => {
  try {
    const { program_id, rule_name, rule_type, condition, threshold, active, notes } = req.body || {};
    if (!rule_name) return res.status(400).json({ error: 'rule_name required' });
    const result = await pool.query(
      `INSERT INTO program_rules (program_id, rule_name, rule_type, condition, threshold, active, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [program_id || null, rule_name, rule_type || 'eligibility', condition || '', threshold ?? null, active !== false, notes || '']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/program-rules/:id', auth, async (req, res) => {
  try {
    const { program_id, rule_name, rule_type, condition, threshold, active, notes } = req.body || {};
    const result = await pool.query(
      `UPDATE program_rules SET program_id=$1, rule_name=$2, rule_type=$3, condition=$4,
              threshold=$5, active=$6, notes=$7, updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [program_id || null, rule_name, rule_type || 'eligibility', condition || '', threshold ?? null, active !== false, notes || '', req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/program-rules/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM program_rules WHERE id=$1 RETURNING *', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
