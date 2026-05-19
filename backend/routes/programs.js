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
    const count = await pool.query('SELECT COUNT(*) FROM programs');
    const total = parseInt(count.rows[0].count);
    const result = await pool.query('SELECT * FROM programs ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
    res.json({ data: result.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM programs WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { name, description, location, capacity, status } = req.body;
    const result = await pool.query(
      `INSERT INTO programs (name, description, location, capacity, status, manager_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name, description, location, capacity || 0, status || 'active', req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { name, description, location, capacity, status } = req.body;
    const result = await pool.query(
      `UPDATE programs SET name=$1, description=$2, location=$3, capacity=$4, status=$5 WHERE id=$6 RETURNING *`,
      [name, description, location, capacity, status, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM programs WHERE id = $1 RETURNING *', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
