import React, { useState, useEffect } from 'react';
import { donationsApi, extractData } from '../api';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';

const empty = { donor_name: '', donor_email: '', type: 'monetary', item_description: '', quantity: 1, weight_lbs: '', location: '', status: 'pending' };

export default function DonationsPage({ showToast }) {
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
      const r = await donationsApi.getAll(page, 20);
      setItems(extractData(r));
      if (r.pagination) setPagination(r.pagination);
    } catch (e) { console.error(e); }
  };

  const handleSave = async () => {
    try {
      if (editing) { await donationsApi.update(selected.id, form); showToast('Donation updated'); }
      else { await donationsApi.create(form); showToast('Donation recorded'); }
      setShowForm(false); setForm(empty); setEditing(false); setSelected(null); load();
    } catch (e) { showToast(e.response?.data?.error || e.message, 'error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this donation?')) return;
    try { await donationsApi.delete(id); showToast('Deleted'); setSelected(null); load(); }
    catch (e) { showToast(e.message, 'error'); }
  };

  const statusColor = (s) => ({ pending: '#f59e0b', received: '#10b981', distributed: '#6366f1', cancelled: '#ef4444' }[s] || '#6b7280');

  if (selected && !showForm) return (
    <div>
      <button className="back-btn" onClick={() => setSelected(null)}>&larr; Back</button>
      <div className="detail-view">
        <div className="detail-header">
          <div><h3>{selected.donor_name || 'Anonymous'}</h3><div className="card-meta"><span className="badge" style={{ background: statusColor(selected.status) + '20', color: statusColor(selected.status) }}>{selected.status}</span></div></div>
          <div className="detail-actions">
            <button className="btn btn-secondary" onClick={() => { setForm({ ...selected }); setEditing(true); setShowForm(true); }}>Edit</button>
            <button className="btn btn-danger" onClick={() => handleDelete(selected.id)}>Delete</button>
          </div>
        </div>
        <div className="detail-grid">
          {[['Donor Email', selected.donor_email], ['Type', selected.type], ['Item', selected.item_description], ['Quantity', selected.quantity], ['Weight', selected.weight_lbs ? `${selected.weight_lbs} lbs` : null], ['Location', selected.location], ['Date', new Date(selected.created_at).toLocaleDateString()]].filter(([,v]) => v).map(([k, v]) => (
            <div className="detail-field" key={k}><div className="field-label">{k}</div><div className="field-value">{v}</div></div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div><h2>Donations</h2><p className="subtitle">Track all incoming donations and resources</p></div>
        <button className="btn btn-primary" onClick={() => { setForm(empty); setEditing(false); setShowForm(true); }}>+ Record Donation</button>
      </div>
      <div className="stats-row">
        <div className="stat-box"><div className="stat-number">{pagination ? pagination.total : items.length}</div><div className="stat-label">Total</div></div>
        <div className="stat-box"><div className="stat-number" style={{ color: '#f59e0b' }}>{items.filter(i => i.status === 'pending').length}</div><div className="stat-label">Pending</div></div>
        <div className="stat-box"><div className="stat-number" style={{ color: '#10b981' }}>{items.filter(i => i.status === 'received').length}</div><div className="stat-label">Received</div></div>
        <div className="stat-box"><div className="stat-number" style={{ color: '#6366f1' }}>{items.filter(i => i.status === 'distributed').length}</div><div className="stat-label">Distributed</div></div>
      </div>
      <div className="card-grid">
        {items.map(item => (
          <div key={item.id} className="card" onClick={() => setSelected(item)}>
            <div className="card-title">{item.donor_name || 'Anonymous'}</div>
            <div className="card-meta">
              <span className="badge" style={{ background: statusColor(item.status) + '20', color: statusColor(item.status) }}>{item.status}</span>
              <span style={{ fontSize: 12, color: '#6b7280' }}>{item.type}</span>
            </div>
            <div className="card-summary">{item.item_description || 'General donation'} {item.quantity > 1 ? `(qty: ${item.quantity})` : ''}</div>
          </div>
        ))}
      </div>
      {pagination && <Pagination page={page} totalPages={pagination.totalPages} onPageChange={setPage} />}
      {showForm && (
        <Modal title={editing ? 'Edit Donation' : 'Record Donation'} onClose={() => { setShowForm(false); setEditing(false); }}>
          <div className="form-group"><label>Donor Name</label><input className="form-control" value={form.donor_name} onChange={e => setForm({ ...form, donor_name: e.target.value })} placeholder="Anonymous" /></div>
          <div className="form-group"><label>Donor Email</label><input className="form-control" type="email" value={form.donor_email} onChange={e => setForm({ ...form, donor_email: e.target.value })} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group"><label>Type</label>
              <select className="form-control" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                {['monetary', 'food', 'clothing', 'supplies', 'equipment', 'services', 'other'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Status</label>
              <select className="form-control" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                {['pending', 'received', 'distributed', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Quantity</label><input className="form-control" type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })} /></div>
            <div className="form-group"><label>Weight (lbs)</label><input className="form-control" type="number" step="0.1" value={form.weight_lbs} onChange={e => setForm({ ...form, weight_lbs: e.target.value })} /></div>
          </div>
          <div className="form-group"><label>Item Description</label><textarea className="form-control" value={form.item_description} onChange={e => setForm({ ...form, item_description: e.target.value })} /></div>
          <div className="form-group"><label>Location</label><input className="form-control" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => { setShowForm(false); setEditing(false); }}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave}>{editing ? 'Update' : 'Record'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
