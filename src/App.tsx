import { useEffect, useMemo, useState, type FC } from 'react';

import type { MonitoringMfeProps } from './contracts/remote-props.js';
import { AlertsPlansApiAdapter } from './adapter/out/alerts-plans-api-adapter.js';
import { FichaTrackingApiAdapter } from './adapter/out/ficha-tracking-api-adapter.js';
import { MonitoringApiAdapter } from './adapter/out/monitoring-api-adapter.js';
import { AlertsPlansPage } from './adapter/in/pages/AlertsPlansPage.js';
import { FichaTrackingPage } from './adapter/in/pages/FichaTrackingPage.js';
import { MonitoringCatalogsPage } from './adapter/in/pages/MonitoringCatalogsPage.js';
import { MonitoringKpiPage } from './adapter/in/pages/MonitoringKpiPage.js';
import styles from './App.module.css';

type AppView = 'tracking' | 'alerts' | 'catalogs' | 'kpis';

const NAV: Array<{ id: AppView; label: string }> = [
  { id: 'tracking', label: 'Seguimiento de ficha' },
  { id: 'alerts', label: 'Alertas y planes' },
  { id: 'catalogs', label: 'Parametrización' },
  { id: 'kpis', label: 'Panel de indicadores' },
];

const App: FC<MonitoringMfeProps> = ({ httpClient, catalogs, user, fichaId, fichaLabel, fichaOptions }) => {
  const hasFichaSource = Boolean(fichaId) || (fichaOptions?.length ?? 0) > 0;
  const [view, setView] = useState<AppView>(hasFichaSource ? 'tracking' : 'catalogs');
  const apis = useMemo(
    () => (httpClient
      ? {
          catalogs: new MonitoringApiAdapter(httpClient),
          tracking: new FichaTrackingApiAdapter(httpClient),
          alerts: new AlertsPlansApiAdapter(httpClient),
        }
      : null),
    [httpClient],
  );

  useEffect(() => {
    if (fichaId) setView('tracking');
  }, [fichaId]);

  return (
    <div className={styles.root} data-mfe="monitoring">
      {apis ? (
        <>
          <nav className={styles.appNavigation} aria-label="Módulos de Monitoring">
            {NAV.map((item) => (
              <button
                key={item.id}
                className={`${styles.appNavButton} ${view === item.id ? styles.appNavActive : ''}`}
                type="button"
                aria-current={view === item.id ? 'page' : undefined}
                onClick={() => setView(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
          {view === 'tracking' ? (
            <FichaTrackingPage
              trackingApi={apis.tracking}
              catalogApi={apis.catalogs}
              {...(fichaId ? { fichaId } : {})}
              {...(fichaLabel ? { fichaLabel } : {})}
              {...(fichaOptions ? { fichaOptions } : {})}
              {...(user ? { user } : {})}
            />
          ) : view === 'alerts' ? (
            <AlertsPlansPage alertsApi={apis.alerts} catalogApi={apis.catalogs} {...(user ? { user } : {})} />
          ) : view === 'catalogs' ? (
            <MonitoringCatalogsPage api={apis.catalogs} />
          ) : (
            <MonitoringKpiPage httpClient={httpClient} catalogs={catalogs} />
          )}
        </>
      ) : (
        <section className={styles.configurationState} role="alert">
          <h1>Monitoring</h1>
          <p>El shell debe proporcionar el cliente HTTP de frontend-platform para consultar Monitoring.</p>
        </section>
      )}
    </div>
  );
};

export default App;