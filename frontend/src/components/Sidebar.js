import React from 'react';
import { NavLink } from 'react-router-dom';

const navItems = [
  { path: '/', label: 'Dashboard', icon: '◈' },
  { path: '/programs', label: 'Programs', icon: '🏛️' },
  { path: '/volunteers', label: 'Volunteers', icon: '👥' },
  { path: '/shifts', label: 'Shifts', icon: '📋' },
  { path: '/cases', label: 'Cases', icon: '📁' },
  { path: '/donations', label: 'Donations', icon: '🎁' },
  { path: '/inventory', label: 'Inventory', icon: '📦' },
  { path: '/incidents', label: 'Incidents', icon: '⚠️' },
  { path: '/impact-metrics', label: 'Impact Metrics', icon: '📊' },
  { path: '/grant-tracking', label: 'Grant Tracking', icon: '💰' },
  { path: '/custom-views', label: 'Field Views', icon: '🗺️' },
  { path: '/ai', label: 'AI Tools', icon: '🤖' },
  { path: '/ai-predictive', label: 'AI Predictive', icon: '🔮' },
  { path: '/ai-backlog', label: 'AI Backlog Tools', icon: '🧪' },
  // === Batch 06 Gaps & Frontend Mounts ===
  { path: '/cf-agentic-volunteer-dispatch', label: 'Agentic volunteer dispatch', icon: '✨' },
  { path: '/cf-rag-over-organizational-playbooks', label: 'RAG over organizational playbooks', icon: '✨' },
  { path: '/cf-donor-engagement-scoring', label: 'Donor engagement scoring', icon: '✨' },
  { path: '/cf-field-photo-upload-tagging', label: 'Field photo upload + tagging', icon: '✨' },
  { path: '/cf-compliance-audit-agent', label: 'Compliance audit agent', icon: '✨' },
  { path: '/gap-cases-exist-without-case', label: 'Cases exist without `/case', icon: '✨' },
  { path: '/gap-donations-tracked-but-no-donation', label: 'Donations tracked but no `/donation', icon: '✨' },
  { path: '/gap-programs-without-program', label: 'Programs without `/program', icon: '✨' },
  { path: '/gap-shifts-without-shift', label: 'Shifts without `/shift', icon: '✨' },
  { path: '/gap-no-multi', label: 'No multi', icon: '✨' },
  { path: '/gap-no-sms-bulk-communication-or-notification-layer', label: 'No SMS/bulk communication or notification layer', icon: '✨' },
  { path: '/gap-no-reporting-export-pdf-csv-for-board-meetings-and', label: 'No reporting export (PDF/CSV for board meetings and funders)', icon: '✨' },
  { path: '/gap-no-webhooks-or-third', label: 'No webhooks or third', icon: '✨' },
  { path: '/gap-no-file-document-storage-for-case-attachments', label: 'No file/document storage for case attachments', icon: '✨' },
  { path: '/gap-no-rbac-beyond-basic-auth-no-role-separation', label: 'No RBAC beyond basic auth (no role separation', icon: '✨' }
];

export default function Sidebar({ user, onLogout }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h1><span>AI</span> Nonprofit Ops</h1>
        <p>Field Operations Manager</p>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) => isActive ? 'active' : ''}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-user">
        <div>
          <div className="user-name">{user?.name || user?.email}</div>
          <div className="user-role">{user?.role}</div>
        </div>
        <button className="btn btn-sm btn-secondary" onClick={onLogout}>Logout</button>
      </div>
    </aside>
  );
}
