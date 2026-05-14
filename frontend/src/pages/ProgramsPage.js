import React, { useState, useEffect } from 'react';
import { programsApi, extractData } from '../api';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';

const empty = { name: '', description: '', location: '', capacity: 0, status: 'active' };

export default function ProgramsPage({ showToast }) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(false);

  useEffect(() => { load(); }, [page]);

  const load = async () => {
    try {
      const r = await programsApi.getAll(page, 20);
      setItems(extractData(r));
      if (r.pagination) setPagination(r.pagination);
    } catch (e) { console.error(e); }
  };

  const handleSave = async () => {
    try {
      if (editing) { await programsApi.update(selected.id, form); showToast('Program updated'); }
      else { await programsApi.create(form); showToast('Program created'); }
      setShowForm(false); setForm(empty); setEditing(false); setSelected(null); load();
    } catch (e) { showToast(e.response?.data?.error || e.message, 'error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this program?')) return;
    try { await programsApi.delete(id); showToast('Deleted'); setSelected(null); load(); } catch (e) { showToast(e.message, 'error'); }
  };

  if (selected && !showForm) {
    return (
      <div>
        <button className="back-btn" onClick={() => setSelected(null)}>&larr; Back to Programs</button>
        <div className="detail-view">
          <div className="detail-header">
            <div><h3>{selected.name}</h3><div className="card-meta" style={{ marginTop: 8 }}><span className={`badge badge-${selected.status}`}>{selected.status}</span></div></div>
            <div className="detail-actions">
              <button className="btn btn-secondary" onClick={() => { setForm(selected); setEditing(true); setShowForm(true); }}>Edit</button>
              <button className="btn btn-danger" onClick={() => handleDelete(selected.id)}>Delete</button>
            </div>
          </div>
          <div className="detail-grid">
            <div className="detail-field"><div className="field-label">Location</div><div className="field-value">{selected.location || 'N/A'}</div></div>
            <div className="detail-field"><div className="field-label">Capacity</div><div className="field-value">{selected.capacity}</div></div>
          </div>
          <div className="detail-field"><div className="field-label">Description</div><div className="field-value">{selected.description || 'No description'}</div></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div><h2>Programs</h2><p className="subtitle">Manage service programs and locations</p></div>
        <button className="btn btn-primary" onClick={() => { setForm(empty); setEditing(false); setShowForm(true); }}>+ New Program</button>
      </div>
      <div className="stats-row">
        <div className="stat-box"><div className="stat-number">{pagination ? pagination.total : items.length}</div><div className="stat-label">Total</div></div>
        <div className="stat-box"><div className="stat-number" style={{ color: '#10b981' }}>{items.filter(i => i.status === 'active').length}</div><div className="stat-label">Active</div></div>
        <div className="stat-box"><div className="stat-number" style={{ color: '#6b7280' }}>{items.filter(i => i.status !== 'active').length}</div><div className="stat-label">Inactive</div></div>
        <div className="stat-box"><div className="stat-number" style={{ color: '#3b82f6' }}>{items.reduce((a, i) => a + (i.capacity || 0), 0)}</div><div className="stat-label">Total Capacity</div></div>
      </div>
      <div className="card-grid">
        {items.map(item => (
          <div key={item.id} className="card" onClick={() => setSelected(item)}>
            <div className="card-title">{item.name}</div>
            <div className="card-meta"><span className={`badge badge-${item.status}`}>{item.status}</span></div>
            <div className="card-summary">{item.description}</div>
            {item.location && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>📍 {item.location} &bull; Capacity: {item.capacity}</div>}
          </div>
        ))}
      </div>
      {pagination && <Pagination page={page} totalPages={pagination.totalPages} onPageChange={setPage} />}

      {showForm && (
        <Modal title={editing ? 'Edit Program' : 'New Program'} onClose={() => { setShowForm(false); setEditing(false); }}>
          <div className="form-group"><label>Name *</label><input className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group"><label>Location</label><input className="form-control" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
            <div className="form-group"><label>Capacity</label><input className="form-control" type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: parseInt(e.target.value) || 0 })} /></div>
            <div className="form-group"><label>Status</label>
              <select className="form-control" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="active">Active</option><option value="inactive">Inactive</option><option value="paused">Paused</option>
              </select>
            </div>
          </div>
          <div className="form-group"><label>Description</label><textarea className="form-control" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => { setShowForm(false); setEditing(false); }}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave}>{editing ? 'Update' : 'Create'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
