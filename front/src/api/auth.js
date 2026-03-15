import api from './index';

export const signin = (email, password) =>
  api.post('/auth/login', { email, password });

export const signup = async (payload) =>{
  console.log(payload)
  const response = await api.post('/auth/signup', payload);
   console.log(response.data)
}
  

