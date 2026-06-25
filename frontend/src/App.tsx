import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from './store';

// Layout & Pages
import SidebarLayout from './layouts/SidebarLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ConnectWhatsAppPage from './pages/ConnectWhatsAppPage';
import CreateCampaignPage from './pages/CreateCampaignPage';
import MonitorCampaignPage from './pages/MonitorCampaignPage';
import HistoryPage from './pages/HistoryPage';

// Protected Route Guard
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

// Guest Route Guard (Redirect logged-in users away from Auth screens)
const GuestRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  return !isAuthenticated ? <>{children}</> : <Navigate to="/" replace />;
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Guest Routes */}
        <Route 
          path="/login" 
          element={
            <GuestRoute>
              <LoginPage />
            </GuestRoute>
          } 
        />
        <Route 
          path="/register" 
          element={
            <GuestRoute>
              <RegisterPage />
            </GuestRoute>
          } 
        />

        {/* Authenticated Workspace Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <SidebarLayout>
                <DashboardPage />
              </SidebarLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/connect"
          element={
            <ProtectedRoute>
              <SidebarLayout>
                <ConnectWhatsAppPage />
              </SidebarLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/create-campaign"
          element={
            <ProtectedRoute>
              <SidebarLayout>
                <CreateCampaignPage />
              </SidebarLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/monitor/:id"
          element={
            <ProtectedRoute>
              <SidebarLayout>
                <MonitorCampaignPage />
              </SidebarLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <SidebarLayout>
                <HistoryPage />
              </SidebarLayout>
            </ProtectedRoute>
          }
        />

        {/* Catch-all Redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
