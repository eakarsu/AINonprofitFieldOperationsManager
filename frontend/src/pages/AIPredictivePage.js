import React, { useState } from 'react';
import { aiApi } from '../api';

const TOOLS = [
  { id: 'case-resolution', label: 'Case Resolution Predict' },
  { id: 'donation-forecast', label: 'Donation Forecast' },
  { id: 'shift-optimization', label: 'Shift Optimization' },
  { id: 'program-risk', label: 'Program Risk Assessment' },
];

export default function AIPredictivePage({ showToast }) {
  const [activeTool, setActiveTool] = useState('case-resolution');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const [caseForm, setCaseForm] = useState({
    case_id: '',
    needs: '',
    urgency: 5,
    history_summary: '',
    available_resources: '',
  });
  const [donationForm, setDonationForm] = useState({
    period: 'next_quarter',
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

  const renderResult = (r) => {
    if (!r) return null;
    if (typeof r === 'string') {
      return (
        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 16, marginTop: 16, fontSize: 13, color: '#e2e8f0', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{r}</div>
      );
    }
    return (
      <pre style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 16, marginTop: 16, fontSize: 12, color: '#94a3b8', overflow: 'auto', maxHeight: 400 }}>
        {JSON.stringify(r, null, 2)}
      </pre>
    );
  };

  const run = async () => {
    setLoading(true);
    setResult(null);
    try {
      let r;
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
        r = await aiApi.caseResolutionPredict(body);
      } else if (activeTool === 'donation-forecast') {
        const body = {
          period: donationForm.period,
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
        r = await aiApi.donationForecast(body);
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
        r = await aiApi.shiftOptimization(body);
      } else {
        const body = {
          program_id: programRiskForm.program_id ? parseInt(programRiskForm.program_id, 10) : undefined,
          lookback_days: parseInt(programRiskForm.lookback_days, 10) || 90,
        };
        r = await aiApi.programRiskAssessment(body);
      }
      setResult(r.result || r);
      showToast && showToast('AI analysis complete');
    } catch (e) {
      showToast && showToast(e.response?.data?.error || e.message, 'error');
    }
    setLoading(false);
  };

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
            onClick={() => { setActiveTool(tool.id); setResult(null); }}
            className={`btn ${activeTool === tool.id ? 'btn-ai' : 'btn-secondary'}`}
          >
            {tool.label}
          </button>
        ))}
      </div>

      {activeTool === 'case-resolution' && (
        <div style={{ background: '#1a1d2e', border: '1px solid #2d3048', borderRadius: 10, padding: 24 }}>
          <h3 style={{ color: '#e2e8f0', marginBottom: 16 }}>Case Resolution Prediction</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label>Case ID (optional)</label>
              <input className="form-control" type="number" value={caseForm.case_id} onChange={(e) => setCaseForm({ ...caseForm, case_id: e.target.value })} />
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
            <textarea className="form-control" rows={4} value={shiftForm.open_shifts} onChange={(e) => setShiftForm({ ...shiftForm, open_shifts: e.target.value })} placeholder='[{"id":1,"location":"Shelter","skills":["first-aid"]}]' />
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
              <input className="form-control" type="number" value={programRiskForm.program_id} onChange={(e) => setProgramRiskForm({ ...programRiskForm, program_id: e.target.value })} placeholder="Leave blank for org-wide" />
            </div>
            <div className="form-group">
              <label>Lookback Window (days)</label>
              <input className="form-control" type="number" min="1" max="365" value={programRiskForm.lookback_days} onChange={(e) => setProgramRiskForm({ ...programRiskForm, lookback_days: e.target.value })} />
            </div>
          </div>
          <p style={{ color: '#94a3b8', fontSize: 12, marginTop: 8 }}>Pulls recent cases, incidents, donations, and shifts for the program and returns a multi-dimensional risk score.</p>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <button className="btn btn-ai" disabled={loading} onClick={run}>
          {loading ? 'Running...' : 'Run AI'}
        </button>
      </div>

      {renderResult(result)}
    </div>
  );
}
