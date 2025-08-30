import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Orders from './pages/Orders';
import Products from './pages/Products';
import Materials from './pages/Materials';
import Expenses from './pages/Expenses';
import Reports from './pages/Reports';
import Users from './pages/Users';
import Settings from './pages/Settings';
import Sales from './pages/Sales';
import Rewards from './pages/Rewards';
import { UserRole } from './types';

function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route 
              path="/" 
              element={
                <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.STAFF, UserRole.VIEWER]}>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="sales" element={
                <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.STAFF]}>
                  <Sales />
                </ProtectedRoute>
              } />
              <Route path="customers" element={
                 <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.STAFF]}>
                  <Customers />
                </ProtectedRoute>
              } />
              <Route path="orders" element={
                 <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.STAFF]}>
                  <Orders />
                </ProtectedRoute>
              }/>
              <Route path="products" element={
                <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.STAFF]}>
                  <Products />
                </ProtectedRoute>
              } />
               <Route path="materials" element={
                <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
                  <Materials />
                </ProtectedRoute>
              } />
              <Route path="expenses" element={
                <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
                  <Expenses />
                </ProtectedRoute>
              } />
              <Route path="reports" element={
                <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
                  <Reports />
                </ProtectedRoute>
              } />
              <Route path="rewards" element={
                 <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
                  <Rewards />
                </ProtectedRoute>
              } />
              <Route path="users" element={
                <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
                  <Users />
                </ProtectedRoute>
              } />
              <Route path="settings" element={
                <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
                  <Settings />
                </ProtectedRoute>
              } />
            </Route>
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </HashRouter>
      </AppProvider>
    </AuthProvider>
  );
}

export default App;
