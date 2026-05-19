import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import VolunteersPage from './pages/VolunteersPage';
import ShiftsPage from './pages/ShiftsPage';
import ProgramsPage from './pages/ProgramsPage';
import CasesPage from './pages/CasesPage';
import DonationsPage from './pages/DonationsPage';
import InventoryPage from './pages/InventoryPage';
import IncidentsPage from './pages/IncidentsPage';
import AIPage from './pages/AIPage';
import AIPredictivePage from './pages/AIPredictivePage';
import AIBacklogPage from './pages/AIBacklogPage';
import ImpactMetricsPage from './pages/ImpactMetricsPage';
import GrantTrackingPage from './pages/GrantTrackingPage';
import CustomViewsPage from './pages/CustomViewsPage';

// // === Batch 06 Gaps & Frontend Mounts ===
import CFAgenticVolunteerDispatchPage from './pages/CFAgenticVolunteerDispatchPage';
import CFRagOverOrganizationalPlaybooksPage from './pages/CFRagOverOrganizationalPlaybooksPage';
import CFDonorEngagementScoringPage from './pages/CFDonorEngagementScoringPage';
import CFFieldPhotoUploadTaggingPage from './pages/CFFieldPhotoUploadTaggingPage';
import CFComplianceAuditAgentPage from './pages/CFComplianceAuditAgentPage';
import GapCasesExistWithoutCasePage from './pages/GapCasesExistWithoutCasePage';
import GapDonationsTrackedButNoDonationPage from './pages/GapDonationsTrackedButNoDonationPage';
import GapProgramsWithoutProgramPage from './pages/GapProgramsWithoutProgramPage';
import GapShiftsWithoutShiftPage from './pages/GapShiftsWithoutShiftPage';
import GapNoMultiPage from './pages/GapNoMultiPage';
import GapNoSmsBulkCommunicationOrNotificationLayerPage from './pages/GapNoSmsBulkCommunicationOrNotificationLayerPage';
import GapNoReportingExportPdfCsvForBoardMeetingsAndPage from './pages/GapNoReportingExportPdfCsvForBoardMeetingsAndPage';
import GapNoWebhooksOrThirdPage from './pages/GapNoWebhooksOrThirdPage';
import GapNoFileDocumentStorageForCaseAttachmentsPage from './pages/GapNoFileDocumentStorageForCaseAttachmentsPage';
import GapNoRbacBeyondBasicAuthNoRoleSeparationPage from './pages/GapNoRbacBeyondBasicAuthNoRoleSeparationPage';
function Toast({ toast, onClose }) {
  if (!toast) return null;
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, minWidth: 260, background: toast.type === 'error' ? '#ef4444' : '#10b981', color: '#fff', padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      {toast.msg}
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16 }}>x</button>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      try { setUser(JSON.parse(userData)); } catch {}
    }
  }, []);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLogin = (userData, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar user={user} onLogout={handleLogout} />
      <main style={{ flex: 1, overflowY: 'auto', padding: 24, background: '#0f111a' }}>
        <Toast toast={toast} onClose={() => setToast(null)} />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/volunteers" element={<VolunteersPage showToast={showToast} />} />
          <Route path="/shifts" element={<ShiftsPage showToast={showToast} />} />
          <Route path="/programs" element={<ProgramsPage showToast={showToast} />} />
          <Route path="/cases" element={<CasesPage showToast={showToast} />} />
          <Route path="/donations" element={<DonationsPage showToast={showToast} />} />
          <Route path="/inventory" element={<InventoryPage showToast={showToast} />} />
          <Route path="/incidents" element={<IncidentsPage showToast={showToast} />} />
          <Route path="/ai" element={<AIPage showToast={showToast} />} />
          <Route path="/ai-predictive" element={<AIPredictivePage showToast={showToast} />} />
          <Route path="/ai-backlog" element={<AIBacklogPage showToast={showToast} />} />
          <Route path="/impact-metrics" element={<ImpactMetricsPage showToast={showToast} />} />
          <Route path="/grant-tracking" element={<GrantTrackingPage showToast={showToast} />} />
          <Route path="/custom-views" element={<CustomViewsPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        
          {/* // === Batch 06 Gaps & Frontend Mounts === */}
          <Route path="/cf-agentic-volunteer-dispatch" element={<CFAgenticVolunteerDispatchPage />} />
          <Route path="/cf-rag-over-organizational-playbooks" element={<CFRagOverOrganizationalPlaybooksPage />} />
          <Route path="/cf-donor-engagement-scoring" element={<CFDonorEngagementScoringPage />} />
          <Route path="/cf-field-photo-upload-tagging" element={<CFFieldPhotoUploadTaggingPage />} />
          <Route path="/cf-compliance-audit-agent" element={<CFComplianceAuditAgentPage />} />
          <Route path="/gap-cases-exist-without-case" element={<GapCasesExistWithoutCasePage />} />
          <Route path="/gap-donations-tracked-but-no-donation" element={<GapDonationsTrackedButNoDonationPage />} />
          <Route path="/gap-programs-without-program" element={<GapProgramsWithoutProgramPage />} />
          <Route path="/gap-shifts-without-shift" element={<GapShiftsWithoutShiftPage />} />
          <Route path="/gap-no-multi" element={<GapNoMultiPage />} />
          <Route path="/gap-no-sms-bulk-communication-or-notification-layer" element={<GapNoSmsBulkCommunicationOrNotificationLayerPage />} />
          <Route path="/gap-no-reporting-export-pdf-csv-for-board-meetings-and" element={<GapNoReportingExportPdfCsvForBoardMeetingsAndPage />} />
          <Route path="/gap-no-webhooks-or-third" element={<GapNoWebhooksOrThirdPage />} />
          <Route path="/gap-no-file-document-storage-for-case-attachments" element={<GapNoFileDocumentStorageForCaseAttachmentsPage />} />
          <Route path="/gap-no-rbac-beyond-basic-auth-no-role-separation" element={<GapNoRbacBeyondBasicAuthNoRoleSeparationPage />} />
        </Routes>
      </main>
    </div>
  );
}
