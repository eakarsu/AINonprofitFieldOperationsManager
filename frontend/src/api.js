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
  getAll: (page = 1, limit = 20, options = {}) => api.get(`/volunteers?page=${page}&limit=${limit}`, options).then(r => r.data),
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
  getAll: (page = 1, limit = 20, options = {}) => api.get(`/programs?page=${page}&limit=${limit}`, options).then(r => r.data),
  getOne: (id) => api.get(`/programs/${id}`).then(r => r.data),
  create: (data) => api.post('/programs', data).then(r => r.data),
  update: (id, data) => api.put(`/programs/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/programs/${id}`).then(r => r.data),
};

export const casesApi = {
  getAll: (page = 1, limit = 20, options = {}) => api.get(`/cases?page=${page}&limit=${limit}`, options).then(r => r.data),
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
  triageCase: (data, options = {}) => api.post('/ai/triage-case', data, options).then(r => r.data),
  dispatchVolunteer: (data, options = {}) => api.post('/ai/dispatch-volunteer', data, options).then(r => r.data),
  grantReport: (data, options = {}) => api.post('/ai/grant-report', data, options).then(r => r.data),
  incidentCluster: (data, options = {}) => api.post('/ai/incident-cluster', data, options).then(r => r.data),
  inventoryRestock: (data, options = {}) => api.post('/ai/inventory-restock', data, options).then(r => r.data),
  impactReport: (data, options = {}) => api.post('/ai/impact-report', data, options).then(r => r.data),
  beneficiaryNeeds: (data, options = {}) => api.post('/ai/beneficiary-needs', data, options).then(r => r.data),
  grantApplication: (data, options = {}) => api.post('/ai/grant-application', data, options).then(r => r.data),
  programEvaluation: (data, options = {}) => api.post('/ai/program-evaluation', data, options).then(r => r.data),
  caseResolutionPredict: (data, options = {}) => api.post('/ai/case-resolution-predict', data, options).then(r => r.data),
  donationForecast: (data, options = {}) => api.post('/ai/donation-forecast', data, options).then(r => r.data),
  shiftOptimization: (data, options = {}) => api.post('/ai/shift-optimization', data, options).then(r => r.data),
  programRiskAssessment: (data, options = {}) => api.post('/ai/program-risk-assessment', data, options).then(r => r.data),
  getHistory: (page = 1, limit = 20) => api.get(`/ai/history?page=${page}&limit=${limit}`).then(r => r.data),
  // Apply pass 5 — full backlog
  translate: (data, options = {}) => api.post('/ai/multi-language/translate', data, options).then(r => r.data),
  bulkSms: (data, options = {}) => api.post('/ai/bulk-sms', data, options).then(r => r.data),
  bulkEmail: (data, options = {}) => api.post('/ai/bulk-email', data, options).then(r => r.data),
  reportCasesCsv: (options = {}) => api.get('/ai/reports/cases.csv', { ...options, responseType: 'blob' }).then(r => r.data),
  reportDonationsCsv: (options = {}) => api.get('/ai/reports/donations.csv', { ...options, responseType: 'blob' }).then(r => r.data),
  auditTrailLog: (data, options = {}) => api.post('/ai/audit-trail/log', data, options).then(r => r.data),
  auditTrailList: (limit = 100, options = {}) => api.get(`/ai/audit-trail?limit=${limit}`, options).then(r => r.data),
  uploadFieldPhoto: (data, options = {}) => api.post('/ai/field-photo', data, options).then(r => r.data),
  listFieldPhotos: (limit = 50, options = {}) => api.get(`/ai/field-photos?limit=${limit}`, options).then(r => r.data),
};

export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats').then(r => r.data),
};

export default api;
