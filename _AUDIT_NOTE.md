# Audit Apply Note — AINonprofitFieldOperationsManager

Source: `_AUDIT/reports/batch_06.md` section 1.

## Original Recommendations
### Missing AI counterparts
- `/case-resolution-predict`
- `/donation-forecast`
- `/program-risk-assessment`
- `/shift-optimization`

### Missing non-AI
- Multi-language support; bulk SMS/email outreach; reporting export (PDF/CSV); audit trail / compliance logging

### Custom suggestions
- Agentic volunteer dispatch; RAG over playbooks; donor engagement scoring; field photo upload + tagging; compliance audit agent

## Implemented
Added three endpoints in `backend/routes/ai.js`:
- `POST /api/ai/case-resolution-predict`
- `POST /api/ai/donation-forecast`
- `POST /api/ai/shift-optimization`

Reused `callAI`, `parseJSON`, `persistResult`, `auth`, `aiRateLimiter`.

## Backlog
| Item | Tag |
|---|---|
| `/program-risk-assessment` | MECHANICAL |
| Multi-language support | NEEDS-PRODUCT-DECISION |
| Bulk SMS/email outreach | NEEDS-CREDS (Twilio/SendGrid) |
| Reporting export (PDF/CSV) | MECHANICAL |
| Audit trail/compliance logging | MECHANICAL |
| Field photo upload + tagging | NEEDS-PRODUCT-DECISION (storage) |

## Apply pass 3 (frontend)

- Verified: FE is comprehensively wired. `frontend/src/api.js` exposes a complete `aiApi` object hitting all 12 backend AI endpoints + `/api/ai/history`. Two pages cover the surface:
  - `pages/AIPage.js` — general tools tab UI (triage, dispatch, grant, impact, needs, resource, history).
  - `pages/AIPredictivePage.js` — exposes the three pass-2-added predictive endpoints (`case-resolution-predict`, `donation-forecast`, `shift-optimization`) with dedicated forms.
- Auth via axios interceptor that attaches `Authorization: Bearer ${localStorage.token}` to every request.
- Action: LEFT-AS-IS (idempotence rule).
- No files modified. Pass 2's predictive endpoint additions are already exposed end-to-end.

## Apply pass 4 (mechanical backlog)

Implemented the remaining MECHANICAL AI item:

- POST `/api/ai/program-risk-assessment` — pulls recent cases, incidents, donations, and shifts (program-scoped or org-wide) and returns a structured multi-dimensional risk score (operational/financial/compliance/staffing/beneficiary). Returns **503** on missing `OPENROUTER_API_KEY`.

Files:
- Modified: `backend/routes/ai.js` (new route appended above `module.exports`).
- Modified: `frontend/src/api.js` — added `aiApi.programRiskAssessment`.
- Modified: `frontend/src/pages/AIPredictivePage.js` — new "Program Risk Assessment" tab with `program_id` + `lookback_days` form.

Smoke test: `node --check` PASS on touched files. Live HTTP skipped — neither backend nor frontend has `node_modules` in the sandbox (constraint: no `npm install`).

Backlog still deferred: multi-language (NEEDS-PRODUCT-DECISION); bulk SMS/email (NEEDS-CREDS — Twilio/SendGrid); reporting export PDF/CSV + audit trail (MECHANICAL but non-AI, out of "BE endpoint using LLM helper" scope); field photo upload (NEEDS-PRODUCT-DECISION).

## Apply pass 5 (all backlog)

Implemented every remaining backlog item, category-aware. 9 routes (6 logical features) added.

- POST `/api/ai/multi-language/translate` — MECHANICAL with PRODUCT-DECISION: supported = `['en','es','fr','ar','zh-CN','vi']` (HHS Title VI top languages).
- POST `/api/ai/bulk-sms` — NEEDS-CREDS: Twilio; 503 + `missing: TWILIO_ACCOUNT_SID,TWILIO_AUTH_TOKEN,TWILIO_FROM_NUMBER`.
- POST `/api/ai/bulk-email` — NEEDS-CREDS: SendGrid; 503 + `missing: SENDGRID_API_KEY,SENDGRID_FROM_EMAIL`.
- GET `/api/ai/reports/cases.csv` + `/donations.csv` — MECHANICAL CSV export (additive).
- POST `/api/ai/audit-trail/log` + GET `/api/ai/audit-trail` — MECHANICAL: `CREATE TABLE IF NOT EXISTS audit_trail`.
- POST `/api/ai/field-photo` + GET `/api/ai/field-photos` — PRODUCT-DECISION: local FS storage at `./uploads/field_photos`, SHA-1 filenames; `CREATE TABLE IF NOT EXISTS field_photos`.

Files:
- New: `backend/routes/aiBacklog.js` (mounted in `backend/index.js` under `/api/ai`).
- New: `frontend/src/pages/AIBacklogPage.js`; sidebar link in `Sidebar.js`; route in `App.js`; `aiApi` extended in `frontend/src/api.js` with 9 helpers.

Smoke test: `node --check` PASS on touched files. Sandbox-stub `require('./routes/aiBacklog')` PASS — exposes 9 routes. Live HTTP skipped — `backend/node_modules` not installed (constraint: no `npm install`).
