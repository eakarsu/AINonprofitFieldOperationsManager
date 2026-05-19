import React, { useState } from 'react';
import { aiApi } from '../api';

const TOOLS = [
  { id: 'triage', label: 'Case Triage' },
  { id: 'dispatch', label: 'Volunteer Dispatch' },
  { id: 'grant', label: 'Grant Report' },
  { id: 'impact', label: 'Impact Report' },
  { id: 'needs', label: 'Beneficiary Needs' },
  { id: 'resource', label: 'Resource Allocation' },
  { id: 'history', label: 'AI History' },
];

export default function AIPage({ showToast }) {
  const [activeTool, setActiveTool] = useState('triage');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const [triageForm, setTriageForm] = useState({ client_name: '', needs: '', urgency_score: 5, demographics: '' });
  const [dispatchForm, setDispatchForm] = useState({ shift_requirements: '' });
  const [grantForm, setGrantForm] = useState({ grant_name: '', reporting_period: '', program_id: '' });
  const [impactForm, setImpactForm] = useState({ program_name: '', period: '', beneficiaries_served: '', outcomes: '' });
  const [needsForm, setNeedsForm] = useState({ beneficiary_name: '', demographics: '', current_situation: '', location: '' });
  const [resourceForm, setResourceForm] = useState({ program_id: '', constraints: '', priority_areas: '' });

  const [history, setHistory] = useState([]);
  const [histPage, setHistPage] = useState(1);
  const [histLoading, setHistLoading] = useState(false);
  const [histTotal, setHistTotal] = useState(0);

  const run = async (apiCall, data) => {
    setLoading(true); setResult(null);
    try {
      const r = await apiCall(data);
      setResult(r.result || r);
      showToast('AI analysis complete');
    } catch (e) { showToast(e.response?.data?.error || e.message, 'error'); }
    setLoading(false);
  };

  const loadHistory = async () => {
    setHistLoading(true);
    try {
      const r = await aiApi.getHistory(histPage, 20);
      setHistory(r.data || []);
      setHistTotal(r.pagination?.total || 0);
    } catch {}
    setHistLoading(false);
  };

  React.useEffect(() => {
    if (activeTool === 'history') loadHistory();
  }, [activeTool, histPage]);

  const renderResult = (r) => {
    if (!r) return null;
    if (typeof r === 'string') return (
      <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 16, marginTop: 16, fontSize: 13, color: '#e2e8f0', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{r}</div>
    );
    return (
      <pre style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 16, marginTop: 16, fontSize: 12, color: '#94a3b8', overflow: 'auto', maxHeight: 400 }}>
        {JSON.stringify(r, null, 2)}
      </pre>
    );
  };

  return (
    <div>
      <div className="page-header">
        <div><h2>AI Tools</h2><p className="subtitle">AI-powered nonprofit operations assistance</p></div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {TOOLS.map(tool => (
          <button key={tool.id} onClick={() => { setActiveTool(tool.id); setResult(null); }}
            className={`btn ${activeTool === tool.id ? 'btn-ai' : 'btn-secondary'}`}>
            {tool.label}
          </button>
        ))}
      </div>

      {activeTool === 'triage' && (
        <div style={{ background: '#1a1d2e', border: '1px solid #2d3048', borderRadius: 10, padding: 24 }}>
          <h3 style={{ color: '#e2e8f0', marginBottom: 16 }}>Case Triage & Routing</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group"><label>Client Name</label><input className="form-control" value={triageForm.client_name} onChange={e => setTriageForm({ ...triageForm, client_name: e.target.value })} /></div>
            <div className="form-group"><label>Urgency Score (1-10)</label><input className="form-control" type="number" min="1" max="10" value={triageForm.urgency_score} onChange={e => setTriageForm({ ...triageForm, urgency_score: parseInt(e.target.value) })} /></div>
          </div>
          <div className="form-group"><label>Needs (comma-separated)</label><textarea className="form-control" value={triageForm.needs} onChange={e => setTriageForm({ ...triageForm, needs: e.target.value })} rows={2} placeholder="food, shelter, medical assistance..." /></div>
          <div className="form-group"><label>Demographics / Context</label><textarea className="form-control" value={triageForm.demographics} onChange={e => setTriageForm({ ...triageForm, demographics: e.target.value })} rows={2} /></div>
          <button className="btn btn-ai" disabled={loading} onClick={() => run(aiApi.triageCase, { ...triageForm, needs: triageForm.needs.split(',').map(s => s.trim()) })}>
            {loading ? 'Triaging...' : 'Run AI Triage'}
          </button>
          {renderResult(result)}
        </div>
      )}

      {activeTool === 'dispatch' && (
        <div style={{ background: '#1a1d2e', border: '1px solid #2d3048', borderRadius: 10, padding: 24 }}>
          <h3 style={{ color: '#e2e8f0', marginBottom: 16 }}>Volunteer Dispatch Optimizer</h3>
          <div className="form-group"><label>Shift Requirements</label>
            <textarea className="form-control" value={dispatchForm.shift_requirements} onChange={e => setDispatchForm({ shift_requirements: e.target.value })} rows={4} placeholder='{"location": "Downtown shelter", "skills_needed": ["first aid", "bilingual"], "start_time": "2025-06-01T09:00:00", "duration_hours": 4}' />
          </div>
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>AI will match requirements against all active volunteers in the database.</p>
          <button className="btn btn-ai" disabled={loading} onClick={() => {
            let reqs = dispatchForm.shift_requirements;
            try { reqs = JSON.parse(reqs); } catch {}
            run(aiApi.dispatchVolunteer, { shift_requirements: reqs });
          }}>
            {loading ? 'Matching...' : 'Find Best Volunteers'}
          </button>
          {renderResult(result)}
        </div>
      )}

      {activeTool === 'grant' && (
        <div style={{ background: '#1a1d2e', border: '1px solid #2d3048', borderRadius: 10, padding: 24 }}>
          <h3 style={{ color: '#e2e8f0', marginBottom: 16 }}>Grant Report Generator</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group"><label>Grant Name</label><input className="form-control" value={grantForm.grant_name} onChange={e => setGrantForm({ ...grantForm, grant_name: e.target.value })} placeholder="Community Foundation Grant" /></div>
            <div className="form-group"><label>Reporting Period</label><input className="form-control" value={grantForm.reporting_period} onChange={e => setGrantForm({ ...grantForm, reporting_period: e.target.value })} placeholder="Q1 2025" /></div>
            <div className="form-group"><label>Program ID (optional)</label><input className="form-control" type="number" value={grantForm.program_id} onChange={e => setGrantForm({ ...grantForm, program_id: e.target.value })} /></div>
          </div>
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>AI will pull real stats from your database to generate the report.</p>
          <button className="btn btn-ai" disabled={loading} onClick={() => run(aiApi.grantReport, grantForm)}>
            {loading ? 'Drafting...' : 'Generate Grant Report'}
          </button>
          {result && typeof result === 'object' && result.report && (
            <div style={{ marginTop: 16 }}>
              {result.stats && (
                <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                  <div style={{ background: 'rgba(16,185,129,0.1)', borderRadius: 8, padding: '10px 14px', flex: 1 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#10b981' }}>{result.stats.cases_served}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>Cases Served</div>
                  </div>
                  <div style={{ background: 'rgba(99,102,241,0.1)', borderRadius: 8, padding: '10px 14px', flex: 1 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#6366f1' }}>{result.stats.volunteer_hours}h</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>Volunteer Hours</div>
                  </div>
                </div>
              )}
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 16, fontSize: 13, color: '#e2e8f0', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                {result.report}
              </div>
            </div>
          )}
          {result && (typeof result === 'string' || !result.report) && renderResult(result)}
        </div>
      )}

      {activeTool === 'impact' && (
        <div style={{ background: '#1a1d2e', border: '1px solid #2d3048', borderRadius: 10, padding: 24 }}>
          <h3 style={{ color: '#e2e8f0', marginBottom: 16 }}>Impact Report Generator</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group"><label>Program Name</label><input className="form-control" value={impactForm.program_name} onChange={e => setImpactForm({ ...impactForm, program_name: e.target.value })} /></div>
            <div className="form-group"><label>Period</label><input className="form-control" value={impactForm.period} onChange={e => setImpactForm({ ...impactForm, period: e.target.value })} placeholder="Jan-June 2025" /></div>
            <div className="form-group"><label>Beneficiaries Served</label><input className="form-control" type="number" value={impactForm.beneficiaries_served} onChange={e => setImpactForm({ ...impactForm, beneficiaries_served: e.target.value })} /></div>
          </div>
          <div className="form-group"><label>Key Outcomes (describe results)</label><textarea className="form-control" value={impactForm.outcomes} onChange={e => setImpactForm({ ...impactForm, outcomes: e.target.value })} rows={4} placeholder="e.g., 85% of clients found stable housing, 120 families received food assistance..." /></div>
          <button className="btn btn-ai" disabled={loading} onClick={() => run(aiApi.impactReport, impactForm)}>
            {loading ? 'Generating...' : 'Generate Impact Report'}
          </button>
          {renderResult(result)}
        </div>
      )}

      {activeTool === 'needs' && (
        <div style={{ background: '#1a1d2e', border: '1px solid #2d3048', borderRadius: 10, padding: 24 }}>
          <h3 style={{ color: '#e2e8f0', marginBottom: 16 }}>Beneficiary Needs Assessor</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group"><label>Beneficiary Name</label><input className="form-control" value={needsForm.beneficiary_name} onChange={e => setNeedsForm({ ...needsForm, beneficiary_name: e.target.value })} /></div>
            <div className="form-group"><label>Location</label><input className="form-control" value={needsForm.location} onChange={e => setNeedsForm({ ...needsForm, location: e.target.value })} /></div>
          </div>
          <div className="form-group"><label>Demographics</label><textarea className="form-control" value={needsForm.demographics} onChange={e => setNeedsForm({ ...needsForm, demographics: e.target.value })} rows={2} placeholder="Age, family size, employment status..." /></div>
          <div className="form-group"><label>Current Situation</label><textarea className="form-control" value={needsForm.current_situation} onChange={e => setNeedsForm({ ...needsForm, current_situation: e.target.value })} rows={3} placeholder="Describe what you know about their situation..." /></div>
          <button className="btn btn-ai" disabled={loading} onClick={() => run(aiApi.triageCase, { client_name: needsForm.beneficiary_name, demographics: needsForm.demographics, needs: needsForm.current_situation, urgency_score: 5 })}>
            {loading ? 'Assessing...' : 'Assess Needs'}
          </button>
          {renderResult(result)}
        </div>
      )}

      {activeTool === 'resource' && (
        <div style={{ background: '#1a1d2e', border: '1px solid #2d3048', borderRadius: 10, padding: 24 }}>
          <h3 style={{ color: '#e2e8f0', marginBottom: 16 }}>Resource Allocation Optimizer</h3>
          <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>AI will analyze your inventory and shift data to optimize resource allocation.</p>
          <div className="form-group"><label>Program ID (leave blank for all)</label><input className="form-control" type="number" value={resourceForm.program_id} onChange={e => setResourceForm({ ...resourceForm, program_id: e.target.value })} /></div>
          <div className="form-group"><label>Constraints</label><textarea className="form-control" value={resourceForm.constraints} onChange={e => setResourceForm({ ...resourceForm, constraints: e.target.value })} rows={2} placeholder="Budget limit $5000, 3 available vans, 12 volunteers..." /></div>
          <div className="form-group"><label>Priority Areas</label><textarea className="form-control" value={resourceForm.priority_areas} onChange={e => setResourceForm({ ...resourceForm, priority_areas: e.target.value })} rows={2} placeholder="Focus on housing, medical care, children..." /></div>
          <button className="btn btn-ai" disabled={loading} onClick={() => run(aiApi.inventoryRestock, { ...resourceForm })}>
            {loading ? 'Optimizing...' : 'Optimize Resources'}
          </button>
          {renderResult(result)}
        </div>
      )}

      {activeTool === 'history' && (
        <div style={{ background: '#1a1d2e', border: '1px solid #2d3048', borderRadius: 10, padding: 24 }}>
          <h3 style={{ color: '#e2e8f0', marginBottom: 16 }}>AI Analysis History</h3>
          {histLoading && <p style={{ color: '#6b7280' }}>Loading...</p>}
          {history.map(item => (
            <div key={item.id} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '12px 16px', marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontWeight: 700, color: '#a855f7', fontSize: 13 }}>{item.endpoint}</span>
                <span style={{ fontSize: 11, color: '#6b7280' }}>{new Date(item.created_at).toLocaleString()}</span>
              </div>
              <pre style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'pre-wrap', maxHeight: 120, overflow: 'auto', margin: 0 }}>
                {typeof item.result === 'string' ? item.result : JSON.stringify(item.result, null, 2)}
              </pre>
            </div>
          ))}
          {history.length === 0 && !histLoading && <p style={{ color: '#6b7280', textAlign: 'center', padding: 24 }}>No AI analyses yet.</p>}
          {histTotal > 20 && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
              <button className="btn btn-secondary btn-sm" disabled={histPage === 1} onClick={() => setHistPage(p => p - 1)}>Prev</button>
              <span style={{ color: '#6b7280', fontSize: 13, padding: '4px 8px' }}>Page {histPage}</span>
              <button className="btn btn-secondary btn-sm" onClick={() => setHistPage(p => p + 1)}>Next</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
