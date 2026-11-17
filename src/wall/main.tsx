import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { WallPage } from './WallPage';
import './wall.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WallPage />
  </StrictMode>,
);
