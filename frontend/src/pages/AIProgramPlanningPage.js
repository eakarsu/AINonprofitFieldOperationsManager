import React, { useState } from 'react';
import { aiApi } from '../api';
import useNonprofitSources from '../components/useNonprofitSources';
import useNativeAIRequest from '../components/useNativeAIRequest';
import NativeAIControls from '../components/NativeAIControls';
import AIResultView from './AIResultView';

export default function AIProgramPlanningPage() {
  const [active, setActive] = useState('application');
  const [application, setApplication] = useState({ funder: '', program_id: '', amount_requested: '', project_description: '', deadline: '' });
  const [evaluation, setEvaluation] = useState({ program_id: '' });
  const sources = useNonprofitSources(), request = useNativeAIRequest();
  const selected = active === 'application' ? application.program_id : evaluation.program_id;
  const invalid = selected && !sources.loading && !sources.error && !sources.programs.some(row => String(row.id) === selected);
  const blocked = sources.loading || sources.error || invalid;
  const fillExample = (index, tool = active) => {
    const current = tool === 'application' ? application : evaluation, saved = sources.choose('programs', current.program_id, index);
    const program_id = saved ? String(saved.id) : '';
    if (tool === 'application') setApplication({ funder: ['Fictional Community Foundation', 'Fictional Neighborhood Support Fund', 'Fictional Capacity Building Trust'][index], program_id, amount_requested: [15000, 27500.50, 42000][index], project_description: ['Illustrative proposal: extend community intake capacity while documenting unmet needs and outcome measures.', 'Illustrative proposal: improve accessible outreach and partner referrals; verify the actual program facts before submission.', 'Illustrative proposal: train volunteer coordinators and measure service continuity; this draft does not assert funded or approved work.'][index], deadline: ['2026-11-15', '2026-12-01', '2027-01-15'][index] });
    else setEvaluation({ program_id });
  };
  const selectTool = tool => { request.cancel(); setActive(tool); request.setResult(null); if (!sources.loading && !sources.error) fillExample(0, tool); };
  const run = () => {
    if (blocked) return;
    request.run(options => active === 'application' ? aiApi.grantApplication({ ...application, program_id: application.program_id ? Number(application.program_id) : undefined, amount_requested: application.amount_requested === '' ? undefined : Number(application.amount_requested) }, options) : aiApi.programEvaluation({ program_id: evaluation.program_id ? Number(evaluation.program_id) : undefined }, options));
  };
  const programSelect = (value, change) => <div className="form-group"><label>Saved program (optional)</label><select className="form-control" value={value} onChange={event => change(event.target.value)}><option value="">All saved programs</option>{sources.programs.map(row => <option key={row.id} value={String(row.id)}>{row.name || 'Saved program ' + row.id}</option>)}</select></div>;
  return <div>
    <div className="page-header"><div><h2>AI Program Planning</h2><p className="subtitle">Draft grant applications and review saved program outcomes. Human review and submission remain separate.</p></div></div>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button type="button" className={'btn ' + (active === 'application' ? 'btn-ai' : 'btn-secondary')} onClick={() => selectTool('application')}>Grant Application</button><button type="button" className={'btn ' + (active === 'evaluation' ? 'btn-ai' : 'btn-secondary')} onClick={() => selectTool('evaluation')}>Program Evaluation</button></div>
    <NativeAIControls request={request} presets={['Community expansion', 'Accessible outreach', 'Capacity building'].map((label, index) => ({ label, values: index }))} onFill={(_, index) => fillExample(index)} blocked={blocked ? sources.loading ? 'Loading saved program sources…' : invalid ? 'The selected program is no longer available. Choose a permitted saved program.' : 'Retry the saved sources before generating.' : ''} />
    {sources.error && <div role="alert">{sources.error} <button type="button" className="btn btn-secondary" onClick={sources.retry}>Retry saved sources</button></div>}
    {!sources.loading && !sources.error && !sources.programs.length && <p role="status">No saved program is available. Ordinary draft inputs are filled; the optional program stays empty for an organization-wide review.</p>}
    <div style={{ padding: 24, borderRadius: 10, border: '1px solid #2d3048', background: '#1a1d2e' }}>
      {active === 'application' ? <>
        <h3>Grant Application Draft</h3>
        <div className="form-group"><label>Funder</label><input className="form-control" value={application.funder} onChange={e => setApplication({ ...application, funder: e.target.value })} /></div>
        {programSelect(application.program_id, program_id => setApplication({ ...application, program_id }))}
        <div className="form-group"><label>Amount requested (optional)</label><input className="form-control" type="number" min="0" step="0.01" value={application.amount_requested} onChange={e => setApplication({ ...application, amount_requested: e.target.value })} /></div>
        <div className="form-group"><label>Project description (optional draft context)</label><textarea className="form-control" rows={5} value={application.project_description} onChange={e => setApplication({ ...application, project_description: e.target.value })} /></div>
        <div className="form-group"><label>Deadline (optional planning date)</label><input className="form-control" type="date" value={application.deadline} onChange={e => setApplication({ ...application, deadline: e.target.value })} /></div>
      </> : <><h3>Program Evaluation</h3>{programSelect(evaluation.program_id, program_id => setEvaluation({ program_id }))}<p>Uses saved case and volunteer evidence. Incident context is organization-wide because native incidents have no program link. No program or approval is changed.</p></>}
      <button type="button" className="btn btn-ai" disabled={request.loading || Boolean(blocked)} onClick={run}>{request.loading ? 'Preparing report…' : 'Generate with OpenRouter'}</button>
    </div>
    {request.result && <AIResultView result={request.result.result || request.result} title={active === 'application' ? 'Grant application draft' : 'Program evaluation'} />}
  </div>;
}
