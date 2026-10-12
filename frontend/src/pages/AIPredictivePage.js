import useNativeAIRequest from '../components/useNativeAIRequest';
import NativeAIControls from '../components/NativeAIControls';
import ReadableAIReport from "./AIResultView";
import React, { useState } from 'react';
import useNonprofitSources from '../components/useNonprofitSources';
import { aiApi } from '../api';

const TOOLS = [
  { id: 'case-resolution', label: 'Case Resolution Predict' },
  { id: 'donation-forecast', label: 'Donation Forecast' },
  { id: 'shift-optimization', label: 'Shift Optimization' },
  { id: 'program-risk', label: 'Program Risk Assessment' },
];

export default function AIPredictivePage({ showToast }) {
  const [activeTool, setActiveTool] = useState('case-resolution');
  const request = useNativeAIRequest(); const { loading: loading, result: result, setResult: setResult } = request;


  const [caseForm, setCaseForm] = useState({
    case_id: '',
    needs: '',
    urgency: 5,
    history_summary: '',
    available_resources: '',
  });
  const [donationForm, setDonationForm] = useState({
    period: 'next_quarter',
    horizon_months: 3,
    historical_data: '',
    upcoming_campaigns: '',
    economic_context: '',
  });
  const [shiftForm, setShiftForm] = useState({
    period_start: '',
    period_end: '',
    open_shifts: '',
    constraints: '',
  });
  const [programRiskForm, setProgramRiskForm] = useState({
    program_id: '',
    lookback_days: 90,
  });

  const references = useNonprofitSources();
  const sourceTool = activeTool === 'case-resolution' || activeTool === 'program-risk';
  const selectedSource = activeTool === 'case-resolution' ? caseForm.case_id : programRiskForm.program_id;
  const selectedRows = activeTool === 'case-resolution' ? references.cases : references.programs;
  const invalidSource = sourceTool && selectedSource && !references.loading && !references.error && !selectedRows.some(row => String(row.id) === selectedSource);
  const sourceBlocked = sourceTool && (references.loading || references.error || invalidSource);
  const fillExample = (index, tool = activeTool) => {
    const savedCase = references.choose('cases', caseForm.case_id, index);
    const sameCase = savedCase && String(savedCase.id) === caseForm.case_id;
    const savedProgram = references.choose('programs', programRiskForm.program_id, index);
    const labels = ['Community support', 'Seasonal planning', 'Capacity review'];
    if (tool === 'case-resolution') setCaseForm({
      case_id: savedCase ? String(savedCase.id) : '',
      needs: sameCase && caseForm.needs ? caseForm.needs : savedCase ? (savedCase.needs || []).join(', ') : ['food, housing', 'transport, healthcare', 'employment, childcare'][index],
      urgency: sameCase ? caseForm.urgency : savedCase?.urgency_score ?? [6, 8, 4][index],
      history_summary: sameCase && caseForm.history_summary ? caseForm.history_summary : savedCase ? 'Saved case status: ' + savedCase.status + '. Review the actual case history before relying on this draft analysis.' : 'Fictional planning scenario: support intake was completed last week; no saved case is linked.',
      available_resources: ['Planning assumption: two case workers, food vouchers and a partner shelter.', 'Planning assumption: volunteer transport and health clinic appointments.', 'Planning assumption: employment adviser and childcare partners.'][index],
    });
    else if (tool === 'donation-forecast') setDonationForm({ period: ['next_month', 'next_quarter', 'next_year'][index], horizon_months: [1, 3, 12][index], historical_data: JSON.stringify([{ month: '2026-07', total: 12500 }, { month: '2026-08', total: 13200 }, { month: '2026-09', total: 12800 }]), upcoming_campaigns: ['Community giving, local sponsor drive', 'Winter outreach, matching gifts', 'Annual appeal, partner grants'][index], economic_context: 'Fictional planning data for ' + labels[index] + '. Donor budgets are uncertain; state assumptions and avoid guaranteed forecasts.' });
    else if (tool === 'shift-optimization') setShiftForm({ period_start: '2026-11-01', period_end: ['2026-11-07', '2026-11-14', '2026-11-30'][index], open_shifts: JSON.stringify([{ location: 'Illustrative community center', date: '2026-11-02', hours: 4, skills: ['intake'] }, { location: 'Illustrative food pantry', date: '2026-11-03', hours: 3, skills: ['distribution'] }]), constraints: ['Maximum four-hour shifts; keep accessible transport available.', 'Preserve volunteer rest days; one trained lead per shift.', 'Balance coverage; confirm availability before assigning.'][index] });
    else setProgramRiskForm({ program_id: savedProgram ? String(savedProgram.id) : '', lookback_days: [30, 90, 180][index] });
  };
  const completePresets = ['Community support', 'Seasonal planning', 'Capacity review'].map((label, index) => ({ label, values: index }));
  const selectTool = tool => { request.cancel(); setActiveTool(tool); setResult(null); if (!references.loading && !references.error || tool === 'donation-forecast' || tool === 'shift-optimization') fillExample(0, tool); };
  const renderResult = r => r ? <ReadableAIReport result={r} /> : null;

  const run = async () => { if (sourceBlocked) return; const result = await request.run(async (options) => {       let r;
      if (activeTool === 'case-resolution') {
        const body = {
          case_id: caseForm.case_id ? parseInt(caseForm.case_id, 10) : undefined,
          urgency: parseInt(caseForm.urgency, 10),
          history_summary: caseForm.history_summary,
          available_resources: caseForm.available_resources,
        };
        if (caseForm.needs) {
          body.needs = caseForm.needs.split(',').map((s) => s.trim()).filter(Boolean);
        }
        r = await aiApi.caseResolutionPredict(body,options);
      } else if (activeTool === 'donation-forecast') {
        const body = {
          period: donationForm.period,
          horizon_months: Number(donationForm.horizon_months),
          economic_context: donationForm.economic_context,
        };
        if (donationForm.historical_data.trim()) {
          try {
            body.historical_data = JSON.parse(donationForm.historical_data);
          } catch {
            body.historical_data = donationForm.historical_data;
          }
        }
        if (donationForm.upcoming_campaigns) {
          body.upcoming_campaigns = donationForm.upcoming_campaigns
            .split(',').map((s) => s.trim()).filter(Boolean);
        }
        r = await aiApi.donationForecast(body,options);
      } else if (activeTool === 'shift-optimization') {
        const body = {
          period_start: shiftForm.period_start,
          period_end: shiftForm.period_end,
          constraints: shiftForm.constraints,
        };
        if (shiftForm.open_shifts.trim()) {
          try {
            body.open_shifts = JSON.parse(shiftForm.open_shifts);
          } catch {
            body.open_shifts = shiftForm.open_shifts;
          }
        }
        r = await aiApi.shiftOptimization(body,options);
      } else {
        const body = {
          program_id: programRiskForm.program_id ? parseInt(programRiskForm.program_id, 10) : undefined,
          lookback_days: parseInt(programRiskForm.lookback_days, 10) || 90,
        };
        r = await aiApi.programRiskAssessment(body,options);
      }
 return r.result || r; }); if (result !== undefined) showToast && showToast('AI analysis complete'); };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>AI Predictive Tools</h2>
          <p className="subtitle">Forecast outcomes, donations, and optimal shift coverage</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            onClick={() => selectTool(tool.id)}
            className={`btn ${activeTool === tool.id ? 'btn-ai' : 'btn-secondary'}`}
          >
            {tool.label}
          </button>
        ))}
      </div>

      <NativeAIControls request={request} presets={completePresets} blocked={sourceBlocked ? references.loading ? 'Loading saved case and program sources…' : invalidSource ? 'The selected saved source is no longer available. Choose a permitted source before generating.' : 'Retry the saved source list before generating.' : ''} onFill={(_, index) => fillExample(index)} />
      {sourceTool && references.error && <div role="alert">{references.error} <button className="btn btn-secondary" type="button" onClick={references.retry}>Retry saved sources</button></div>}
      {sourceTool && !references.loading && !references.error && !(activeTool === 'case-resolution' ? references.cases : references.programs).length && <p role="status">No saved {activeTool === 'case-resolution' ? 'case' : 'program'} is available. Examples fill every ordinary input; the optional source stays empty for {activeTool === 'case-resolution' ? 'an explicitly fictional unlinked scenario' : 'an organization-wide review'}.</p>}
      {activeTool === 'case-resolution' && (
        <div style={{ background: '#1a1d2e', border: '1px solid #2d3048', borderRadius: 10, padding: 24 }}>
          <h3 style={{ color: '#e2e8f0', marginBottom: 16 }}>Case Resolution Prediction</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label>Case ID (optional)</label>
              <select className="form-control" value={caseForm.case_id} onChange={e => { const saved = references.cases.find(row => String(row.id) === e.target.value); setCaseForm({ ...caseForm, case_id: e.target.value, needs: saved ? (saved.needs || []).join(', ') : caseForm.needs, urgency: saved?.urgency_score ?? caseForm.urgency, history_summary: saved ? 'Saved case status: ' + saved.status + '. Review the actual case history before relying on this draft analysis.' : caseForm.history_summary }); }}><option value="">Unlinked fictional scenario</option>{references.cases.map(row => <option key={row.id} value={String(row.id)}>{row.client_name || 'Saved case ' + row.id}</option>)}</select>
            </div>
            <div className="form-group">
              <label>Urgency (1-10)</label>
              <input className="form-control" type="number" min="1" max="10" value={caseForm.urgency} onChange={(e) => setCaseForm({ ...caseForm, urgency: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label>Needs (comma-separated)</label>
            <textarea className="form-control" rows={2} value={caseForm.needs} onChange={(e) => setCaseForm({ ...caseForm, needs: e.target.value })} placeholder="food, shelter..." />
          </div>
          <div className="form-group">
            <label>History Summary</label>
            <textarea className="form-control" rows={3} value={caseForm.history_summary} onChange={(e) => setCaseForm({ ...caseForm, history_summary: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Available Resources</label>
            <textarea className="form-control" rows={2} value={caseForm.available_resources} onChange={(e) => setCaseForm({ ...caseForm, available_resources: e.target.value })} />
          </div>
        </div>
      )}

      {activeTool === 'donation-forecast' && (
        <div style={{ background: '#1a1d2e', border: '1px solid #2d3048', borderRadius: 10, padding: 24 }}>
          <h3 style={{ color: '#e2e8f0', marginBottom: 16 }}>Donation Forecast</h3>
          <div className="form-group">
            <label>Period</label>
            <select className="form-control" value={donationForm.period} onChange={(e) => setDonationForm({ ...donationForm, period: e.target.value })}>
              <option value="next_month">Next Month</option>
              <option value="next_quarter">Next Quarter</option>
              <option value="next_year">Next Year</option>
            </select>
          </div>
          <div className="form-group"><label>Horizon (months, optional)</label><input className="form-control" type="number" min="1" max="36" step="1" value={donationForm.horizon_months} onChange={e => setDonationForm({ ...donationForm, horizon_months: e.target.value })} /></div>
          <div className="form-group">
            <label>Historical Data (JSON or text)</label>
            <textarea className="form-control" rows={4} value={donationForm.historical_data} onChange={(e) => setDonationForm({ ...donationForm, historical_data: e.target.value })} placeholder='[{"month":"Jan 2025","total":12500}]' />
          </div>
          <div className="form-group">
            <label>Upcoming Campaigns (comma-separated)</label>
            <input className="form-control" value={donationForm.upcoming_campaigns} onChange={(e) => setDonationForm({ ...donationForm, upcoming_campaigns: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Economic Context</label>
            <textarea className="form-control" rows={2} value={donationForm.economic_context} onChange={(e) => setDonationForm({ ...donationForm, economic_context: e.target.value })} />
          </div>
        </div>
      )}

      {activeTool === 'shift-optimization' && (
        <div style={{ background: '#1a1d2e', border: '1px solid #2d3048', borderRadius: 10, padding: 24 }}>
          <h3 style={{ color: '#e2e8f0', marginBottom: 16 }}>Shift Optimization</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label>Period Start</label>
              <input className="form-control" type="date" value={shiftForm.period_start} onChange={(e) => setShiftForm({ ...shiftForm, period_start: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Period End</label>
              <input className="form-control" type="date" value={shiftForm.period_end} onChange={(e) => setShiftForm({ ...shiftForm, period_end: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label>Open Shifts (JSON)</label>
            <textarea className="form-control" rows={4} value={shiftForm.open_shifts} onChange={(e) => setShiftForm({ ...shiftForm, open_shifts: e.target.value })} placeholder='[{"location":"Illustrative shelter","date":"2026-11-02","hours":4,"skills":["first-aid"]}]' />
          </div>
          <div className="form-group">
            <label>Constraints</label>
            <textarea className="form-control" rows={2} value={shiftForm.constraints} onChange={(e) => setShiftForm({ ...shiftForm, constraints: e.target.value })} />
          </div>
        </div>
      )}

      {activeTool === 'program-risk' && (
        <div style={{ background: '#1a1d2e', border: '1px solid #2d3048', borderRadius: 10, padding: 24 }}>
          <h3 style={{ color: '#e2e8f0', marginBottom: 16 }}>Program Risk Assessment</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label>Program ID (optional)</label>
              <select className="form-control" value={programRiskForm.program_id} onChange={e => setProgramRiskForm({ ...programRiskForm, program_id: e.target.value })}><option value="">Organization-wide review</option>{references.programs.map(row => <option key={row.id} value={String(row.id)}>{row.name || 'Saved program ' + row.id}</option>)}</select>
            </div>
            <div className="form-group">
              <label>Lookback Window (days)</label>
              <input className="form-control" type="number" min="1" max="365" value={programRiskForm.lookback_days} onChange={(e) => setProgramRiskForm({ ...programRiskForm, lookback_days: e.target.value })} />
            </div>
          </div>
          <p style={{ color: '#94a3b8', fontSize: 12, marginTop: 8 }}>Reviews saved program cases and shifts. Incident and donation records have no program link in this workspace and are labeled organization-wide context; the report remains advisory.</p>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <button className="btn btn-ai" disabled={loading || Boolean(sourceBlocked)} onClick={run}>
          {loading ? 'Running...' : 'Generate with OpenRouter'}
        </button>
      </div>

      {renderResult(result)}
    </div>
  );
}
