import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/landing/LandingPage';
import SignInPage from './pages/SignInPage';
import StudioPage from './pages/studio/StudioPage';
import ProfilePage from './pages/ProfilePage';

// Auth is not wired yet (backend P1, AUTH-1), so the app routes are open.
export default function App() {
  return (
    <Routes>
      <Route path="/"        element={<LandingPage />} />
      <Route path="/login"   element={<SignInPage />} />
      <Route path="/home"    element={<StudioPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="*"        element={<Navigate to="/" replace />} />
    </Routes>
  );
}
