import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import AgentsPage from './pages/AgentsPage';
import ApprovalsPage from './pages/ApprovalsPage';
import AttackSimulatorPage from './pages/AttackSimulatorPage';
import AuditLogsPage from './pages/AuditLogsPage';
import DashboardPage from './pages/DashboardPage';
import KillSwitchPage from './pages/KillSwitchPage';
import LandingPage from './pages/LandingPage';
import LiveMonitoringPage from './pages/LiveMonitoringPage';
import LoginPage from './pages/LoginPage';
import PoliciesPage from './pages/PoliciesPage';
import SettingsPage from './pages/SettingsPage';
import ThreatsPage from './pages/ThreatsPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/google-login" element={<LoginPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/gmail" element={<Navigate to="/simulator" replace />} />
          <Route path="/monitoring" element={<LiveMonitoringPage />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/threats" element={<ThreatsPage />} />
          <Route path="/approvals" element={<ApprovalsPage />} />
          <Route path="/policies" element={<PoliciesPage />} />
          <Route path="/audit" element={<AuditLogsPage />} />
          <Route path="/simulator" element={<AttackSimulatorPage />} />
          <Route path="/kill-switch" element={<KillSwitchPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
