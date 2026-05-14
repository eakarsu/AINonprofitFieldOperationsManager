import React, { useState, useEffect } from 'react';
import { inventoryApi, aiApi, extractData } from '../api';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';

const empty = { item_name: '', category: '', quantity: 0, unit: 'items', location: '', min_threshold: 5 };

export default function InventoryPage({ showToast }) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(false);
  const [restockResult, setRestockResult] = useState(null);
  const [restockLoading, setRestockLoading] = useState(false);

  useEffect(() => { load(); }, [page]);

  const load = async () => {
    try {
      const r = await inventoryApi.getAll(page, 20);
      setItems(extractData(r));
      if (r.pagination) setPagination(r.pagination);
    } catch (e) { console.error(e); }
  };

  const handleSave = async () => {
    try {
      if (editing) { await inventoryApi.update(selected.id, form); showToast('Item updated'); }
      else { await inventoryApi.create(form); showToast('Item added'); }
      setShowForm(false); setForm(empty); setEditing(false); setSelected(null); load();
    } catch (e) { showToast(e.response?.data?.error || e.message, 'error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this item?')) return;
    try { await inventoryApi.delete(id); showToast('Deleted'); setSelected(null); load(); }
    catch (e) { showToast(e.message, 'error'); }
  };

  const handleRestock = async () => {
    setRestockLoading(true); setRestockResult(null);
    try {
      const r = await aiApi.inventoryRestock({});
      setRestockResult(r.result);
      showToast('AI restock plan generated');
    } catch (e) { showToast(e.response?.data?.error || e.message, 'error'); }
    setRestockLoading(false);
  };

  const isLow = (item) => item.quantity <= item.min_threshold;

  return (
    <div>
      <div className="page-header">
        <div><h2>Inventory</h2><p className="subtitle">Track supplies and resources</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ai" onClick={handleRestock} disabled={restockLoading}>{restockLoading ? 'Generating...' : 'AI Restock Plan'}</button>
          <button className="btn btn-primary" onClick={() => { setForm(empty); setEditing(false); setShowForm(true); }}>+ Add Item</button>
        </div>
      </div>

      {restockResult && (
        <div style={{ background: '#1a1d2e', border: '1px solid #a855f7', borderRadius: 10, padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ color: '#a855f7' }}>AI Restock Plan</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => setRestockResult(null)}>x</button>
          </div>
          {restockResult.wish_list?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>Items Needed</div>
              {restockResult.wish_list.map((item, i) => (
                <div key={i} style={{ background: 'rgba(168,85,247,0.08)', borderRadius: 7, padding: '8px 12px', marginBottom: 6, borderLeft: '3px solid #a855f7' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong style={{ color: '#e2e8f0', fontSize: 13 }}>{item.item_name}</strong>
                    <span style={{ fontSize: 11, fontWeight: 700, color: item.urgency === 'critical' ? '#ef4444' : '#f59e0b' }}>{item.urgency}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>Current: {item.current_quantity} | Need: {item.needed_quantity} {item.use_case ? `| ${item.use_case}` : ''}</div>
                </div>
              ))}
            </div>
          )}
          {restockResult.donor_appeal && (
            <div style={{ background: 'rgba(16,185,129,0.08)', borderRadius: 7, padding: 12, borderLeft: '3px solid #10b981' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#10b981', marginBottom: 4 }}>Donor Appeal Draft</div>
              <div style={{ fontSize: 12, color: '#9ca3af', whiteSpace: 'pre-wrap' }}>{restockResult.donor_appeal}</div>
            </div>
          )}
        </div>
      )}

      <div className="stats-row">
        <div className="stat-box"><div className="stat-number">{pagination ? pagination.total : items.length}</div><div className="stat-label">Total Items</div></div>
        <div className="stat-box"><div className="stat-number" style={{ color: '#ef4444' }}>{items.filter(isLow).length}</div><div className="stat-label">Low Stock</div></div>
        <div className="stat-box"><div className="stat-number" style={{ color: '#10b981' }}>{items.filter(i => !isLow(i)).length}</div><div className="stat-label">Adequate Stock</div></div>
      </div>

      <div className="card-grid">
        {items.map(item => (
          <div key={item.id} className="card" onClick={() => setSelected(item)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="card-title">{item.item_name}</div>
              {isLow(item) && <span className="badge badge-severe">Low</span>}
            </div>
            <div className="card-meta"><span style={{ fontSize: 12, color: '#6b7280' }}>{item.category}</span></div>
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: isLow(item) ? '#ef4444' : '#10b981' }}>{item.quantity}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{item.unit} (min: {item.min_threshold})</div>
            </div>
            {item.location && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>@ {item.location}</div>}
          </div>
        ))}
      </div>
      {pagination && <Pagination page={page} totalPages={pagination.totalPages} onPageChange={setPage} />}

      {selected && !showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div className="modal">
            <div className="modal-header"><h2>{selected.item_name}</h2><button className="close-btn" onClick={() => setSelected(null)}>x</button></div>
            <div className="modal-body">
              {[['Category', selected.category], ['Quantity', `${selected.quantity} ${selected.unit}`], ['Min Threshold', selected.min_threshold], ['Location', selected.location]].filter(([,v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => (
                <div key={k} style={{ marginBottom: 10 }}><div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', fontWeight: 700 }}>{k}</div><div style={{ color: '#e2e8f0', fontWeight: 600 }}>{v}</div></div>
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
        <Modal title={editing ? 'Edit Item' : 'Add Item'} onClose={() => { setShowForm(false); setEditing(false); }}>
          <div className="form-group"><label>Item Name *</label><input className="form-control" value={form.item_name} onChange={e => setForm({ ...form, item_name: e.target.value })} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group"><label>Category</label>
              <select className="form-control" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                <option value="">Select...</option>
                {['Food', 'Clothing', 'Hygiene', 'Medical', 'Office', 'Equipment', 'Cleaning', 'Other'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Unit</label><input className="form-control" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="items, boxes, lbs..." /></div>
            <div className="form-group"><label>Quantity</label><input className="form-control" type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })} /></div>
            <div className="form-group"><label>Min Threshold</label><input className="form-control" type="number" value={form.min_threshold} onChange={e => setForm({ ...form, min_threshold: parseInt(e.target.value) || 0 })} /></div>
          </div>
          <div className="form-group"><label>Location</label><input className="form-control" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Storage room, shelf A2..." /></div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => { setShowForm(false); setEditing(false); }}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave}>{editing ? 'Update' : 'Add'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
