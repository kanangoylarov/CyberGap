import api from './index';

export const signin = (email, password) =>
  api.post('/auth/signin', { email, password });

export const signup = (payload) =>
  api.post('/auth/signup', payload);

export const signout = () =>
  api.post('/auth/signout');

export const getRole = () =>
  api.get('/auth/role');
