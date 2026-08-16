import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { FabricObject } from 'fabric';
import { registerAcetrumProperties } from '@acetrumtech/svg-to-fabric';
import { App } from './App.js';
import './styles.css';

// Once, at start-up. Without this Fabric drops the `acetrum` metadata — and the
// layer names with it — the first time the host serializes the canvas.
registerAcetrumProperties(FabricObject);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
