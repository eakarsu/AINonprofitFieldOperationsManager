import AIFieldPresets, { completeExample } from './AIFieldPresets';
import AIResultView from './AIResultView';
import useCancelableAI from './useCancelableAI';
import React, { useState } from 'react';
import { aiApi } from '../api';
import useNonprofitSources from '../components/useNonprofitSources';

const dispatchExamples = ['Shelter shift','Community meal shift','Supply handoff shift'].map((label,index)=>({label,values:{shift_requirements:JSON.stringify({location:['Example shelter','Example community kitchen','Example distribution desk'][index],skills_needed:[['first aid','bilingual'],['food preparation','coordination'],['inventory','delivery planning']][index],start_time:['2026-11-05T09:00:00','2026-11-12T12:00:00','2026-11-19T15:00:00'][index],duration_hours:[4,3,2][index]},null,2)}}));
const dispatchField = {key:'shift_requirements',type:'json',shape:{location:'',skills_needed:[''],start_time:'',duration_hours:4}};

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
  const sources = useNonprofitSources(true), programs = sources.programs;
  const programReference = { key: 'program_id', type: 'select', requiresExistingRecord: true, options: programs.map(row => ({ value: String(row.id), label: row.name || String(row.id) })) };
  const volunteerReference = { key: 'volunteer_id', type: 'select', requiresExistingRecord: true, options: sources.volunteers.map(row => ({ value: String(row.id), label: row.name || String(row.id) })) };
  const programError = sources.error, programLoading = sources.loading;
  const aiRequest = useCancelableAI();
  const { loading, result, setResult: setResult, error } = aiRequest;


  const [triageForm, setTriageForm] = useState({ client_name: '', needs: '', urgency_score: 5, demographics: '', case_id: '' });
  const [dispatchForm, setDispatchForm] = useState({ shift_requirements: '', volunteer_id: '' });
  const [grantForm, setGrantForm] = useState({ grant_name: '', reporting_period: '', program_id: '' });
  const [impactForm, setImpactForm] = useState({ program_id: '', program_name: '', period: '', beneficiaries_served: '', outcomes: '' });
  const [needsForm, setNeedsForm] = useState({ beneficiary_name: '', demographics: '', current_situation: '', location: '', case_id: '' });
  const [resourceForm, setResourceForm] = useState({ program_id: '', constraints: '', priority_areas: '' });

  const [history, setHistory] = useState([]);
  const [histPage, setHistPage] = useState(1);
  const [histLoading, setHistLoading] = useState(false);
  const [histTotal, setHistTotal] = useState(0), [histError, setHistError] = useState('');

  const sourceBinding = ['dispatch', 'grant', 'impact', 'resource'].includes(activeTool) || activeTool === 'triage' && triageForm.case_id || activeTool === 'needs' && needsForm.case_id;
  const referencesBlocked = Boolean(sourceBinding && (sources.loading || sources.error));
  const run = async (apiCall, data) => { if (referencesBlocked) return; const response = await aiRequest.run((options) => apiCall(data, options)); if (response !== undefined) showToast('AI analysis complete'); return response; };

  const loadHistory = async () => {
    setHistLoading(true); setHistError('');
    try {
      const r = await aiApi.getHistory(histPage, 20);
      if (!Array.isArray(r?.data) || !Number.isFinite(Number(r?.pagination?.total))) throw new Error('The saved AI history returned an unexpected response.');
      setHistory(r.data);
      setHistTotal(r.pagination?.total || 0);
    } catch (failure) { setHistError(failure.response?.data?.error || failure.message || 'Could not load saved AI history.'); }
    setHistLoading(false);
  };

  React.useEffect(() => {
    if (activeTool === 'history') loadHistory();
  }, [activeTool, histPage]);

  const renderResult = (value) => <AIResultView result={value} title="Operations report" />;

  return (
    <div>
      <div className="page-header">
        <div><h2>AI Tools</h2><p className="subtitle">AI-powered nonprofit operations assistance</p></div>
      </div>
      {programLoading && <p role="status">Loading saved programs, cases and volunteers…</p>}{programError && <div className="sr-alert" role="alert">{programError} <button type="button" className="btn btn-secondary" onClick={sources.retry}>Retry saved sources</button></div>}
      {loading && <div className="sr-actions"><span role="status">Preparing your OpenRouter report…</span><button type="button" className="btn btn-secondary" onClick={aiRequest.cancel}>Cancel</button></div>}{error && <div className="sr-alert" role="alert">{error}</div>}{aiRequest.notice && <div className="sr-notice" role="status">{aiRequest.notice}</div>}


      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {TOOLS.map(tool => (
          <button key={tool.id} onClick={() => { aiRequest.cancel(); setActiveTool(tool.id); setResult(null); }}
            className={`btn ${activeTool === tool.id ? 'btn-ai' : 'btn-secondary'}`}>
            {tool.label}
          </button>
        ))}
      </div>

      {activeTool === 'triage' && (
        <div style={{ background: '#1a1d2e', border: '1px solid #2d3048', borderRadius: 10, padding: 24 }}>
          <AIFieldPresets fields={[{ key: 'client_name', type: 'text' }, { key: 'needs', type: 'textarea' }, { key: 'urgency_score', type: 'number', min: 1, max: 10 }, { key: 'demographics', type: 'textarea' }]} context="triage review" disabled={loading || referencesBlocked} onFill={(sample, index) => { setTriageForm({ ...completeExample([{ key: 'client_name', type: 'text' }, { key: 'needs', type: 'textarea' }, { key: 'urgency_score', type: 'number', min: 1, max: 10 }, { key: 'demographics', type: 'textarea' }], sample, index, 'triage review', triageForm), case_id: triageForm.case_id, ...(triageForm.case_id ? { client_name: triageForm.client_name, needs: triageForm.needs, urgency_score: triageForm.urgency_score, demographics: triageForm.demographics || 'Review context: no additional demographic facts are supplied; do not infer personal circumstances or consent.' } : {}) }); setResult(null); }} />

          <h3 style={{ color: '#e2e8f0', marginBottom: 16 }}>Case Triage & Routing</h3>
          <div className="form-group"><label>Saved case annotation target (optional, manual)</label><select className="form-control" value={triageForm.case_id} onChange={e => { const row = sources.cases.find(item => String(item.id) === e.target.value); setTriageForm({ ...triageForm, case_id: e.target.value, ...(row ? { client_name: row.client_name, needs: (row.needs || []).join(', '), urgency_score: row.urgency_score, demographics: 'No additional demographic facts are supplied; do not infer actual personal circumstances.' } : {}) }); }}><option value="">Unlinked fictional draft · no case annotation</option>{sources.cases.map(row => <option key={row.id} value={String(row.id)}>{row.client_name}</option>)}</select></div>
          <p>Choose a saved annotation target manually. Examples preserve that choice and its source facts; Generate updates that case’s native AI annotation.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group"><label>Client Name</label><input className="form-control" value={triageForm.client_name} onChange={e => setTriageForm({ ...triageForm, client_name: e.target.value })} /></div>
            <div className="form-group"><label>Urgency Score (1-10)</label><input className="form-control" type="number" min="1" max="10" value={triageForm.urgency_score} onChange={e => setTriageForm({ ...triageForm, urgency_score: parseInt(e.target.value) })} /></div>
          </div>
          <div className="form-group"><label>Needs (comma-separated)</label><textarea className="form-control" value={triageForm.needs} onChange={e => setTriageForm({ ...triageForm, needs: e.target.value })} rows={2} placeholder="food, shelter, medical assistance..." /></div>
          <div className="form-group"><label>Demographics / Context</label><textarea className="form-control" value={triageForm.demographics} onChange={e => setTriageForm({ ...triageForm, demographics: e.target.value })} rows={2} /></div>
          <button className="btn btn-ai" disabled={loading || referencesBlocked} onClick={() => run(aiApi.triageCase, { client_name: triageForm.client_name, demographics: triageForm.demographics, urgency_score: triageForm.urgency_score, needs: triageForm.needs.split(',').map(s => s.trim()), ...(triageForm.case_id ? { case_id: Number(triageForm.case_id) } : {}) })}>
            {loading ? 'Triaging...' : 'Run AI Triage'}
          </button>
          {renderResult(result)}
        </div>
      )}

      {activeTool === 'dispatch' && (
        <div style={{ background: '#1a1d2e', border: '1px solid #2d3048', borderRadius: 10, padding: 24 }}>
          <AIFieldPresets fields={[dispatchField, volunteerReference]} samples={dispatchExamples} context="dispatch review" disabled={loading || referencesBlocked} onFill={(sample, index) => { setDispatchForm(completeExample([dispatchField, volunteerReference], sample, index, 'dispatch review', dispatchForm)); setResult(null); }} />

          <h3 style={{ color: '#e2e8f0', marginBottom: 16 }}>Volunteer Dispatch Optimizer</h3>
          <div className="form-group"><label>Shift Requirements</label>
            <textarea className="form-control" value={dispatchForm.shift_requirements} onChange={e => setDispatchForm({ ...dispatchForm, shift_requirements: e.target.value })} rows={4} placeholder='{"location": "Downtown shelter", "skills_needed": ["first aid", "bilingual"], "start_time": "2025-06-01T09:00:00", "duration_hours": 4}' />
          </div>
          <div className="form-group"><label>Saved volunteer (optional)</label><select className="form-control" value={dispatchForm.volunteer_id} onChange={e => setDispatchForm({ ...dispatchForm, volunteer_id: e.target.value })}><option value="">All active saved volunteers</option>{volunteerReference.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>AI will match requirements against all active volunteers in the database.</p>
          <button className="btn btn-ai" disabled={loading || referencesBlocked} onClick={() => {
            let reqs = dispatchForm.shift_requirements;
            try { reqs = JSON.parse(reqs); } catch {}
            run(aiApi.dispatchVolunteer, { shift_requirements: reqs, volunteer_ids: dispatchForm.volunteer_id ? [Number(dispatchForm.volunteer_id)] : [] });
          }}>
            {loading ? 'Matching...' : 'Find Best Volunteers'}
          </button>
          {renderResult(result)}
        </div>
      )}

      {activeTool === 'grant' && (
        <div style={{ background: '#1a1d2e', border: '1px solid #2d3048', borderRadius: 10, padding: 24 }}>
          <AIFieldPresets fields={[{ key: 'grant_name', type: 'text' }, { key: 'reporting_period', type: 'text' }, programReference]} context="grant review" disabled={loading || referencesBlocked} onFill={(sample, index) => { setGrantForm(completeExample([{ key: 'grant_name', type: 'text' }, { key: 'reporting_period', type: 'text' }, programReference], sample, index, 'grant review', grantForm)); setResult(null); }} />

          <h3 style={{ color: '#e2e8f0', marginBottom: 16 }}>Grant Report Generator</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group"><label>Grant Name</label><input className="form-control" value={grantForm.grant_name} onChange={e => setGrantForm({ ...grantForm, grant_name: e.target.value })} placeholder="Community Foundation Grant" /></div>
            <div className="form-group"><label>Reporting Period</label><input className="form-control" value={grantForm.reporting_period} onChange={e => setGrantForm({ ...grantForm, reporting_period: e.target.value })} placeholder="Q1 2025" /></div>
            <div className="form-group"><label>Program ID (optional)</label><select className="form-control" value={grantForm.program_id} onChange={e => setGrantForm({ ...grantForm, program_id: e.target.value })}><option value="">All saved programs</option>{programReference.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
          </div>
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>AI will pull real stats from your database to generate the report.</p>
          <button className="btn btn-ai" disabled={loading || referencesBlocked} onClick={() => run(aiApi.grantReport, grantForm)}>
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
          <AIFieldPresets fields={[programReference, { key: 'program_name', type: 'text' }, { key: 'period', type: 'text' }, { key: 'beneficiaries_served', type: 'number' }, { key: 'outcomes', type: 'textarea' }]} context="impact review" disabled={loading || referencesBlocked} onFill={(sample, index) => { setImpactForm(completeExample([programReference, { key: 'program_name', type: 'text' }, { key: 'period', type: 'text' }, { key: 'beneficiaries_served', type: 'number' }, { key: 'outcomes', type: 'textarea' }], sample, index, 'impact review', impactForm)); setResult(null); }} />

          <h3 style={{ color: '#e2e8f0', marginBottom: 16 }}>Impact Report Generator</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group"><label>Saved Program (optional)</label><select className="form-control" value={impactForm.program_id} onChange={e => setImpactForm({ ...impactForm, program_id: e.target.value })}><option value="">All saved programs</option>{programReference.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
            <div className="form-group"><label>Program Name / Draft Context</label><input className="form-control" value={impactForm.program_name} onChange={e => setImpactForm({ ...impactForm, program_name: e.target.value })} /></div>
            <div className="form-group"><label>Period</label><input className="form-control" value={impactForm.period} onChange={e => setImpactForm({ ...impactForm, period: e.target.value })} placeholder="Jan-June 2025" /></div>
            <div className="form-group"><label>Beneficiaries Served</label><input className="form-control" type="number" value={impactForm.beneficiaries_served} onChange={e => setImpactForm({ ...impactForm, beneficiaries_served: e.target.value })} /></div>
          </div>
          <div className="form-group"><label>Key Outcomes (describe results)</label><textarea className="form-control" value={impactForm.outcomes} onChange={e => setImpactForm({ ...impactForm, outcomes: e.target.value })} rows={4} placeholder="e.g., 85% of clients found stable housing, 120 families received food assistance..." /></div>
          <button className="btn btn-ai" disabled={loading || referencesBlocked} onClick={() => run(aiApi.impactReport, { program_id: impactForm.program_id, period: impactForm.period, custom_metrics: JSON.stringify({ supplied_program_context: impactForm.program_name, supplied_beneficiaries_served: impactForm.beneficiaries_served, supplied_outcomes: impactForm.outcomes, source_status: 'User-supplied draft context; verify against saved program data before publication' }) })}>
            {loading ? 'Generating...' : 'Generate Impact Report'}
          </button>
          {renderResult(result)}
        </div>
      )}

      {activeTool === 'needs' && (
        <div style={{ background: '#1a1d2e', border: '1px solid #2d3048', borderRadius: 10, padding: 24 }}>
          <AIFieldPresets fields={[{ key: 'beneficiary_name', type: 'text' }, { key: 'demographics', type: 'textarea' }, { key: 'current_situation', type: 'textarea' }, { key: 'location', type: 'text' }]} context="needs review" disabled={loading || referencesBlocked} onFill={(sample, index) => { setNeedsForm({ ...completeExample([{ key: 'beneficiary_name', type: 'text' }, { key: 'demographics', type: 'textarea' }, { key: 'current_situation', type: 'textarea' }, { key: 'location', type: 'text' }], sample, index, 'needs review', needsForm), case_id: needsForm.case_id, ...(needsForm.case_id ? { beneficiary_name: needsForm.beneficiary_name, demographics: needsForm.demographics || 'No additional demographic facts are supplied; do not infer actual personal circumstances.', current_situation: needsForm.current_situation || 'Review only the saved case needs; confirm additional situation facts with the actual case owner.', location: needsForm.location || 'Actual beneficiary location has not been supplied; do not infer it.' } : {}) }); setResult(null); }} />

          <h3 style={{ color: '#e2e8f0', marginBottom: 16 }}>Beneficiary Needs Assessor</h3>
          <div className="form-group"><label>Saved case annotation target (optional, manual)</label><select className="form-control" value={needsForm.case_id} onChange={e => { const row = sources.cases.find(item => String(item.id) === e.target.value); setNeedsForm({ ...needsForm, case_id: e.target.value, ...(row ? { beneficiary_name: row.client_name, current_situation: 'Saved needs: ' + (row.needs || []).join(', '), demographics: 'No additional demographic facts are supplied; do not infer actual personal circumstances.', location: 'Actual beneficiary location has not been supplied; do not infer it.' } : {}) }); }}><option value="">Unlinked fictional draft · no case annotation</option>{sources.cases.map(row => <option key={row.id} value={String(row.id)}>{row.client_name}</option>)}</select></div>
          <p>Choose a saved annotation target manually. Examples preserve its source context; no actual beneficiary facts or consent are invented.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group"><label>Beneficiary Name</label><input className="form-control" value={needsForm.beneficiary_name} onChange={e => setNeedsForm({ ...needsForm, beneficiary_name: e.target.value })} /></div>
            <div className="form-group"><label>Location</label><input className="form-control" value={needsForm.location} onChange={e => setNeedsForm({ ...needsForm, location: e.target.value })} /></div>
          </div>
          <div className="form-group"><label>Demographics</label><textarea className="form-control" value={needsForm.demographics} onChange={e => setNeedsForm({ ...needsForm, demographics: e.target.value })} rows={2} placeholder="Age, family size, employment status..." /></div>
          <div className="form-group"><label>Current Situation</label><textarea className="form-control" value={needsForm.current_situation} onChange={e => setNeedsForm({ ...needsForm, current_situation: e.target.value })} rows={3} placeholder="Describe what you know about their situation..." /></div>
          <button className="btn btn-ai" disabled={loading || referencesBlocked} onClick={() => run(aiApi.beneficiaryNeeds, { beneficiary_name: needsForm.beneficiary_name, demographics: needsForm.demographics, situation: needsForm.current_situation, location: needsForm.location, ...(needsForm.case_id ? { case_id: Number(needsForm.case_id) } : {}) })}>
            {loading ? 'Assessing...' : 'Assess Needs'}
          </button>
          {renderResult(result)}
        </div>
      )}

      {activeTool === 'resource' && (
        <div style={{ background: '#1a1d2e', border: '1px solid #2d3048', borderRadius: 10, padding: 24 }}>
          <AIFieldPresets fields={[programReference, { key: 'constraints', type: 'textarea' }, { key: 'priority_areas', type: 'textarea' }]} context="resource review" disabled={loading || referencesBlocked} onFill={(sample, index) => { setResourceForm(completeExample([programReference, { key: 'constraints', type: 'textarea' }, { key: 'priority_areas', type: 'textarea' }], sample, index, 'resource review', resourceForm)); setResult(null); }} />

          <h3 style={{ color: '#e2e8f0', marginBottom: 16 }}>Resource Allocation Optimizer</h3>
          <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>AI will review saved low-stock inventory with your program context, constraints, and priorities. It produces a draft restocking recommendation; it does not allocate supplies or approve spending.</p>
          <div className="form-group"><label>Program ID (leave blank for all)</label><select className="form-control" value={resourceForm.program_id} onChange={e => setResourceForm({ ...resourceForm, program_id: e.target.value })}><option value="">All saved programs</option>{programReference.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
          <div className="form-group"><label>Constraints</label><textarea className="form-control" value={resourceForm.constraints} onChange={e => setResourceForm({ ...resourceForm, constraints: e.target.value })} rows={2} placeholder="Budget limit $5000, 3 available vans, 12 volunteers..." /></div>
          <div className="form-group"><label>Priority Areas</label><textarea className="form-control" value={resourceForm.priority_areas} onChange={e => setResourceForm({ ...resourceForm, priority_areas: e.target.value })} rows={2} placeholder="Focus on housing, medical care, children..." /></div>
          <button className="btn btn-ai" disabled={loading || referencesBlocked} onClick={() => run(aiApi.inventoryRestock, { ...resourceForm })}>
            {loading ? 'Optimizing...' : 'Optimize Resources'}
          </button>
          {renderResult(result)}
        </div>
      )}

      {activeTool === 'history' && (
        <div style={{ background: '#1a1d2e', border: '1px solid #2d3048', borderRadius: 10, padding: 24 }}>
          <h3 style={{ color: '#e2e8f0', marginBottom: 16 }}>AI Analysis History</h3>
          {histError && <div role="alert">{histError} <button type="button" className="btn btn-secondary" onClick={loadHistory}>Retry AI history</button></div>}
          {histLoading && <p style={{ color: '#6b7280' }}>Loading...</p>}
          {history.map(item => (
            <div key={item.id} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '12px 16px', marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontWeight: 700, color: '#a855f7', fontSize: 13 }}>{item.endpoint}</span>
                <span style={{ fontSize: 11, color: '#6b7280' }}>{new Date(item.created_at).toLocaleString()}</span>
              </div>
              <AIResultView result={item.result} title="Saved operations report" />
            </div>
          ))}
          {history.length === 0 && !histLoading && !histError && <p style={{ color: '#6b7280', textAlign: 'center', padding: 24 }}>No AI analyses yet.</p>}
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
