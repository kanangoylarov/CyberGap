import api from './index';

export const getUserResponses = (userId, params = {}) =>
  api.get(`/responses/user/${userId}`, { params });

export const createResponse = (formData) =>
  api.post('/responses', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const updateResponse = (id, formData) =>
  api.put(`/responses/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const deleteResponse = (id) =>
  api.delete(`/responses/${id}`);
