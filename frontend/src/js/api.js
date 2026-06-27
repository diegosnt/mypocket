const BASE_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3000'
  : '';

async function request(path, options = {}) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.reload();
    return;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unexpected error' }));
    throw new Error(err.error || 'Request failed');
  }

  return res.status === 204 ? null : res.json();
}

export const api = {
  categories: {
    getAll: () => request('/api/categories'),
    create: (body) => request('/api/categories', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => request(`/api/categories/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id) => request(`/api/categories/${id}`, { method: 'DELETE' }),
  },
  auth: {
    register: (body) =>
      request('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
    login: (body) =>
      request('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  },
  transactions: {
    getAll: () => request('/api/transactions'),
    create: (body) =>
      request('/api/transactions', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) =>
      request(`/api/transactions/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id) =>
      request(`/api/transactions/${id}`, { method: 'DELETE' }),
  },
};
