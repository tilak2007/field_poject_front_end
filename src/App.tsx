import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Layout } from './components/layout/Layout';
import { LandingPage } from './pages/LandingPage';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { SalesReps } from './pages/SalesReps';
import { Retailers } from './pages/Retailers';
import { Distributors } from './pages/Distributors';
import { Products } from './pages/Products';
import { Inventory } from './pages/Inventory';
import { Orders } from './pages/Orders';
import { BeatPlans } from './pages/BeatPlans';
import BeatPlanPage from '@/pages/BeatPlanPage';
import { Visits } from './pages/Visits';
import { Attendance } from './pages/Attendance';
import { Targets } from './pages/Targets';
import { Analytics } from './pages/Analytics';
import { Reports } from './pages/Reports';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Home Page (TypingClub style Hero & Moon Landing) */}
          <Route path="/" element={<LandingPage />} />

          {/* Public Login Page (Edclub style centered auth card) */}
          <Route path="/login" element={<Login />} />

          {/* Protected Application Portal */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/admin/dashboard" element={<Dashboard />} />
            <Route
              path="/reps"
              element={
                <ProtectedRoute allowedRoles={['System Admin', 'Sales Manager']}>
                  <SalesReps />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reps/:id"
              element={
                <ProtectedRoute allowedRoles={['System Admin', 'Sales Manager']}>
                  <SalesReps />
                </ProtectedRoute>
              }
            />
            <Route path="/retailers" element={<Retailers />} />
            <Route path="/retailers/:id" element={<Retailers />} />
            <Route
              path="/distributors"
              element={
                <ProtectedRoute allowedRoles={['System Admin', 'Sales Manager']}>
                  <Distributors />
                </ProtectedRoute>
              }
            />
            <Route path="/products" element={<Products />} />
            <Route
              path="/inventory"
              element={
                <ProtectedRoute allowedRoles={['System Admin', 'Sales Manager']}>
                  <Inventory />
                </ProtectedRoute>
              }
            />
            <Route path="/orders" element={<Orders />} />
            <Route path="/beat-plans" element={<BeatPlans />} />
            <Route path="/beat-plan" element={<BeatPlanPage />} />
            <Route path="/visits" element={<Visits />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/rep/attendance" element={<Attendance />} />
            <Route path="/targets" element={<Targets />} />
            <Route path="/analytics" element={<Analytics />} />
            
            {/* Reports - Restricted to System Admin and Sales Manager */}
            <Route
              path="/reports"
              element={
                <ProtectedRoute allowedRoles={['System Admin', 'Sales Manager']}>
                  <Reports />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
