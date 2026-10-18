import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

// Layout for every signed-in screen: sidebar on the left, the routed page on the right.
export default function AppShell() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--hc-app-ground)', display: 'flex' }}>
      <Sidebar />
      <div style={{ flex: '1 1 0', minWidth: 0 }}>
        <Outlet />
      </div>
    </div>
  );
}
