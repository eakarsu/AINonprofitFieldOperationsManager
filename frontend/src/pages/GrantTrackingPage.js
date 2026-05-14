import React, { useState } from 'react';
import { aiApi } from '../api';
import Modal from '../components/Modal';

const STATUSES = ['researching', 'drafting', 'submitted', 'awarded', 'rejected', 'withdrawn'];

const statusColor = {
  researching: '#6366f1', drafting: '#f59e0b', submitted: '#3b82f6',
  awarded: '#10b981', rejected: '#ef4444', withdrawn: '#6b7280'
};

const empty = { program: '', funder: '', amount_requested: '', status: 'researching', deadline: '', notes: '', contact: '' };

export default function GrantTrackingPage({ showToast }) {
  const [grants, setGrants] = useState([
    { id: 1, program: 'Community Health Initiative', funder: 'City Health Dept.', amount_requested: 25000, status: 'submitted', deadline: '2025-06-30', notes: 'Awaiting review decision.' },
    { id: 2, program: 'Youth Education Program', funder: 'State Education Fund', amount_requested: 50000, status: 'drafting', deadline: '2025-07-15', notes: 'Need impact metrics section.' },
    { id: 3, program: 'Food Security Drive', funder: 'Community Foundation', amount_requested: 15000, status: 'awarded', deadline: '2025-05-01', notes: 'Awarded! Report due Q3.' },
  ]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftResult, setDraftResult] = useState(null);
  const [filter, setFilter] = useState('');

  const handleSave = () => {
    if (!form.funder || !form.program) { showToast('Program and Funder are required', 'error'); return; }
    if (editing !== null) {
      setGrants(prev => prev.map(g => g.id === editing ? { ...g, ...form } : g));
      showToast('Grant updated');
    } else {
      setGrants(prev => [...prev, { ...form, id: Date.now(), amount_requested: parseFloat(form.amount_requested) || 0 }]);
      showToast('Grant added');
    }
    setShowForm(false); setForm(empty); setEditing(null); setSelected(null);
  };

  const handleDelete = (id) => {
    if (!window.confirm('Delete this grant?')) return;
    setGrants(prev => prev.filter(g => g.id !== id));
    setSelected(null);
    showToast('Grant deleted');
  };

  const handleDraftReport = async (grant) => {
    setDraftLoading(true); setDraftResult(null);
    try {
      const r = await aiApi.grantReport({ grant_name: `${grant.funder} - ${grant.program}`, reporting_period: 'Current Quarter', program_id: null });
      setDraftResult(r.result?.report || r.result);
      showToast('Report drafted');
    } catch (e) { showToast(e.response?.data?.error || e.message, 'error'); }
    setDraftLoading(false);
  };

  const filtered = filter ? grants.filter(g => g.status === filter) : grants;
  const totalRequested = grants.reduce((s, g) => s + (parseFloat(g.amount_requested) || 0), 0);
  const totalAwarded = grants.filter(g => g.status === 'awarded').reduce((s, g) => s + (parseFloat(g.amount_requested) || 0), 0);

  return (
    <div>
      <div className="page-header">
        <div><h2>Grant Tracking</h2><p className="subtitle">Track grant applications and generate AI-powered reports</p></div>
        <button className="btn btn-primary" onClick={() => { setForm(empty); setEditing(null); setShowForm(true); }}>+ Add Grant</button>
      </div>

      <div className="stats-row">
        <div className="stat-box"><div className="stat-number">{grants.length}</div><div className="stat-label">Total Grants</div></div>
        <div className="stat-box"><div className="stat-number" style={{ color: '#10b981' }}>${totalAwarded.toLocaleString()}</div><div className="stat-label">Awarded</div></div>
        <div className="stat-box"><div className="stat-number" style={{ color: '#6366f1' }}>${totalRequested.toLocaleString()}</div><div className="stat-label">Total Requested</div></div>
        <div className="stat-box"><div className="stat-number" style={{ color: '#f59e0b' }}>{grants.filter(g => g.status === 'submitted').length}</div><div className="stat-label">Pending</div></div>
      </div>

      {/* Status filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button className={`btn btn-sm ${filter === '' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('')}>All</button>
        {STATUSES.map(s => (
          <button key={s} className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter(s)}>
            {s.charAt(0).toUpperCase() + s.slice(1)} ({grants.filter(g => g.status === s).length})
          </button>
        ))}
      </div>

      {draftResult && (
        <div style={{ background: '#1a1d2e', border: '1px solid #10b981', borderRadius: 10, padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ color: '#10b981' }}>AI-Generated Grant Report</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => setDraftResult(null)}>x</button>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 14, fontSize: 13, color: '#e2e8f0', whiteSpace: 'pre-wrap', lineHeight: 1.7, maxHeight: 400, overflowY: 'auto' }}>
            {draftResult}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {filtered.map(grant => (
          <div key={grant.id} className="card" style={{ cursor: 'pointer' }}>
            <div onClick={() => setSelected(grant)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="card-title" style={{ flex: 1 }}>{grant.funder}</div>
                <span className="badge" style={{ background: (statusColor[grant.status] || '#6b7280') + '20', color: statusColor[grant.status] || '#6b7280', flexShrink: 0 }}>{grant.status}</span>
              </div>
              <div className="card-summary">{grant.program}</div>
              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#e2e8f0' }}>${(parseFloat(grant.amount_requested) || 0).toLocaleString()}</span>
                {grant.deadline && <span style={{ fontSize: 12, color: '#6b7280' }}>Due: {grant.deadline}</span>}
              </div>
              {grant.notes && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>{grant.notes}</div>}
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => { setForm({ ...grant }); setEditing(grant.id); setShowForm(true); }}>Edit</button>
              <button className="btn btn-ai btn-sm" onClick={() => handleDraftReport(grant)} disabled={draftLoading}>{draftLoading ? '...' : 'AI Report'}</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(grant.id)}>Del</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1/-1', padding: 40, textAlign: 'center', color: '#6b7280' }}>No grants in this category yet.</div>
        )}
      </div>

      {showForm && (
        <Modal title={editing !== null ? 'Edit Grant' : 'Add Grant Application'} onClose={() => { setShowForm(false); setEditing(null); }}>
          <div className="form-group"><label>Funder / Organization *</label><input className="form-control" value={form.funder} onChange={e => setForm({ ...form, funder: e.target.value })} /></div>
          <div className="form-group"><label>Program *</label><input className="form-control" value={form.program} onChange={e => setForm({ ...form, program: e.target.value })} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group"><label>Amount Requested ($)</label><input className="form-control" type="number" value={form.amount_requested} onChange={e => setForm({ ...form, amount_requested: e.target.value })} /></div>
            <div className="form-group"><label>Status</label>
              <select className="form-control" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Deadline</label><input className="form-control" type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} /></div>
            <div className="form-group"><label>Contact</label><input className="form-control" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} placeholder="Program officer name" /></div>
          </div>
          <div className="form-group"><label>Notes</label><textarea className="form-control" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave}>{editing !== null ? 'Update' : 'Add Grant'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
