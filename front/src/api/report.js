import api from './index';

export const getMyReport = () => api.get('/report/my-report');

export const getAllQuestionsGrouped = () => api.get('/question/all-grouped');

export const bulkSubmitAnswers = (answers) => api.post('/audit/bulk-submit', { answers });

export const uploadFileForQuestion = (questionId, file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post(`/audit/upload-file/${questionId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const triggerAnalysis = () => api.post('/report/analyze');

export const getEvaluation = () => api.get('/report/evaluation');
