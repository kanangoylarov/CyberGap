import api from './index';

export const getQuestions = (params = {}) =>
  api.get('/questions', { params });

export const createQuestion = (data) =>
  api.post('/questions', data);

export const updateQuestion = (id, data) =>
  api.put(`/questions/${id}`, data);

export const deleteQuestion = (id) =>
  api.delete(`/questions/${id}`);
