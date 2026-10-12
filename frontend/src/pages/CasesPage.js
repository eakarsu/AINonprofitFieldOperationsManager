import AIResultView from "./AIResultView";
import NativeAIControls from "../components/NativeAIControls";
import useNativeAIRequest from "../components/useNativeAIRequest";
import AIWorkspaceModal from '../components/AIWorkspaceModal';
import '../components/AIWorkspace.css';
import React, { useState, useEffect } from 'react';
import { casesApi, aiApi } from '../api';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';

const empty = { client_name: '', contact: '', needs: '', urgency_score: 5, status: 'open', program_id: '' };

export default function CasesPage({ showToast }) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(false);
  const triageRequest = useNativeAIRequest();
  const triageResult = triageRequest.result?.result;
  const triageLoading = triageRequest.loading;
  const [demographics, setDemographics] = useState('');
  const [listError, setListError] = useState(''), [listLoading, setListLoading] = useState(true);
  const closeDetails = () => { triageRequest.cancel(); setSelected(null); triageRequest.setResult(null); setDemographics(''); };

  useEffect(() => { load(); }, [page]);

  const load = async () => {
    setListLoading(true); setListError('');
    try {
      const r = await casesApi.getAll(page, 20);
      const rows = Array.isArray(r) ? r : r?.data;
      if (!Array.isArray(rows)) throw new Error('The saved case list returned an unexpected response.');
      setItems(rows);
      if (r.pagination) setPagination(r.pagination);
    } catch (e) { setListError(e.response?.data?.error || e.message || 'Could not load saved cases.'); } finally { setListLoading(false); }
  };

  const handleSave = async () => {
    try {
      const data = { ...form, needs: form.needs ? form.needs.split(',').map(s => s.trim()) : [] };
      if (editing) { await casesApi.update(selected.id, data); showToast('Case updated'); }
      else { await casesApi.create(data); showToast('Case created'); }
      setShowForm(false); setForm(empty); setEditing(false); setSelected(null); load();
    } catch (e) { showToast(e.response?.data?.error || e.message, 'error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this case?')) return;
    try { await casesApi.delete(id); showToast('Deleted'); setSelected(null); load(); } catch (e) { showToast(e.message, 'error'); }
  };

  const handleTriage = async item => {
    const response = await triageRequest.run(options => aiApi.triageCase({ case_id: item.id, client_name: item.client_name, needs: item.needs, urgency_score: item.urgency_score, demographics }, options));
    if (response !== undefined) { showToast('AI triage complete'); load(); }
  };

  const urgencyColor = (score) => {
    if (score >= 8) return '#ef4444';
    if (score >= 6) return '#f97316';
    if (score >= 4) return '#f59e0b';
    return '#10b981';
  };

  if (selected && !showForm) {
    return (
      <div>
        <button className="back-btn" onClick={closeDetails}>&larr; Back to Cases</button>
        <AIWorkspaceModal title="Record details" onClose={closeDetails}>
          <div className="detail-header">
            <div>
              <h3>{selected.client_name}</h3>
              <div className="card-meta" style={{ marginTop: 8 }}>
                <span className={`badge badge-${selected.status}`}>{selected.status}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: urgencyColor(selected.urgency_score) }}>Urgency: {selected.urgency_score}/10</span>
              </div>
            </div>
            <div className="detail-actions">
              <button className="btn btn-ai" onClick={() => handleTriage(selected)} disabled={triageLoading}>
                {triageLoading ? 'Triaging...' : 'Generate with OpenRouter'}
              </button>
              <button className="btn btn-secondary" onClick={() => { triageRequest.cancel(); setForm({ ...selected, needs: Array.isArray(selected.needs) ? selected.needs.join(', ') : '' }); setEditing(true); setShowForm(true); }}>Edit</button>
              <button className="btn btn-danger" onClick={() => handleDelete(selected.id)}>Delete</button>
            </div>
          </div>
          <NativeAIControls request={triageRequest} presets={['Source-only review', 'Missing-information review', 'Resource-access review'].map(label => ({ label, values: 'Review context: ' + label + '. No additional demographic facts have been supplied. Use only the displayed saved case facts; do not infer actual age, health, family circumstances or consent.' }))} onFill={value => setDemographics(value)} />
          <div className="form-group"><label>Demographics / review context (optional)</label><textarea className="form-control" rows={3} value={demographics} onChange={event => setDemographics(event.target.value)} /></div>
          <p>Generate updates the selected case’s native AI triage annotation. The source facts above remain unchanged; review the recommendation before taking action.</p>
          <div className="detail-grid">
            <div className="detail-field"><div className="field-label">Contact</div><div className="field-value">{selected.contact || 'N/A'}</div></div>
            <div className="detail-field"><div className="field-label">Program ID</div><div className="field-value">{selected.program_id || 'Unassigned'}</div></div>
            <div className="detail-field"><div className="field-label">Urgency Score</div><div className="field-value" style={{ fontSize: 24, fontWeight: 800, color: urgencyColor(selected.urgency_score) }}>{selected.urgency_score}/10</div></div>
            <div className="detail-field"><div className="field-label">Created</div><div className="field-value">{new Date(selected.created_at).toLocaleString()}</div></div>
          </div>
          <div className="detail-field"><div className="field-label">Needs</div><div className="field-value">{Array.isArray(selected.needs) ? selected.needs.join(', ') : selected.needs || 'N/A'}</div></div>
          {selected.ai_triage && (
            <div style={{ marginTop: 16 }}>
              <div className="field-label" style={{ marginBottom: 8 }}>AI Triage Result</div>
              <div className="ai-result-box">
                <AIResultView result={selected.ai_triage} title="Saved case triage" />
              </div>
            </div>
          )}
          {triageResult && (
            <div style={{ marginTop: 16 }}>
              <div className="field-label" style={{ marginBottom: 8 }}>New AI Triage</div>
              <div className="ai-result-box">
                <AIResultView result={triageResult} title="New case triage" />
              </div>
            </div>
          )}
        </AIWorkspaceModal>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div><h2>Cases</h2><p className="subtitle">Client cases with AI-powered triage and routing</p></div>
        <button className="btn btn-primary" onClick={() => { setForm(empty); setEditing(false); setShowForm(true); }}>+ New Case</button>
      </div>
      {listLoading && <p role="status">Loading saved cases…</p>}{listError && <div role="alert">{listError} <button type="button" className="btn btn-secondary" onClick={load}>Retry cases</button></div>}
      <div className="stats-row">
        <div className="stat-box"><div className="stat-number">{pagination ? pagination.total : items.length}</div><div className="stat-label">Total</div></div>
        <div className="stat-box"><div className="stat-number" style={{ color: '#10b981' }}>{items.filter(i => i.status === 'open').length}</div><div className="stat-label">Open</div></div>
        <div className="stat-box"><div className="stat-number" style={{ color: '#ef4444' }}>{items.filter(i => i.urgency_score >= 8).length}</div><div className="stat-label">Critical (8+)</div></div>
        <div className="stat-box"><div className="stat-number" style={{ color: '#a855f7' }}>{items.filter(i => i.ai_triage).length}</div><div className="stat-label">AI Triaged</div></div>
      </div>
      <div className="card-grid">
        {items.map(item => (
          <div key={item.id} className="card" onClick={() => { triageRequest.cancel(); setDemographics(''); triageRequest.setResult(null); setSelected(item); }}>
            <div className="card-title">{item.client_name}</div>
            <div className="card-meta">
              <span className={`badge badge-${item.status}`}>{item.status}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: urgencyColor(item.urgency_score) }}>Urgency {item.urgency_score}/10</span>
            </div>
            <div className="card-summary">{Array.isArray(item.needs) ? item.needs.join(', ') : item.needs}</div>
            {item.ai_triage && <div style={{ marginTop: 6, fontSize: 11, color: '#a855f7', fontWeight: 600 }}>AI Triaged</div>}
          </div>
        ))}
      </div>
      {pagination && <Pagination page={page} totalPages={pagination.totalPages} onPageChange={setPage} />}

      {showForm && (
        <Modal title={editing ? 'Edit Case' : 'New Case'} onClose={() => { setShowForm(false); setEditing(false); }}>
          <div className="form-group"><label>Client Name *</label><input className="form-control" value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group"><label>Contact</label><input className="form-control" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} /></div>
            <div className="form-group"><label>Urgency (1-10)</label><input className="form-control" type="number" min="1" max="10" value={form.urgency_score} onChange={e => setForm({ ...form, urgency_score: parseInt(e.target.value) || 5 })} /></div>
            <div className="form-group"><label>Status</label>
              <select className="form-control" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="open">Open</option><option value="in_progress">In Progress</option><option value="closed">Closed</option><option value="referred">Referred</option>
              </select>
            </div>
            <div className="form-group"><label>Program ID</label><input className="form-control" type="number" value={form.program_id} onChange={e => setForm({ ...form, program_id: e.target.value })} /></div>
          </div>
          <div className="form-group"><label>Needs (comma-separated)</label><textarea className="form-control" value={form.needs} onChange={e => setForm({ ...form, needs: e.target.value })} placeholder="e.g. food, shelter, medical" /></div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => { setShowForm(false); setEditing(false); }}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave}>{editing ? 'Update' : 'Create'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
