import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App.js';
import {
  MON_ALERT_RESOLVE,
  MON_IMPROVEMENT_PLAN_MANAGE,
  MON_TRACKING_SESSION_CREATE,
  type MonitoringUserContext,
} from './contracts/remote-props.js';
import { demoCatalogs } from './adapter/out/mock-monitoring-client.js';
import { createMockAlertsClient } from './adapter/out/mock-alerts-client.js';
import { MOCK_FICHA_OPTIONS } from './adapter/out/mock-tracking-client.js';

/** Solo modo independiente (npm run dev): en produccion el shell entrega el usuario real. */
const DEMO_USER: MonitoringUserContext = {
  instructorId: 'mock-instructor-1',
  capabilities: [MON_TRACKING_SESSION_CREATE, MON_ALERT_RESOLVE, MON_IMPROVEMENT_PLAN_MANAGE],
};

const container = document.getElementById('root');

if (container) {
  createRoot(container).render(
    <StrictMode>
      <App
        httpClient={import.meta.env.DEV ? createMockAlertsClient() : undefined}
        catalogs={import.meta.env.DEV ? demoCatalogs : undefined}
        fichaOptions={import.meta.env.DEV ? MOCK_FICHA_OPTIONS : undefined}
        user={import.meta.env.DEV ? DEMO_USER : undefined}
      />
    </StrictMode>,
  );
}