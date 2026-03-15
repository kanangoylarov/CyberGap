const TOKEN_KEY = 'grc_token';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

async function request(url, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('grc_user');
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  const data = await response.json();
  return data;
}

export function get(url) {
  return request(url, { method: 'GET' });
}

export function post(url, body) {
  return request(url, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function del(url) {
  return request(url, { method: 'DELETE' });
}
