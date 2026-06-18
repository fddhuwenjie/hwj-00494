import axios from 'axios';

const request = axios.create({
  baseURL: '/api',
  timeout: 30000
});

request.interceptors.response.use(
  response => response.data,
  error => {
    console.error('请求错误:', error);
    return Promise.reject(error);
  }
);

export const personApi = {
  list: (params) => request.get('/persons', { params }),
  detail: (id) => request.get(`/persons/${id}`),
  create: (data) => request.post('/persons', data),
  update: (id, data) => request.put(`/persons/${id}`, data),
  delete: (id) => request.delete(`/persons/${id}`),
  search: (name) => request.get('/queries/search', { params: { name } })
};

export const relationshipApi = {
  addParentChild: (data) => request.post('/relationships/parent-child', data),
  addMarriage: (data) => request.post('/relationships/marriage', data),
  addSibling: (data) => request.post('/relationships/sibling', data),
  addChild: (data) => request.post('/relationships/add-child', data),
  deleteParentChild: (id) => request.delete(`/relationships/parent-child/${id}`),
  deleteMarriage: (id) => request.delete(`/relationships/marriage/${id}`),
  updateMarriage: (id, data) => request.put(`/relationships/marriage/${id}`, data),
  getAll: () => request.get('/relationships/all')
};

export const queryApi = {
  relationshipPath: (person1_id, person2_id) => 
    request.get('/queries/relationship-path', { params: { person1_id, person2_id } }),
  descendants: (id, include_self) => 
    request.get(`/queries/descendants/${id}`, { params: { include_self } }),
  ancestors: (id, include_self) => 
    request.get(`/queries/ancestors/${id}`, { params: { include_self } }),
  generationStats: () => request.get('/queries/generation-stats'),
  longestChain: () => request.get('/queries/longest-chain'),
  familyStats: () => request.get('/queries/family-stats'),
  timeline: () => request.get('/queries/timeline'),
  treeData: () => request.get('/queries/tree-data')
};

export const exportApi = {
  exportGedcom: () => {
    return request.get('/export/gedcom', { responseType: 'blob' });
  },
  importGedcom: (content) => request.post('/export/gedcom', { content }),
  exportPng: () => {
    return request.get('/export/png', { responseType: 'blob' });
  },
  exportPdf: () => {
    return request.get('/export/pdf', { responseType: 'blob' });
  }
};

export const shareApi = {
  create: (data) => request.post('/share/create', data),
  validate: (token) => request.get(`/share/validate/${token}`),
  list: () => request.get('/share/list'),
  delete: (id) => request.delete(`/share/${id}`)
};

export default request;
