import React from 'react';
import ProgramImpactChart from '../components/ProgramImpactChart';
import VolunteerHeatmap from '../components/VolunteerHeatmap';
import ImpactReportPDF from '../components/ImpactReportPDF';
import ProgramRulesEditor from '../components/ProgramRulesEditor';

export default function CustomViewsPage() {
  return (
    <div style={{ padding: 24, color: '#e5e7eb' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>Field Views</h1>
      <p style={{ color: '#9ca3af', marginBottom: 20 }}>
        Custom field-operations dashboards: program impact, volunteer activity heatmap, board-ready PDF report, and eligibility rule management.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
        <ProgramImpactChart />
        <VolunteerHeatmap />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
          <ImpactReportPDF />
        </div>
        <ProgramRulesEditor />
      </div>
    </div>
  );
}
