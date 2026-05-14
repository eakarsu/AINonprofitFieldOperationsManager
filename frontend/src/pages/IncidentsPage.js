import React, { useState, useEffect } from 'react';
import { incidentsApi, aiApi, extractData } from '../api';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';

const empty = { location: '', incident_type: '', description: '', severity: 'medium', status: 'open' };

export default function IncidentsPage({ showToast }) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(false);
  const [clusterResult, setClusterResult] = useState(null);
  const [clusterLoading, setClusterLoading] = useState(false);

  useEffect(() => { load(); }, [page]);

  const load = async () => {
    try {
      const r = await incidentsApi.getAll(page, 20);
      setItems(extractData(r));
      if (r.pagination) setPagination(r.pagination);
    } catch (e) { console.error(e); }
  };

  const handleSave = async () => {
    try {
      if (editing) { await incidentsApi.update(selected.id, form); showToast('Incident updated'); }
      else { await incidentsApi.create(form); showToast('Incident reported'); }
      setShowForm(false); setForm(empty); setEditing(false); setSelected(null); load();
    } catch (e) { showToast(e.response?.data?.error || e.message, 'error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this incident?')) return;
    try { await incidentsApi.delete(id); showToast('Deleted'); setSelected(null); load(); }
    catch (e) { showToast(e.message, 'error'); }
  };

  const handleCluster = async () => {
    setClusterLoading(true); setClusterResult(null);
    try {
      const r = await aiApi.incidentCluster({});
      setClusterResult(r.result);
      showToast('AI pattern analysis complete');
    } catch (e) { showToast(e.response?.data?.error || e.message, 'error'); }
    setClusterLoading(false);
  };

  const severityColor = { low: '#10b981', medium: '#f59e0b', high: '#f97316', critical: '#ef4444' };

  return (
    <div>
      <div className="page-header">
        <div><h2>Incidents</h2><p className="subtitle">Safety incidents and field reports</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ai" onClick={handleCluster} disabled={clusterLoading}>{clusterLoading ? 'Analyzing...' : 'AI Pattern Analysis'}</button>
          <button className="btn btn-primary" onClick={() => { setForm(empty); setEditing(false); setShowForm(true); }}>+ Report Incident</button>
        </div>
      </div>

      {clusterResult && (
        <div style={{ background: '#1a1d2e', border: '1px solid #f59e0b', borderRadius: 10, padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ color: '#f59e0b' }}>AI Pattern Analysis (Last 90 Days)</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => setClusterResult(null)}>x</button>
          </div>
          {clusterResult.clusters?.map((c, i) => (
            <div key={i} style={{ background: 'rgba(245,158,11,0.08)', borderRadius: 7, padding: '10px 14px', marginBottom: 8, borderLeft: `3px solid ${({ critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#10b981' }[c.risk_level] || '#6b7280')}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong style={{ color: '#e2e8f0' }}>{c.cluster_name}</strong>
                <span style={{ fontSize: 11, color: '#6b7280' }}>{c.frequency} incidents | {c.severity_trend}</span>
              </div>
              {c.recommendations?.map((rec, j) => <div key={j} style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>- {rec}</div>)}
            </div>
          ))}
          {clusterResult.priority_interventions?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', marginBottom: 6 }}>Priority Interventions</div>
              {clusterResult.priority_interventions.map((i, j) => <div key={j} style={{ fontSize: 12, color: '#9ca3af' }}>- {i}</div>)}
            </div>
          )}
        </div>
      )}

      <div className="stats-row">
        <div className="stat-box"><div className="stat-number">{pagination ? pagination.total : items.length}</div><div className="stat-label">Total</div></div>
        <div className="stat-box"><div className="stat-number" style={{ color: '#ef4444' }}>{items.filter(i => i.severity === 'critical' || i.severity === 'high').length}</div><div className="stat-label">High/Critical</div></div>
        <div className="stat-box"><div className="stat-number" style={{ color: '#f59e0b' }}>{items.filter(i => i.status === 'open').length}</div><div className="stat-label">Open</div></div>
      </div>

      <div className="card-grid">
        {items.map(item => (
          <div key={item.id} className="card" onClick={() => setSelected(item)}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div className="card-title">{item.incident_type || 'Incident'}</div>
              <span className="badge" style={{ background: (severityColor[item.severity] || '#6b7280') + '20', color: severityColor[item.severity] || '#6b7280' }}>{item.severity}</span>
            </div>
            <div className="card-meta"><span style={{ fontSize: 12, color: '#6b7280' }}>{item.location}</span></div>
            <div className="card-summary">{item.description}</div>
          </div>
        ))}
      </div>
      {pagination && <Pagination page={page} totalPages={pagination.totalPages} onPageChange={setPage} />}

      {selected && !showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div className="modal">
            <div className="modal-header"><h2>{selected.incident_type}</h2><button className="close-btn" onClick={() => setSelected(null)}>x</button></div>
            <div className="modal-body">
              <p style={{ color: '#9ca3af', fontSize: 14 }}>{selected.description}</p>
              {[['Location', selected.location], ['Severity', selected.severity], ['Status', selected.status], ['Date', new Date(selected.created_at).toLocaleString()]].map(([k, v]) => (
                <div key={k} style={{ marginBottom: 10 }}><div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', fontWeight: 700 }}>{k}</div><div style={{ color: '#e2e8f0' }}>{v}</div></div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setForm({ ...selected }); setEditing(true); setShowForm(true); setSelected(null); }}>Edit</button>
              <button className="btn btn-danger" onClick={() => handleDelete(selected.id)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <Modal title={editing ? 'Edit Incident' : 'Report Incident'} onClose={() => { setShowForm(false); setEditing(false); }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group"><label>Incident Type *</label>
              <select className="form-control" value={form.incident_type} onChange={e => setForm({ ...form, incident_type: e.target.value })}>
                <option value="">Select...</option>
                {['Safety hazard', 'Volunteer conflict', 'Client complaint', 'Property damage', 'Medical emergency', 'Security breach', 'Policy violation', 'Equipment failure', 'Other'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Severity</label>
              <select className="form-control" value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })}>
                {['low', 'medium', 'high', 'critical'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Status</label>
              <select className="form-control" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                {['open', 'investigating', 'resolved', 'closed'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Location</label><input className="form-control" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
          </div>
          <div className="form-group"><label>Description *</label><textarea className="form-control" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={4} /></div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => { setShowForm(false); setEditing(false); }}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave}>{editing ? 'Update' : 'Report'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
