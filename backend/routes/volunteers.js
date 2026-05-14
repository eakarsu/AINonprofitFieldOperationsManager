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
    const count = await pool.query('SELECT COUNT(*) FROM volunteers');
    const total = parseInt(count.rows[0].count);
    const result = await pool.query('SELECT * FROM volunteers ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
    res.json({ data: result.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM volunteers WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { name, email, skills, location, availability, status, geo_lat, geo_lng } = req.body;
    const result = await pool.query(
      `INSERT INTO volunteers (name, email, skills, location, availability, status, geo_lat, geo_lng)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name, email, skills || [], location, availability || {}, status || 'active', geo_lat, geo_lng]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { name, email, skills, location, availability, status, geo_lat, geo_lng } = req.body;
    const result = await pool.query(
      `UPDATE volunteers SET name=$1, email=$2, skills=$3, location=$4, availability=$5, status=$6, geo_lat=$7, geo_lng=$8
       WHERE id=$9 RETURNING *`,
      [name, email, skills || [], location, availability || {}, status, geo_lat, geo_lng, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM volunteers WHERE id = $1 RETURNING *', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
