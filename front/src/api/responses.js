import api from './index';

export const getUserResponses = (params = {}) =>
  api.get('/audit/responses', { params });

export const createResponse = (formData) =>
  api.post('/audit/submit', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const updateResponse = (id, formData) =>
  api.put(`/audit/update/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const deleteResponse = (id) =>
  api.delete(`/audit/delete/${id}`);
