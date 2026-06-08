import axios from "axios";

// When served by FastAPI at http://127.0.0.1:7072/app, keep baseURL '' (same origin).
// When running `npm start` on :3000, set REACT_APP_API_BASE=http://127.0.0.1:7072 in .env.local
const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE || "",
  // If you want the refresh_token cookie when using dev server:
  // withCredentials: true,
});

export default api;

