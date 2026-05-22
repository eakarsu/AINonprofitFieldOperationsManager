import React, { useEffect, useState } from 'react';
import api from '../api';

export default function VolunteerHeatmap() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/custom-views/volunteer-heatmap')
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ color: '#9ca3af' }}>Loading heatmap…</div>;
  if (error) return <div style={{ color: '#ef4444' }}>Error: {error}</div>;
  if (!data || !data.matrix || data.matrix.length === 0) {
    return (
      <div style={{ background: '#111827', padding: 16, borderRadius: 8, color: '#9ca3af' }}>
        No volunteer activity yet.
      </div>
    );
  }

  const max = Math.max(1, data.max_shift_count || 1);
  const color = (n) => {
    if (n === 0) return '#1f2937';
    const t = Math.min(1, n / max);
    const r = Math.round(16 + (99 - 16) * t);
    const g = Math.round(185 + (102 - 185) * t);
    const b = Math.round(129 + (241 - 129) * t);
    return `rgb(${r},${g},${b})`;
  };

  return (
    <div style={{ background: '#111827', padding: 16, borderRadius: 8, overflow: 'auto' }}>
      <h3 style={{ color: '#e5e7eb', marginTop: 0, marginBottom: 12 }}>Volunteer Activity Heatmap</h3>
      <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 8 }}>
        Volunteers ({data.volunteers.length}) × Programs ({data.programs.length}). Max shifts/cell: {max}.
      </div>
      <table style={{ borderCollapse: 'collapse', color: '#e5e7eb', fontSize: 11 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: 4, position: 'sticky', left: 0, background: '#111827' }}>Volunteer</th>
            {data.programs.map(p => (
              <th key={p.id} style={{ padding: 4, fontWeight: 500, whiteSpace: 'nowrap', writingMode: 'vertical-rl', transform: 'rotate(180deg)', minWidth: 28 }}>
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.matrix.map(row => (
            <tr key={row.volunteer_id}>
              <td style={{ padding: 4, whiteSpace: 'nowrap', position: 'sticky', left: 0, background: '#111827' }}>
                {row.volunteer_name}
              </td>
              {row.cells.map(c => (
                <td key={c.program_id}
                    title={`${row.volunteer_name} × ${c.program_name}: ${c.shift_count} shifts (${c.hours}h)`}
                    style={{ padding: 0 }}>
                  <div style={{
                    width: 26, height: 26, background: color(c.shift_count),
                    border: '1px solid #0f111a',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, color: c.shift_count > 0 ? '#fff' : '#374151',
                  }}>
                    {c.shift_count || ''}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
