import api from './index';

// Trigger AI analysis on a specific audit response
export const triggerAiAnalysis = (responseId) =>
  api.post(`/analysis/trigger`, { responseId });

export const getAiAnalysis = (responseId) =>
  api.get(`/analysis/${responseId}`);
