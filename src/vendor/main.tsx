import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { VendorPage } from './VendorPage';
import './vendor.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <VendorPage />
  </StrictMode>,
);
