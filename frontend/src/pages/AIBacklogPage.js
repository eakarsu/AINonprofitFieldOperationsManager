import useNativeAIRequest from '../components/useNativeAIRequest';
import NativeAIControls from '../components/NativeAIControls';
import ReadableAIReport from "./AIResultView";
import React, { useState } from 'react';
import useNonprofitSources from '../components/useNonprofitSources';
import { aiApi } from '../api';

// Apply pass 5 — backlog tools page covering:
// translate, bulk SMS/email, CSV reports, audit trail, field photo upload.

const TOOLS = [
  { id: 'translate', label: 'Translate' },
  { id: 'sms', label: 'Bulk SMS' },
  { id: 'email', label: 'Bulk Email' },
  { id: 'reports', label: 'CSV Reports' },
  { id: 'audit', label: 'Audit Trail' },
  { id: 'photo', label: 'Field Photos' },
];

const SUPPORTED_LANGS = ['en', 'es', 'fr', 'ar', 'zh-CN', 'vi'];

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
}

export default function AIBacklogPage({ showToast }) {
  const [active, setActive] = useState('translate');
  const request = useNativeAIRequest(); const { loading: loading, result: result, setResult: setResult } = request;


  // form states
  const [tx, setTx] = useState({ text: '', target_language: 'es', source_language: '', context: '' });
  const [sms, setSms] = useState({ recipients: '', body: '' });
  const [email, setEmail] = useState({ recipients: '', subject: '', body: '' });
  const [audit, setAudit] = useState({ action: '', entity_type: '', entity_id: '' });
  const [photo, setPhoto] = useState({ file: null, case_id: '', program_id: '' });

  const references = useNonprofitSources();
  const completePresets = ['Community appointment','Resource update','Program reminder'].map((label,index) => ({ label, values: {
    tx: { text: ['Your community support appointment is on Tuesday at 10 AM. Please bring your case reference.','The food pantry opens on Thursday at noon. Accessible transport can be arranged.','Please confirm your attendance at the volunteer orientation next week.'][index], target_language: ['es','fr','ar'][index], source_language: 'en', context: ['Fictional community appointment draft; retain formal and respectful register.', 'Fictional resource update; preserve accessibility and transport wording.', 'Fictional volunteer reminder; do not add dates or confirmed attendance.'][index] },
    sms: { recipients: '+12025550101,+12025550102', body: 'Example draft: '+label+'. Review recipients and consent before sending.' },
    email: { recipients: 'reviewer1@example.com,reviewer2@example.com', subject: 'Example: '+label, body: 'Example draft for review. Confirm the program details, recipients, and permissions before sending.' },
    audit: { action: 'Reviewed example planning inputs', entity_type: 'case', entity_id: references.choose('cases', audit.entity_id, index) ? String(references.choose('cases', audit.entity_id, index).id) : '' },
    photo: { file: photo.file, case_id: references.choose('cases', photo.case_id, index) ? String(references.choose('cases', photo.case_id, index).id) : '', program_id: references.choose('programs', photo.program_id, index) ? String(references.choose('programs', photo.program_id, index).id) : '' },
  } }));


  const fillExample = (values, tool = active) => { if (tool === 'translate') setTx(values.tx); else if (tool === 'sms') setSms(values.sms); else if (tool === 'email') setEmail(values.email); else if (tool === 'audit') setAudit(values.audit); else if (tool === 'photo') setPhoto(values.photo); };
  const selectTool = tool => { request.cancel(); setActive(tool); setResult(null); if (tool !== 'reports' && (!(tool === 'audit' || tool === 'photo') || !references.loading && !references.error)) fillExample(completePresets[0].values, tool); };

  const run = async () => { const result = await request.run(async options => {       if (active === 'translate') {
        const r = await aiApi.translate(tx,options);
        return r;
      } else if (active === 'sms') {
        const recipients = sms.recipients.split(',').map((s) => s.trim()).filter(Boolean);
        const r = await aiApi.bulkSms({ recipients, body: sms.body },options);
        return r;
      } else if (active === 'email') {
        const recipients = email.recipients.split(',').map((s) => s.trim()).filter(Boolean);
        const r = await aiApi.bulkEmail({ recipients, subject: email.subject, body: email.body },options);
        return r;
      } else if (active === 'reports') {
        const cases = await aiApi.reportCasesCsv(options);
        downloadBlob(cases, 'cases.csv');
        const donations = await aiApi.reportDonationsCsv(options);
        downloadBlob(donations, 'donations.csv');
        return { downloaded: ['cases.csv', 'donations.csv'] };
      } else if (active === 'audit') {
        if (audit.action) await aiApi.auditTrailLog({ action: audit.action, entity_type: audit.entity_type || null, entity_id: audit.entity_id ? parseInt(audit.entity_id, 10) : null },options);
        const r = await aiApi.auditTrailList(50,options);
        return r;
      } else if (active === 'photo') {
        if (photo.file) {
          const buf = await photo.file.arrayBuffer();
          let binary = '';
          const bytes = new Uint8Array(buf);
          for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
          const b64 = btoa(binary);
          options.signal.throwIfAborted();
          await aiApi.uploadFieldPhoto({
            image_base64: b64,
            mime_type: photo.file.type,
            case_id: photo.case_id ? parseInt(photo.case_id, 10) : undefined,
            program_id: photo.program_id ? parseInt(photo.program_id, 10) : undefined,
          },options);
        }
        const r = await aiApi.listFieldPhotos(20,options);
        return r;
      }
 }); if (result !== undefined) showToast && showToast('Done'); };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>AI Backlog Tools</h2>
          <p className="subtitle">Translation, bulk outreach, exports, audit trail, and field photo intake</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {TOOLS.map((t) => (
          <button key={t.id} onClick={() => selectTool(t.id)} className={`btn ${active === t.id ? 'btn-ai' : 'btn-secondary'}`}>{t.label}</button>
        ))}
      </div>

      <NativeAIControls request={request} presets={active === 'reports' ? [] : completePresets} blocked={(active === 'audit' || active === 'photo') && (references.loading || references.error) ? references.loading ? 'Loading saved case and program sources…' : 'Retry the saved source list before filling actual references.' : ''} onFill={values => fillExample(values)} />
      {(active === 'audit' || active === 'photo') && references.error && <div role="alert">{references.error} <button type="button" className="btn btn-secondary" onClick={references.retry}>Retry saved sources</button></div>}
      {active === 'photo' && <p>Examples fill available saved case and program fields and preserve your chosen image. Choose an actual image file to upload; examples do not generate evidence.</p>}
      <div style={{ background: '#1a1d2e', border: '1px solid #2d3048', borderRadius: 10, padding: 24 }}>
        {active === 'translate' && (
          <>
            <h3 style={{ color: '#e2e8f0', marginBottom: 16 }}>Translate</h3>
            <div className="form-group">
              <label>Target language</label>
              <select className="form-control" value={tx.target_language} onChange={(e) => setTx({ ...tx, target_language: e.target.value })}>
                {SUPPORTED_LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Source language (optional)</label><select className="form-control" value={tx.source_language} onChange={e => setTx({ ...tx, source_language: e.target.value })}><option value="">Auto-detect</option>{SUPPORTED_LANGS.map(language => <option key={language} value={language}>{language}</option>)}</select></div>
            <div className="form-group"><label>Translation context (optional)</label><textarea className="form-control" rows={3} value={tx.context} onChange={e => setTx({ ...tx, context: e.target.value })} /></div>
            <div className="form-group">
              <label>Text</label>
              <textarea className="form-control" rows={5} value={tx.text} onChange={(e) => setTx({ ...tx, text: e.target.value })} />
            </div>
          </>
        )}
        {active === 'sms' && (
          <>
            <h3 style={{ color: '#e2e8f0', marginBottom: 16 }}>Bulk SMS (Twilio — NEEDS-CREDS)</h3>
            <div className="form-group">
              <label>Recipients (comma-separated E.164)</label>
              <input className="form-control" value={sms.recipients} onChange={(e) => setSms({ ...sms, recipients: e.target.value })} placeholder="+15551234567,+15557654321" />
            </div>
            <div className="form-group">
              <label>Body</label>
              <textarea className="form-control" rows={4} value={sms.body} onChange={(e) => setSms({ ...sms, body: e.target.value })} />
            </div>
          </>
        )}
        {active === 'email' && (
          <>
            <h3 style={{ color: '#e2e8f0', marginBottom: 16 }}>Bulk Email (SendGrid — NEEDS-CREDS)</h3>
            <div className="form-group">
              <label>Recipients (comma-separated)</label>
              <input className="form-control" value={email.recipients} onChange={(e) => setEmail({ ...email, recipients: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Subject</label>
              <input className="form-control" value={email.subject} onChange={(e) => setEmail({ ...email, subject: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Body (plain text)</label>
              <textarea className="form-control" rows={6} value={email.body} onChange={(e) => setEmail({ ...email, body: e.target.value })} />
            </div>
          </>
        )}
        {active === 'reports' && (
          <>
            <h3 style={{ color: '#e2e8f0', marginBottom: 16 }}>CSV Reports</h3>
            <p style={{ color: '#94a3b8' }}>Click Run to download <code>cases.csv</code> and <code>donations.csv</code>.</p>
          </>
        )}
        {active === 'audit' && (
          <>
            <h3 style={{ color: '#e2e8f0', marginBottom: 16 }}>Audit Trail</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <div className="form-group"><label>Action</label><input className="form-control" value={audit.action} onChange={(e) => setAudit({ ...audit, action: e.target.value })} /></div>
              <div className="form-group"><label>Entity type</label><input className="form-control" value={audit.entity_type} onChange={(e) => setAudit({ ...audit, entity_type: e.target.value })} /></div>
              <div className="form-group"><label>Entity ID</label><input className="form-control" value={audit.entity_id} onChange={(e) => setAudit({ ...audit, entity_id: e.target.value })} /></div>
            </div>
            <p style={{ color: '#94a3b8', fontSize: 12 }}>Empty action = list-only. Filled = log + list.</p>
          </>
        )}
        {active === 'photo' && (
          <>
            <h3 style={{ color: '#e2e8f0', marginBottom: 16 }}>Field Photos</h3>
            <div className="form-group">
              <label>Photo</label>
              <input className="form-control" type="file" accept="image/*" onChange={(e) => setPhoto({ ...photo, file: e.target.files?.[0] || null })} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group"><label>Case ID</label><input className="form-control" value={photo.case_id} onChange={(e) => setPhoto({ ...photo, case_id: e.target.value })} /></div>
              <div className="form-group"><label>Program ID</label><input className="form-control" value={photo.program_id} onChange={(e) => setPhoto({ ...photo, program_id: e.target.value })} /></div>
            </div>
          </>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <button className="btn btn-ai" disabled={loading} onClick={run}>{loading ? 'Working…' : active === 'translate' ? 'Generate with OpenRouter' : 'Run selected action'}</button>
      </div>

      {result && (
        <ReadableAIReport result={result} />
      )}
    </div>
  );
}
