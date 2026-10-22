import '~/assets/style.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '../popup/App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Side panel renders the same App; CSS gives it full viewport width */}
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <App />
    </div>
  </React.StrictMode>,
);
