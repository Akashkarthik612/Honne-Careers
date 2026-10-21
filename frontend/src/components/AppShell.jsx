import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { flushPendingSaves } from '@/services/applicationSaver';
import Sidebar from './Sidebar';
import { ErrorBanner } from './Status';

// Layout for every signed-in screen: sidebar on the left, the routed page on the right.
// On entering the app, downloads that couldn't be saved to the Database last time are retried once each
// (applicationSaver.js, Day 2 fallback C). One that can never be saved is reported, not dropped silently.
export default function AppShell() {
  const [lost, setLost] = useState(0);

  useEffect(() => {
    let live = true;
    flushPendingSaves().then((r) => { if (live && r.dropped.length) setLost(r.dropped.length); });
    return () => { live = false; };
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--hc-app-ground)', display: 'flex' }}>
      <Sidebar />
      <div style={{ flex: '1 1 0', minWidth: 0 }}>
        {lost > 0 && (
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px' }}>
            <ErrorBanner
              error={`${lost === 1 ? 'A download' : `${lost} downloads`} couldn’t be saved to your Database. Open the CV and download it again to save it.`}
              action={{ label: 'Dismiss', onClick: () => setLost(0) }}
            />
          </div>
        )}
        <Outlet />
      </div>
    </div>
  );
}
