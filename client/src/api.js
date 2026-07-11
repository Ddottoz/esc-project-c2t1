const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5001/api';

async function post(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Request failed. Please try again.');
  }
  return data;
}

export const login = (email, password) => post('/auth/login', { email, password });

export const signup = (name, email, password, confirmPassword) =>
  post('/auth/signup', { name, email, password, confirmPassword });

export function saveSession({ token, user }) {
  localStorage.setItem('das_token', token);
  localStorage.setItem('das_user', JSON.stringify(user));
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem('das_user'));
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem('das_token');
  localStorage.removeItem('das_user');
}
