import api from './index';

export const getUsers = (params = {}) =>
  api.get('/auth/users', { params });
