import { useEffect, useState } from 'react';
import { casesApi, programsApi, volunteersApi } from '../api';

export default function useNonprofitSources(includeVolunteers = false) {
  const [catalogs, setCatalogs] = useState({ cases: [], programs: [], volunteers: [] });
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true); setError('');
    Promise.all([casesApi.getAll(1, 100, { signal: controller.signal }), programsApi.getAll(1, 100, { signal: controller.signal }), ...(includeVolunteers ? [volunteersApi.getAll(1, 100, { signal: controller.signal })] : [])])
      .then(responses => {
        const rows = responses.map((response, index) => {
          const items = Array.isArray(response) ? response : response?.data;
          if (!Array.isArray(items) || items.some(item => !item || !Number.isInteger(Number(item.id)) || Number(item.id) < 1)) throw new Error('Saved ' + ['cases', 'programs', 'volunteers'][index] + ' returned an unexpected response.');
          return items;
        });
        if (active) setCatalogs({ cases: rows[0], programs: rows[1], volunteers: (rows[2] || []).filter(row => row.status === 'active') });
      })
      .catch(failure => { if (active && !controller.signal.aborted) { setCatalogs({ cases: [], programs: [] }); setError(failure.response?.data?.error || failure.message || 'Could not load saved case and program sources.'); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [revision, includeVolunteers]);
  const choose = (kind, selected, scenario = 0) => catalogs[kind].find(row => String(row.id) === String(selected)) || catalogs[kind][scenario % Math.max(1, catalogs[kind].length)];
  return { ...catalogs, loading, error, choose, retry: () => setRevision(value => value + 1) };
}
