import { Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/AppShell';
import RequireAuth from './components/RequireAuth';
import LandingPage from './pages/landing/LandingPage';
import SignInPage from './pages/SignInPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import HomePage from './pages/HomePage';
import ResumesPage from './pages/ResumesPage';
import TemplatePage from './pages/new/TemplatePage';
import ModePage from './pages/new/ModePage';
import JdPage from './pages/new/JdPage';
import WizardPage from './pages/new/WizardPage';
import TailoringPage from './pages/new/TailoringPage';
import CvReadyPage from './pages/cv/CvReadyPage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';
import DatabasePage from './pages/DatabasePage';

// Landing, sign-in and the OAuth callback are public; every app screen needs a signed-in user (AUTH-1).
export default function App() {
  return (
    <Routes>
      <Route path="/"      element={<LandingPage />} />
      <Route path="/login" element={<SignInPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route path="/home"         element={<HomePage />} />
        <Route path="/resumes"      element={<ResumesPage />} />
        <Route path="/new/template" element={<TemplatePage />} />
        <Route path="/new/mode"     element={<ModePage />} />
        <Route path="/new/jd"       element={<JdPage />} />
        <Route path="/new/details"  element={<WizardPage />} />
        <Route path="/tailoring/:id" element={<TailoringPage />} />
        <Route path="/cv/:id"       element={<CvReadyPage />} />
        <Route path="/profile"      element={<ProfilePage />} />
        <Route path="/database"     element={<DatabasePage />} />
        <Route path="/settings"     element={<SettingsPage />} />
      </Route>
      <Route path="*"     element={<Navigate to="/" replace />} />
    </Routes>
  );
}
