import React, { useState, useEffect } from 'react';
import { volunteersApi, extractData } from '../api';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';

const empty = { name: '', email: '', skills: '', location: '', status: 'active', geo_lat: '', geo_lng: '' };

export default function VolunteersPage({ showToast }) {
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
      const r = await volunteersApi.getAll(page, 20);
      setItems(extractData(r));
      if (r.pagination) setPagination(r.pagination);
    } catch (e) { console.error(e); }
  };

  const handleSave = async () => {
    try {
      const data = { ...form, skills: form.skills ? form.skills.split(',').map(s => s.trim()) : [] };
      if (editing) { await volunteersApi.update(selected.id, data); showToast('Volunteer updated'); }
      else { await volunteersApi.create(data); showToast('Volunteer created'); }
      setShowForm(false); setForm(empty); setEditing(false); setSelected(null); load();
    } catch (e) { showToast(e.response?.data?.error || e.message, 'error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this volunteer?')) return;
    try { await volunteersApi.delete(id); showToast('Deleted'); setSelected(null); load(); } catch (e) { showToast(e.message, 'error'); }
  };

  const handleEdit = (item) => {
    setForm({ ...item, skills: Array.isArray(item.skills) ? item.skills.join(', ') : '' });
    setEditing(true); setSelected(item); setShowForm(true);
  };

  if (selected && !showForm) {
    return (
      <div>
        <button className="back-btn" onClick={() => setSelected(null)}>&larr; Back to Volunteers</button>
        <div className="detail-view">
          <div className="detail-header">
            <div>
              <h3>{selected.name}</h3>
              <div className="card-meta" style={{ marginTop: 8 }}>
                <span className={`badge badge-${selected.status}`}>{selected.status}</span>
              </div>
            </div>
            <div className="detail-actions">
              <button className="btn btn-secondary" onClick={() => handleEdit(selected)}>Edit</button>
              <button className="btn btn-danger" onClick={() => handleDelete(selected.id)}>Delete</button>
            </div>
          </div>
          <div className="detail-grid">
            <div className="detail-field"><div className="field-label">Email</div><div className="field-value">{selected.email || 'N/A'}</div></div>
            <div className="detail-field"><div className="field-label">Location</div><div className="field-value">{selected.location || 'N/A'}</div></div>
            <div className="detail-field"><div className="field-label">Skills</div><div className="field-value">{Array.isArray(selected.skills) ? selected.skills.join(', ') : 'N/A'}</div></div>
            <div className="detail-field"><div className="field-label">Geo</div><div className="field-value">{selected.geo_lat ? `${selected.geo_lat}, ${selected.geo_lng}` : 'N/A'}</div></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div><h2>Volunteers</h2><p className="subtitle">Manage field volunteers and their availability</p></div>
        <button className="btn btn-primary" onClick={() => { setForm(empty); setEditing(false); setShowForm(true); }}>+ New Volunteer</button>
      </div>
      <div className="stats-row">
        <div className="stat-box"><div className="stat-number">{pagination ? pagination.total : items.length}</div><div className="stat-label">Total</div></div>
        <div className="stat-box"><div className="stat-number" style={{ color: '#10b981' }}>{items.filter(i => i.status === 'active').length}</div><div className="stat-label">Active</div></div>
        <div className="stat-box"><div className="stat-number" style={{ color: '#6b7280' }}>{items.filter(i => i.status === 'inactive').length}</div><div className="stat-label">Inactive</div></div>
        <div className="stat-box"><div className="stat-number" style={{ color: '#3b82f6' }}>{items.filter(i => i.skills && i.skills.length > 0).length}</div><div className="stat-label">With Skills</div></div>
      </div>
      <div className="card-grid">
        {items.map(item => (
          <div key={item.id} className="card" onClick={() => setSelected(item)}>
            <div className="card-title">{item.name}</div>
            <div className="card-meta">
              <span className={`badge badge-${item.status}`}>{item.status}</span>
            </div>
            <div className="card-summary">{item.email}</div>
            {item.location && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>📍 {item.location}</div>}
            {Array.isArray(item.skills) && item.skills.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {item.skills.slice(0, 3).map(s => (
                  <span key={s} style={{ fontSize: 11, background: 'rgba(59,130,246,0.15)', color: '#3b82f6', padding: '2px 7px', borderRadius: 10 }}>{s}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {pagination && <Pagination page={page} totalPages={pagination.totalPages} onPageChange={setPage} />}

      {showForm && (
        <Modal title={editing ? 'Edit Volunteer' : 'New Volunteer'} onClose={() => { setShowForm(false); setEditing(false); }}>
          <div className="form-group"><label>Name *</label><input className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full name" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group"><label>Email</label><input className="form-control" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" /></div>
            <div className="form-group"><label>Status</label>
              <select className="form-control" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="active">Active</option><option value="inactive">Inactive</option><option value="on_leave">On Leave</option>
              </select>
            </div>
            <div className="form-group"><label>Location</label><input className="form-control" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="City, State" /></div>
            <div className="form-group"><label>Skills (comma-separated)</label><input className="form-control" value={form.skills} onChange={e => setForm({ ...form, skills: e.target.value })} placeholder="e.g. medical, driving, languages" /></div>
            <div className="form-group"><label>Latitude</label><input className="form-control" type="number" value={form.geo_lat} onChange={e => setForm({ ...form, geo_lat: e.target.value })} /></div>
            <div className="form-group"><label>Longitude</label><input className="form-control" type="number" value={form.geo_lng} onChange={e => setForm({ ...form, geo_lng: e.target.value })} /></div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => { setShowForm(false); setEditing(false); }}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave}>{editing ? 'Update' : 'Create'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
