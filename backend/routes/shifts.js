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
    const count = await pool.query('SELECT COUNT(*) FROM shifts');
    const total = parseInt(count.rows[0].count);
    const result = await pool.query(
      `SELECT s.*, v.name as volunteer_name, p.name as program_name
       FROM shifts s
       LEFT JOIN volunteers v ON s.volunteer_id = v.id
       LEFT JOIN programs p ON s.program_id = p.id
       ORDER BY s.start_time DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json({ data: result.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM shifts WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { volunteer_id, program_id, location, start_time, end_time, status } = req.body;
    const result = await pool.query(
      `INSERT INTO shifts (volunteer_id, program_id, location, start_time, end_time, status, supervisor_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [volunteer_id, program_id, location, start_time, end_time, status || 'scheduled', req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { volunteer_id, program_id, location, start_time, end_time, status, check_in_time, check_out_time } = req.body;
    const result = await pool.query(
      `UPDATE shifts SET volunteer_id=$1, program_id=$2, location=$3, start_time=$4, end_time=$5,
       status=$6, check_in_time=$7, check_out_time=$8 WHERE id=$9 RETURNING *`,
      [volunteer_id, program_id, location, start_time, end_time, status, check_in_time, check_out_time, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM shifts WHERE id = $1 RETURNING *', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
