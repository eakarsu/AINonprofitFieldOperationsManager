import React, { useState, useEffect } from 'react';
import { programsApi, casesApi, extractData } from '../api';

export default function ImpactMetricsPage({ showToast }) {
  const [programs, setPrograms] = useState([]);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      programsApi.getAll(1, 100),
      casesApi.getAll(1, 200)
    ]).then(([prog, cas]) => {
      setPrograms(extractData(prog));
      setCases(extractData(cas));
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Loading impact metrics...</div>;

  const totalCases = cases.length;
  const closedCases = cases.filter(c => c.status === 'closed' || c.status === 'referred').length;
  const openCases = cases.filter(c => c.status === 'open').length;
  const highUrgency = cases.filter(c => c.urgency_score >= 8).length;
  const successRate = totalCases > 0 ? ((closedCases / totalCases) * 100).toFixed(1) : 0;

  const casesByProgram = {};
  cases.forEach(c => {
    const pid = c.program_id || 'unassigned';
    casesByProgram[pid] = (casesByProgram[pid] || 0) + 1;
  });

  const needsFreq = {};
  cases.forEach(c => {
    const needs = Array.isArray(c.needs) ? c.needs : (c.needs ? [c.needs] : []);
    needs.forEach(n => {
      if (n) needsFreq[n.toLowerCase().trim()] = (needsFreq[n.toLowerCase().trim()] || 0) + 1;
    });
  });
  const topNeeds = Object.entries(needsFreq).sort(([,a], [,b]) => b - a).slice(0, 8);

  const barMax = Math.max(...topNeeds.map(([,v]) => v), 1);

  return (
    <div>
      <div className="page-header">
        <div><h2>Impact Metrics</h2><p className="subtitle">Program outcomes and impact measurement</p></div>
      </div>

      <div className="stats-row">
        <div className="stat-box"><div className="stat-number">{totalCases}</div><div className="stat-label">Total Cases</div></div>
        <div className="stat-box"><div className="stat-number" style={{ color: '#10b981' }}>{closedCases}</div><div className="stat-label">Resolved</div></div>
        <div className="stat-box"><div className="stat-number" style={{ color: '#f59e0b' }}>{openCases}</div><div className="stat-label">Active</div></div>
        <div className="stat-box"><div className="stat-number" style={{ color: '#6366f1' }}>{successRate}%</div><div className="stat-label">Resolution Rate</div></div>
        <div className="stat-box"><div className="stat-number" style={{ color: '#ef4444' }}>{highUrgency}</div><div className="stat-label">High Urgency</div></div>
        <div className="stat-box"><div className="stat-number">{programs.length}</div><div className="stat-label">Programs</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 8 }}>
        <div style={{ background: '#1a1d2e', border: '1px solid #2d3048', borderRadius: 10, padding: 20 }}>
          <h3 style={{ color: '#e2e8f0', fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Top Client Needs</h3>
          {topNeeds.length > 0 ? topNeeds.map(([need, count]) => (
            <div key={need} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: '#e2e8f0', textTransform: 'capitalize' }}>{need}</span>
                <span style={{ fontSize: 12, color: '#6b7280' }}>{count} cases</span>
              </div>
              <div style={{ height: 8, background: '#2d3048', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(count / barMax) * 100}%`, background: '#6366f1', borderRadius: 4, transition: 'width 0.3s' }} />
              </div>
            </div>
          )) : <p style={{ color: '#6b7280', fontSize: 13 }}>No need data recorded yet.</p>}
        </div>

        <div style={{ background: '#1a1d2e', border: '1px solid #2d3048', borderRadius: 10, padding: 20 }}>
          <h3 style={{ color: '#e2e8f0', fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Cases by Program</h3>
          {Object.keys(casesByProgram).length > 0 ? Object.entries(casesByProgram).sort(([,a], [,b]) => b - a).map(([pid, count]) => {
            const prog = programs.find(p => String(p.id) === String(pid));
            const maxCount = Math.max(...Object.values(casesByProgram));
            return (
              <div key={pid} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: '#e2e8f0' }}>{prog?.name || (pid === 'unassigned' ? 'Unassigned' : `Program #${pid}`)}</span>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>{count} cases</span>
                </div>
                <div style={{ height: 8, background: '#2d3048', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(count / maxCount) * 100}%`, background: '#10b981', borderRadius: 4 }} />
                </div>
              </div>
            );
          }) : <p style={{ color: '#6b7280', fontSize: 13 }}>No cases recorded yet.</p>}
        </div>
      </div>

      <div style={{ background: '#1a1d2e', border: '1px solid #2d3048', borderRadius: 10, padding: 20, marginTop: 20 }}>
        <h3 style={{ color: '#e2e8f0', fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Programs Overview</h3>
        {programs.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2d3048' }}>
                {['Program', 'Status', 'Location', 'Capacity', 'Cases'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {programs.map(prog => (
                <tr key={prog.id} style={{ borderBottom: '1px solid #1a1d2e' }}>
                  <td style={{ padding: '10px 12px', color: '#e2e8f0', fontWeight: 600 }}>{prog.name}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: prog.status === 'active' ? '#10b98120' : '#6b728020', color: prog.status === 'active' ? '#10b981' : '#6b7280' }}>{prog.status}</span>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#9ca3af' }}>{prog.location || '-'}</td>
                  <td style={{ padding: '10px 12px', color: '#9ca3af' }}>{prog.capacity || '-'}</td>
                  <td style={{ padding: '10px 12px', color: '#6366f1', fontWeight: 600 }}>{casesByProgram[String(prog.id)] || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p style={{ color: '#6b7280' }}>No programs yet.</p>}
      </div>
    </div>
  );
}
