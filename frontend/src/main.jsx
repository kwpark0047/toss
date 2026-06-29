import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import './i18n';
import { wakeupServer } from './api/index.js';

// Render 콜드스타트 대비: 앱 로드 즉시 서버 웨이크업 (논블로킹)
if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
  wakeupServer();
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
