import React, { useState, useEffect } from 'react';
import { shiftsApi, extractData } from '../api';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';

const empty = { volunteer_id: '', program_id: '', location: '', start_time: '', end_time: '', status: 'scheduled' };

export default function ShiftsPage({ showToast }) {
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
      const r = await shiftsApi.getAll(page, 20);
      setItems(extractData(r));
      if (r.pagination) setPagination(r.pagination);
    } catch (e) { console.error(e); }
  };

  const handleSave = async () => {
    try {
      if (editing) { await shiftsApi.update(selected.id, form); showToast('Shift updated'); }
      else { await shiftsApi.create(form); showToast('Shift created'); }
      setShowForm(false); setForm(empty); setEditing(false); setSelected(null); load();
    } catch (e) { showToast(e.response?.data?.error || e.message, 'error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this shift?')) return;
    try { await shiftsApi.delete(id); showToast('Deleted'); setSelected(null); load(); } catch (e) { showToast(e.message, 'error'); }
  };

  return (
    <div>
      <div className="page-header">
        <div><h2>Shifts</h2><p className="subtitle">Track volunteer shifts and check-ins</p></div>
        <button className="btn btn-primary" onClick={() => { setForm(empty); setEditing(false); setShowForm(true); }}>+ New Shift</button>
      </div>
      <div className="stats-row">
        <div className="stat-box"><div className="stat-number">{pagination ? pagination.total : items.length}</div><div className="stat-label">Total</div></div>
        <div className="stat-box"><div className="stat-number" style={{ color: '#10b981' }}>{items.filter(i => i.status === 'completed').length}</div><div className="stat-label">Completed</div></div>
        <div className="stat-box"><div className="stat-number" style={{ color: '#3b82f6' }}>{items.filter(i => i.status === 'scheduled').length}</div><div className="stat-label">Scheduled</div></div>
        <div className="stat-box"><div className="stat-number" style={{ color: '#f59e0b' }}>{items.filter(i => i.status === 'in_progress').length}</div><div className="stat-label">In Progress</div></div>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Volunteer</th>
            <th>Program</th>
            <th>Location</th>
            <th>Start</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id}>
              <td>{item.volunteer_name || `#${item.volunteer_id}`}</td>
              <td>{item.program_name || (item.program_id ? `#${item.program_id}` : 'N/A')}</td>
              <td>{item.location || 'N/A'}</td>
              <td>{item.start_time ? new Date(item.start_time).toLocaleString() : 'N/A'}</td>
              <td><span className={`badge badge-${item.status}`}>{item.status}</span></td>
              <td>
                <button className="btn btn-sm btn-secondary" onClick={() => { setForm({ volunteer_id: item.volunteer_id || '', program_id: item.program_id || '', location: item.location || '', start_time: item.start_time ? item.start_time.slice(0, 16) : '', end_time: item.end_time ? item.end_time.slice(0, 16) : '', status: item.status }); setEditing(true); setSelected(item); setShowForm(true); }} style={{ marginRight: 6 }}>Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(item.id)}>Del</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {pagination && <Pagination page={page} totalPages={pagination.totalPages} onPageChange={setPage} />}

      {showForm && (
        <Modal title={editing ? 'Edit Shift' : 'New Shift'} onClose={() => { setShowForm(false); setEditing(false); }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group"><label>Volunteer ID</label><input className="form-control" type="number" value={form.volunteer_id} onChange={e => setForm({ ...form, volunteer_id: e.target.value })} /></div>
            <div className="form-group"><label>Program ID</label><input className="form-control" type="number" value={form.program_id} onChange={e => setForm({ ...form, program_id: e.target.value })} /></div>
            <div className="form-group"><label>Start Time</label><input className="form-control" type="datetime-local" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} /></div>
            <div className="form-group"><label>End Time</label><input className="form-control" type="datetime-local" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} /></div>
            <div className="form-group"><label>Location</label><input className="form-control" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
            <div className="form-group"><label>Status</label>
              <select className="form-control" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="scheduled">Scheduled</option><option value="in_progress">In Progress</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
              </select>
            </div>
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
