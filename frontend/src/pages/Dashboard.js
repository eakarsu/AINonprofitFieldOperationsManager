import React, { useState, useEffect } from 'react';
import { dashboardApi } from '../api';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardApi.getStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const kpis = stats ? [
    { label: 'Active Volunteers', value: stats.total_volunteers, color: '#10b981', icon: '👥' },
    { label: 'Active Shifts', value: stats.active_shifts, color: '#3b82f6', icon: '📋' },
    { label: 'Open Cases', value: stats.open_cases, color: '#f59e0b', icon: '📁' },
    { label: 'Low Inventory Items', value: stats.low_inventory_items, color: '#ef4444', icon: '📦' },
  ] : [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Dashboard</h2>
          <p className="subtitle">Overview of field operations</p>
        </div>
      </div>

      {loading && <div className="loading-text">Loading dashboard...</div>}

      {!loading && stats && (
        <div className="stats-row">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="stat-box">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 24 }}>{kpi.icon}</span>
              </div>
              <div className="stat-number" style={{ color: kpi.color }}>{kpi.value}</div>
              <div className="stat-label">{kpi.label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 8 }}>
        <div style={{ background: '#1a1d2e', border: '1px solid #2d3048', borderRadius: 10, padding: 20 }}>
          <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Quick Links</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { href: '/cases', label: 'Triage New Case', icon: '🚨' },
              { href: '/volunteers', label: 'Manage Volunteers', icon: '👥' },
              { href: '/inventory', label: 'Check Inventory', icon: '📦' },
              { href: '/ai', label: 'AI Tools', icon: '🤖' },
            ].map(link => (
              <a key={link.href} href={link.href} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, color: '#e2e8f0', textDecoration: 'none', fontSize: 14, fontWeight: 500, transition: 'background 0.15s' }}>
                <span>{link.icon}</span>
                {link.label}
              </a>
            ))}
          </div>
        </div>
        <div style={{ background: '#1a1d2e', border: '1px solid #2d3048', borderRadius: 10, padding: 20 }}>
          <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 12 }}>AI Capabilities</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Case Triage & Routing', desc: 'AI scores urgency and routes cases to the right program' },
              { label: 'Volunteer Dispatch', desc: 'Matches best volunteers to shift requirements' },
              { label: 'Grant Report Generation', desc: 'Drafts outcome reports from real DB stats' },
              { label: 'Incident Pattern Clustering', desc: 'Identifies safety patterns across last 90 days' },
              { label: 'Inventory Restock Planning', desc: 'Generates wish list and donor appeal text' },
            ].map(item => (
              <div key={item.label} style={{ padding: '8px 12px', background: 'rgba(16,185,129,0.06)', borderRadius: 7, borderLeft: '3px solid #10b981' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#10b981' }}>{item.label}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
