import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-extract data from paginated responses
export function extractData(response) {
  if (Array.isArray(response)) return response;
  if (response && Array.isArray(response.data)) return response.data;
  return [];
}

export const authApi = {
  login: (data) => api.post('/auth/login', data).then(r => r.data),
  register: (data) => api.post('/auth/register', data).then(r => r.data),
  me: () => api.get('/auth/me').then(r => r.data),
};

export const volunteersApi = {
  getAll: (page = 1, limit = 20) => api.get(`/volunteers?page=${page}&limit=${limit}`).then(r => r.data),
  getOne: (id) => api.get(`/volunteers/${id}`).then(r => r.data),
  create: (data) => api.post('/volunteers', data).then(r => r.data),
  update: (id, data) => api.put(`/volunteers/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/volunteers/${id}`).then(r => r.data),
};

export const shiftsApi = {
  getAll: (page = 1, limit = 20) => api.get(`/shifts?page=${page}&limit=${limit}`).then(r => r.data),
  getOne: (id) => api.get(`/shifts/${id}`).then(r => r.data),
  create: (data) => api.post('/shifts', data).then(r => r.data),
  update: (id, data) => api.put(`/shifts/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/shifts/${id}`).then(r => r.data),
};

export const programsApi = {
  getAll: (page = 1, limit = 20) => api.get(`/programs?page=${page}&limit=${limit}`).then(r => r.data),
  getOne: (id) => api.get(`/programs/${id}`).then(r => r.data),
  create: (data) => api.post('/programs', data).then(r => r.data),
  update: (id, data) => api.put(`/programs/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/programs/${id}`).then(r => r.data),
};

export const casesApi = {
  getAll: (page = 1, limit = 20) => api.get(`/cases?page=${page}&limit=${limit}`).then(r => r.data),
  getOne: (id) => api.get(`/cases/${id}`).then(r => r.data),
  create: (data) => api.post('/cases', data).then(r => r.data),
  update: (id, data) => api.put(`/cases/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/cases/${id}`).then(r => r.data),
};

export const donationsApi = {
  getAll: (page = 1, limit = 20) => api.get(`/donations?page=${page}&limit=${limit}`).then(r => r.data),
  getOne: (id) => api.get(`/donations/${id}`).then(r => r.data),
  create: (data) => api.post('/donations', data).then(r => r.data),
  update: (id, data) => api.put(`/donations/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/donations/${id}`).then(r => r.data),
};

export const inventoryApi = {
  getAll: (page = 1, limit = 20) => api.get(`/inventory?page=${page}&limit=${limit}`).then(r => r.data),
  getOne: (id) => api.get(`/inventory/${id}`).then(r => r.data),
  create: (data) => api.post('/inventory', data).then(r => r.data),
  update: (id, data) => api.put(`/inventory/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/inventory/${id}`).then(r => r.data),
};

export const incidentsApi = {
  getAll: (page = 1, limit = 20) => api.get(`/incidents?page=${page}&limit=${limit}`).then(r => r.data),
  getOne: (id) => api.get(`/incidents/${id}`).then(r => r.data),
  create: (data) => api.post('/incidents', data).then(r => r.data),
  update: (id, data) => api.put(`/incidents/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/incidents/${id}`).then(r => r.data),
};

export const aiApi = {
  triageCase: (data) => api.post('/ai/triage-case', data).then(r => r.data),
  dispatchVolunteer: (data) => api.post('/ai/dispatch-volunteer', data).then(r => r.data),
  grantReport: (data) => api.post('/ai/grant-report', data).then(r => r.data),
  incidentCluster: (data) => api.post('/ai/incident-cluster', data).then(r => r.data),
  inventoryRestock: (data) => api.post('/ai/inventory-restock', data).then(r => r.data),
  impactReport: (data) => api.post('/ai/impact-report', data).then(r => r.data),
  beneficiaryNeeds: (data) => api.post('/ai/beneficiary-needs', data).then(r => r.data),
  grantApplication: (data) => api.post('/ai/grant-application', data).then(r => r.data),
  programEvaluation: (data) => api.post('/ai/program-evaluation', data).then(r => r.data),
  caseResolutionPredict: (data) => api.post('/ai/case-resolution-predict', data).then(r => r.data),
  donationForecast: (data) => api.post('/ai/donation-forecast', data).then(r => r.data),
  shiftOptimization: (data) => api.post('/ai/shift-optimization', data).then(r => r.data),
  programRiskAssessment: (data) => api.post('/ai/program-risk-assessment', data).then(r => r.data),
  getHistory: (page = 1, limit = 20) => api.get(`/ai/history?page=${page}&limit=${limit}`).then(r => r.data),
  // Apply pass 5 — full backlog
  translate: (data) => api.post('/ai/multi-language/translate', data).then(r => r.data),
  bulkSms: (data) => api.post('/ai/bulk-sms', data).then(r => r.data),
  bulkEmail: (data) => api.post('/ai/bulk-email', data).then(r => r.data),
  reportCasesCsv: () => api.get('/ai/reports/cases.csv', { responseType: 'blob' }).then(r => r.data),
  reportDonationsCsv: () => api.get('/ai/reports/donations.csv', { responseType: 'blob' }).then(r => r.data),
  auditTrailLog: (data) => api.post('/ai/audit-trail/log', data).then(r => r.data),
  auditTrailList: (limit = 100) => api.get(`/ai/audit-trail?limit=${limit}`).then(r => r.data),
  uploadFieldPhoto: (data) => api.post('/ai/field-photo', data).then(r => r.data),
  listFieldPhotos: (limit = 50) => api.get(`/ai/field-photos?limit=${limit}`).then(r => r.data),
};

export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats').then(r => r.data),
};

export default api;
