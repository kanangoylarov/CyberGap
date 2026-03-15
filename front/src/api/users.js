import api from './index';

export const getUsers = (params = {}) =>
  api.get('/users', { params });
