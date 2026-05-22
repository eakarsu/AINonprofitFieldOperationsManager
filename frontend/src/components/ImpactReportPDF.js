import React, { useEffect, useState } from 'react';
import api from '../api';

export default function ImpactReportPDF() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/custom-views/impact-report.pdf?format=json')
      .then(r => setSummary(r.data))
      .catch(e => setError(e.response?.data?.error || e.message));
  }, []);

  const download = async () => {
    setBusy(true);
    try {
      const res = await api.get('/custom-views/impact-report.pdf', { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'impact-report.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ background: '#111827', padding: 16, borderRadius: 8, color: '#e5e7eb' }}>
      <h3 style={{ marginTop: 0, marginBottom: 12 }}>Impact / Donor Report (PDF)</h3>
      {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 8 }}>Error: {error}</div>}
      {summary && (
        <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 12 }}>
          <div>Programs: <span style={{ color: '#e5e7eb' }}>{summary.summary.programs}</span></div>
          <div>Cases: <span style={{ color: '#e5e7eb' }}>{summary.summary.cases}</span></div>
          <div>Donations: <span style={{ color: '#e5e7eb' }}>{summary.summary.donations}</span> ({summary.summary.donation_lbs} lbs)</div>
          <div>Volunteers: <span style={{ color: '#e5e7eb' }}>{summary.summary.volunteers}</span></div>
          {summary.top_programs?.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <strong style={{ color: '#e5e7eb' }}>Top programs:</strong>
              <ul style={{ marginTop: 4, paddingLeft: 20 }}>
                {summary.top_programs.slice(0, 3).map((p, i) => (
                  <li key={i}>{p.name} — {p.cases_n} cases</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <button onClick={download} disabled={busy}
              style={{ padding: '8px 18px', background: '#6366f1', color: '#fff', border: 'none',
                       borderRadius: 6, cursor: busy ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
        {busy ? 'Generating…' : 'Download PDF'}
      </button>
    </div>
  );
}
