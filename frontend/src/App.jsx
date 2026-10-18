import { Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/AppShell';
import LandingPage from './pages/landing/LandingPage';
import SignInPage from './pages/SignInPage';
import ResumesPage from './pages/ResumesPage';
import TemplatePage from './pages/new/TemplatePage';
import ModePage from './pages/new/ModePage';
import JdPage from './pages/new/JdPage';
import WizardPage from './pages/new/WizardPage';
import TailoringPage from './pages/new/TailoringPage';
import CvReadyPage from './pages/cv/CvReadyPage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';

// Auth is not wired yet (backend P1, AUTH-1), so the app routes are open.
export default function App() {
  return (
    <Routes>
      <Route path="/"      element={<LandingPage />} />
      <Route path="/login" element={<SignInPage />} />
      <Route element={<AppShell />}>
        <Route path="/resumes"      element={<ResumesPage />} />
        <Route path="/new/template" element={<TemplatePage />} />
        <Route path="/new/mode"     element={<ModePage />} />
        <Route path="/new/jd"       element={<JdPage />} />
        <Route path="/new/details"  element={<WizardPage />} />
        <Route path="/tailoring"    element={<TailoringPage />} />
        <Route path="/cv/:id"       element={<CvReadyPage />} />
        <Route path="/profile"      element={<ProfilePage />} />
        <Route path="/settings"     element={<SettingsPage />} />
      </Route>
      <Route path="/home" element={<Navigate to="/resumes" replace />} />
      <Route path="*"     element={<Navigate to="/" replace />} />
    </Routes>
  );
}
