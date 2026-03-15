import api from './index';

export const getQuestions = (params = {}) =>
  api.get('/question/questions', { params });

export const createQuestion = (data) =>
  api.post('/question/create', data);

export const updateQuestion = (id, data) =>
  api.put(`/question/update/${id}`, data);

export const deleteQuestion = (id) =>
  api.delete(`/question/delete/${id}`);
