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
  btn.textContent = loading ? 'Please wait…' : btn.dataset.originalText;
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
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const formLogin = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');
  const errorLogin = document.getElementById('error-login');
  const errorRegister = document.getElementById('error-register');

  tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    formLogin.hidden = false;
    formRegister.hidden = true;
    clearError(errorLogin);
    clearError(errorRegister);
  });

  tabRegister.addEventListener('click', () => {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    formRegister.hidden = false;
    formLogin.hidden = true;
    clearError(errorLogin);
    clearError(errorRegister);
  });

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

  formRegister.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError(errorRegister);
    const btn = formRegister.querySelector('button[type="submit"]');
    setLoading(btn, true);
    try {
      const data = await api.auth.register({
        name: formRegister.fullname.value.trim(),
        email: formRegister.email.value.trim(),
        password: formRegister.password.value,
      });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      onAuthenticated(data.user);
    } catch (err) {
      showError(errorRegister, err.message);
    } finally {
      setLoading(btn, false);
    }
  });
}
