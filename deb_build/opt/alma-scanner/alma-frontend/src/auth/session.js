// src/auth/session.js
const KEY = "access_token";

export function getToken() {
  return localStorage.getItem(KEY);
}

export function setToken(token) {
  localStorage.setItem(KEY, token);
}

export function clearToken() {
  localStorage.removeItem(KEY);
}

export function isAuthed() {
  return Boolean(getToken());
}

export function logout(redirectTo = "/app/login") {
  clearToken();
  window.location.replace(redirectTo);
}
