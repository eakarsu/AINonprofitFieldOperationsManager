import React, { useEffect, useState } from 'react';
import api from '../api';

export default function ProgramImpactChart() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/custom-views/program-impact')
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ color: '#9ca3af' }}>Loading program impact…</div>;
  if (error) return <div style={{ color: '#ef4444' }}>Error: {error}</div>;
  if (!data || !data.data || data.data.length === 0) {
    return (
      <div style={{ background: '#111827', padding: 16, borderRadius: 8, color: '#9ca3af' }}>
        No programs yet. Create programs to see impact metrics.
      </div>
    );
  }

  const max = Math.max(1, ...data.data.map(r => r.impact_score));

  return (
    <div style={{ background: '#111827', padding: 16, borderRadius: 8 }}>
      <h3 style={{ color: '#e5e7eb', marginTop: 0, marginBottom: 12 }}>Program Impact Chart</h3>
      <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 12 }}>
        {data.summary.total_programs} programs · {data.summary.total_cases} cases · {data.summary.total_shift_hours}h · {data.summary.total_volunteers} volunteers
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.data.map(row => {
          const pct = (row.impact_score / max) * 100;
          return (
            <div key={row.program_id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e5e7eb', fontSize: 13, marginBottom: 4 }}>
                <span>{row.program_name}</span>
                <span style={{ color: '#9ca3af' }}>
                  {row.cases_served} cases · {row.shift_hours}h · score {row.impact_score}
                </span>
              </div>
              <div style={{ background: '#1f2937', height: 18, borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #10b981, #6366f1)',
                  transition: 'width 0.4s',
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
