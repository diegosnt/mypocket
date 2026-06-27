import { api } from './api.js';

const viewAuth = document.getElementById('view-auth');
const viewDashboard = document.getElementById('view-dashboard');

export function showAuth() {
  viewAuth.hidden = false;
  viewDashboard.hidden = true;
}

export function showDashboard() {
  viewAuth.hidden = true;
  viewDashboard.hidden = false;
}

function setLoading(btn, loading) {
  btn.disabled = loading;
  btn.dataset.originalText = btn.dataset.originalText || btn.textContent;
  btn.textContent = loading ? 'Espere…' : btn.dataset.originalText;
}

function showError(el, message) {
  el.textContent = message;
  el.hidden = false;
}

function clearError(el) {
  el.textContent = '';
  el.hidden = true;
}

export function initAuth(onAuthenticated) {
  const formLogin = document.getElementById('form-login');
  const errorLogin = document.getElementById('error-login');

  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError(errorLogin);
    const btn = formLogin.querySelector('button[type="submit"]');
    setLoading(btn, true);
    try {
      const data = await api.auth.login({
        email: formLogin.email.value.trim(),
        password: formLogin.password.value,
      });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      onAuthenticated(data.user);
    } catch (err) {
      showError(errorLogin, err.message);
    } finally {
      setLoading(btn, false);
    }
  });
}
