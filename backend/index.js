const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const { createTables } = require('./schema');

const authRoutes = require('./routes/auth');
const volunteersRoutes = require('./routes/volunteers');
const shiftsRoutes = require('./routes/shifts');
const programsRoutes = require('./routes/programs');
const casesRoutes = require('./routes/cases');
const donationsRoutes = require('./routes/donations');
const inventoryRoutes = require('./routes/inventory');
const incidentsRoutes = require('./routes/incidents');
const aiRoutes = require('./routes/ai');
const aiBacklogRoutes = require('./routes/aiBacklog');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/volunteers', volunteersRoutes);
app.use('/api/shifts', shiftsRoutes);
app.use('/api/programs', programsRoutes);
app.use('/api/cases', casesRoutes);
app.use('/api/donations', donationsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/incidents', incidentsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/ai', aiBacklogRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Dashboard stats endpoint
app.get('/api/dashboard/stats', async (req, res) => {
  const auth = require('./middleware/auth');
  // inline auth check
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const jwt = require('jsonwebtoken');
    jwt.verify(token, process.env.JWT_SECRET || 'changeme');
  } catch { return res.status(401).json({ error: 'Invalid token' }); }

  try {
    const { pool } = require('./schema');
    const [volunteers, shifts, cases, inventory] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM volunteers WHERE status = 'active'"),
      pool.query("SELECT COUNT(*) FROM shifts WHERE status = 'in_progress' OR status = 'scheduled'"),
      pool.query("SELECT COUNT(*) FROM cases WHERE status = 'open'"),
      pool.query('SELECT COUNT(*) FROM inventory WHERE quantity <= min_threshold'),
    ]);
    res.json({
      total_volunteers: parseInt(volunteers.rows[0].count),
      active_shifts: parseInt(shifts.rows[0].count),
      open_cases: parseInt(cases.rows[0].count),
      low_inventory_items: parseInt(inventory.rows[0].count),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Initialize DB tables then start server
createTables().then(() => {
  
// === Custom Feature Mounts (batch_06) ===
app.use('/api/cf-agentic-volunteer-dispatch', require('./routes/customFeat01_AgenticVolunteerDispatch'));
app.use('/api/cf-rag-over-organizational-playbooks', require('./routes/customFeat02_RagOverOrganizationalPlaybooks'));
app.use('/api/cf-donor-engagement-scoring', require('./routes/customFeat03_DonorEngagementScoring'));
app.use('/api/cf-field-photo-upload-tagging', require('./routes/customFeat04_FieldPhotoUploadTagging'));
app.use('/api/cf-compliance-audit-agent', require('./routes/customFeat05_ComplianceAuditAgent'));


// === Batch 06 Gaps & Frontend Mounts ===
app.use('/api/gap-cases-exist-without-case', require('./routes/gapFeat_cases_exist_without_case'));
app.use('/api/gap-donations-tracked-but-no-donation', require('./routes/gapFeat_donations_tracked_but_no_donation'));
app.use('/api/gap-programs-without-program', require('./routes/gapFeat_programs_without_program'));
app.use('/api/gap-shifts-without-shift', require('./routes/gapFeat_shifts_without_shift'));
app.use('/api/gap-no-multi', require('./routes/gapFeat_no_multi'));
app.use('/api/gap-no-sms-bulk-communication-or-notification-layer', require('./routes/gapFeat_no_sms_bulk_communication_or_notification_layer'));
app.use('/api/gap-no-reporting-export-pdf-csv-for-board-meetings-and', require('./routes/gapFeat_no_reporting_export_pdf_csv_for_board_meetings_and'));
app.use('/api/gap-no-webhooks-or-third', require('./routes/gapFeat_no_webhooks_or_third'));
app.use('/api/gap-no-file-document-storage-for-case-attachments', require('./routes/gapFeat_no_file_document_storage_for_case_attachments'));
app.use('/api/gap-no-rbac-beyond-basic-auth-no-role-separation', require('./routes/gapFeat_no_rbac_beyond_basic_auth_no_role_separation'));

// === Custom Views (Field Views) — mounted BEFORE 404 ===
app.use('/api/custom-views', require('./routes/customViews'));

// 404 fallback (must come AFTER all routes)
app.use((req, res) => res.status(404).json({ error: 'Not found', path: req.path }));

app.listen(PORT, () => console.log(`Nonprofit Field Ops backend running on port ${PORT}`));
}).catch(err => {
  console.error('Failed to initialize DB:', err.message);
  process.exit(1);
});
