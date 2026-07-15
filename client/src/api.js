// Express 中介 API 的 axios wrapper
import axios from 'axios';
import { currentEnv } from './store';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || 'http://localhost:3000/api',
  timeout: 30000,
  // 4xx/5xx 交由畫面統一呈現（紅色卡片 + OperationOutcome）
  validateStatus: () => true
});

// 每個請求帶上目前選擇的 FHIR Server 環境
api.interceptors.request.use((req) => {
  req.headers['X-FHIR-Env'] = currentEnv.value;
  return req;
});

export default api;
