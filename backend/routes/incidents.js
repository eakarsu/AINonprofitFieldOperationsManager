const express = require('express');
const { pool } = require('../schema');
const auth = require('../middleware/auth');

const router = express.Router();

const paginate = (req) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, parseInt(req.query.limit) || 20);
  return { page, limit, offset: (page - 1) * limit };
};

router.get('/', auth, async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req);
    const count = await pool.query('SELECT COUNT(*) FROM incidents');
    const total = parseInt(count.rows[0].count);
    const result = await pool.query('SELECT * FROM incidents ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
    res.json({ data: result.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM incidents WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { location, incident_type, description, severity, status } = req.body;
    const result = await pool.query(
      `INSERT INTO incidents (reporter_id, location, incident_type, description, severity, status)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.user.id, location, incident_type, description, severity || 'medium', status || 'open']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { location, incident_type, description, severity, status, ai_analysis } = req.body;
    const result = await pool.query(
      `UPDATE incidents SET location=$1, incident_type=$2, description=$3, severity=$4, status=$5, ai_analysis=$6 WHERE id=$7 RETURNING *`,
      [location, incident_type, description, severity, status, ai_analysis, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM incidents WHERE id = $1 RETURNING *', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
