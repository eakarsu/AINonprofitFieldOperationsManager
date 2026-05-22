import React, { useEffect, useState } from 'react';
import api from '../api';

const EMPTY = { program_id: '', rule_name: '', rule_type: 'eligibility', condition: '', threshold: '', active: true, notes: '' };

export default function ProgramRulesEditor() {
  const [rules, setRules] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [rRes, pRes] = await Promise.all([
        api.get('/custom-views/program-rules'),
        api.get('/programs?limit=100'),
      ]);
      setRules(rRes.data.data || []);
      setPrograms(pRes.data.data || []);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const payload = {
      ...form,
      program_id: form.program_id ? parseInt(form.program_id) : null,
      threshold: form.threshold === '' ? null : parseFloat(form.threshold),
    };
    try {
      if (editingId) {
        await api.put(`/custom-views/program-rules/${editingId}`, payload);
      } else {
        await api.post('/custom-views/program-rules', payload);
      }
      setForm(EMPTY);
      setEditingId(null);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (r) => {
    setEditingId(r.id);
    setForm({
      program_id: r.program_id || '',
      rule_name: r.rule_name || '',
      rule_type: r.rule_type || 'eligibility',
      condition: r.condition || '',
      threshold: r.threshold ?? '',
      active: r.active !== false,
      notes: r.notes || '',
    });
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this rule?')) return;
    try { await api.delete(`/custom-views/program-rules/${id}`); await load(); }
    catch (e) { setError(e.response?.data?.error || e.message); }
  };

  const inputStyle = { width: '100%', padding: 8, background: '#1f2937', color: '#e5e7eb', border: '1px solid #374151', borderRadius: 4, fontSize: 13 };

  return (
    <div style={{ background: '#111827', padding: 16, borderRadius: 8, color: '#e5e7eb' }}>
      <h3 style={{ marginTop: 0, marginBottom: 12 }}>Program Rules Editor (Eligibility CRUD)</h3>
      {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 8 }}>Error: {error}</div>}

      <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 16 }}>
        <select value={form.program_id} onChange={e => setForm({ ...form, program_id: e.target.value })} style={inputStyle}>
          <option value="">(no program)</option>
          {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input placeholder="Rule name" value={form.rule_name}
               onChange={e => setForm({ ...form, rule_name: e.target.value })} required style={inputStyle} />
        <select value={form.rule_type} onChange={e => setForm({ ...form, rule_type: e.target.value })} style={inputStyle}>
          <option value="eligibility">eligibility</option>
          <option value="income">income</option>
          <option value="age">age</option>
          <option value="geography">geography</option>
          <option value="other">other</option>
        </select>
        <input placeholder="Threshold (number)" type="number" step="0.01" value={form.threshold}
               onChange={e => setForm({ ...form, threshold: e.target.value })} style={inputStyle} />
        <input placeholder="Condition (e.g. income <= threshold)" value={form.condition}
               onChange={e => setForm({ ...form, condition: e.target.value })} style={{ ...inputStyle, gridColumn: 'span 2' }} />
        <textarea placeholder="Notes" value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  rows={2} style={{ ...inputStyle, gridColumn: 'span 2', fontFamily: 'inherit' }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> Active
        </label>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {editingId && (
            <button type="button" onClick={() => { setEditingId(null); setForm(EMPTY); }}
                    style={{ padding: '8px 14px', background: '#374151', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
              Cancel
            </button>
          )}
          <button type="submit" disabled={busy}
                  style={{ padding: '8px 18px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, cursor: busy ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
            {editingId ? 'Update' : 'Add'} Rule
          </button>
        </div>
      </form>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #374151', color: '#9ca3af' }}>
            <th style={{ textAlign: 'left', padding: 6 }}>Program</th>
            <th style={{ textAlign: 'left', padding: 6 }}>Rule</th>
            <th style={{ textAlign: 'left', padding: 6 }}>Type</th>
            <th style={{ textAlign: 'left', padding: 6 }}>Threshold</th>
            <th style={{ textAlign: 'left', padding: 6 }}>Active</th>
            <th style={{ padding: 6 }}></th>
          </tr>
        </thead>
        <tbody>
          {rules.length === 0 && (
            <tr><td colSpan={6} style={{ padding: 10, color: '#6b7280' }}>No rules yet.</td></tr>
          )}
          {rules.map(r => (
            <tr key={r.id} style={{ borderBottom: '1px solid #1f2937' }}>
              <td style={{ padding: 6 }}>{r.program_name || '-'}</td>
              <td style={{ padding: 6 }}>{r.rule_name}</td>
              <td style={{ padding: 6 }}>{r.rule_type}</td>
              <td style={{ padding: 6 }}>{r.threshold ?? '-'}</td>
              <td style={{ padding: 6 }}>{r.active ? 'Yes' : 'No'}</td>
              <td style={{ padding: 6, textAlign: 'right', whiteSpace: 'nowrap' }}>
                <button onClick={() => startEdit(r)}
                        style={{ padding: '4px 10px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', marginRight: 6 }}>
                  Edit
                </button>
                <button onClick={() => remove(r.id)}
                        style={{ padding: '4px 10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
