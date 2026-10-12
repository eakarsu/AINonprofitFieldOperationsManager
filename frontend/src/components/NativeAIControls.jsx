import React from 'react';
export default function NativeAIControls({ request, presets = [], onFill, blocked = '' }) {
  return <section aria-label="Complete examples" style={{ margin: '16px 0', padding: 16, border: '1px solid #64748b55', borderRadius: 10 }}>
    {presets.length > 0 && <><strong>Fill every field</strong><p style={{ fontSize: 13, opacity: .8 }}>Each example includes optional inputs. Review the supplied example before generating.</p><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{presets.map((preset, index) => <button className="btn btn-secondary" type="button" key={preset.label || index} disabled={request.loading || Boolean(blocked)} onClick={() => { onFill(preset.values, index); request.setResult(null); request.setError(null); }}>{preset.label || 'Example '+(index+1)}</button>)}</div></>}
    {blocked && <p role="status">{blocked}</p>}
    {request.loading && <button className="btn btn-secondary" type="button" onClick={request.cancel} style={{ marginTop: 12 }}>Cancel</button>}
    {request.notice && <p role="status">{request.notice}</p>}{request.error && <p role="alert" style={{ color: '#ef4444' }}>{request.error}</p>}
  </section>;
}
