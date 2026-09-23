import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Layouts
import PublicLayout from '../layouts/PublicLayout';
import ClientLayout from '../layouts/ClientLayout';
import AdminLayout from '../layouts/AdminLayout';

// Protection wrappers
import ProtectedRoute from './ProtectedRoute';
import PublicRoute from './PublicRoute';

// Public Pages
import Home from '../pages/public/Home';
import CreditCatalog from '../pages/public/CreditCatalog';
import CreditSimulator from '../pages/public/CreditSimulator';
import CreditSimulationResult from '../pages/public/CreditSimulationResult';
import InvestmentCatalog from '../pages/public/InvestmentCatalog';
import InvestmentSimulator from '../pages/public/InvestmentSimulator';
import InvestmentSimulationResult from '../pages/public/InvestmentSimulationResult';
import Login from '../pages/public/Login';
import Register from '../pages/public/Register';
import NotFound from '../pages/public/NotFound';

// Client Pages
import ClientDashboard from '../pages/client/ClientDashboard';
import ClientApplications from '../pages/client/ClientApplications';
import ClientApplicationDetail from '../pages/client/ClientApplicationDetail';
import ClientInvestmentApplicationDetail from '../pages/client/ClientInvestmentApplicationDetail';
import ClientSimulations from '../pages/client/ClientSimulations';
import ClientProfile from '../pages/client/ClientProfile';

// Admin Pages
import AdminDashboard from '../pages/admin/AdminDashboard';
import InstitutionConfig from '../pages/admin/InstitutionConfig';
import CreditTypesList from '../pages/admin/CreditTypesList';
import CreditTypeForm from '../pages/admin/CreditTypeForm';
import RatesConfig from '../pages/admin/RatesConfig';
import ChargesConfig from '../pages/admin/ChargesConfig';
import InvestmentProductsList from '../pages/admin/InvestmentProductsList';
import ApplicationsList from '../pages/admin/ApplicationsList';
import ApplicationDetail from '../pages/admin/ApplicationDetail';
import InvestmentApplicationDetail from '../pages/admin/InvestmentApplicationDetail';
import DocumentsList from '../pages/admin/DocumentsList';
import UsersList from '../pages/admin/UsersList';
import AuditLogs from '../pages/admin/AuditLogs';

export default function AppRouter() {
  return (
    <Routes>
      {/* 1. RUTAS PÚBLICAS (Navegables sin autenticación) */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/creditos" element={<CreditCatalog />} />
        <Route path="/creditos/simulador" element={<CreditSimulator />} />
        <Route path="/creditos/simulador/:id" element={<CreditSimulationResult />} />
        <Route path="/inversiones" element={<InvestmentCatalog />} />
        <Route path="/inversiones/simulador" element={<InvestmentSimulator />} />
        <Route path="/inversiones/simulador/:id" element={<InvestmentSimulationResult />} />

        {/* Login y Register protegidos para que usuarios autenticados no entren */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          }
        />
        <Route path="/404" element={<NotFound />} />
      </Route>

      {/* 2. RUTAS PROTEGIDAS DE CLIENTE */}
      <Route
        path="/cliente"
        element={
          <ProtectedRoute allowedRoles={['CLIENTE']}>
            <ClientLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ClientDashboard />} />
        <Route path="solicitudes" element={<ClientApplications />} />
        <Route path="solicitudes/:id" element={<ClientApplicationDetail />} />
        <Route path="inversiones/:id" element={<ClientInvestmentApplicationDetail />} />
        <Route path="simulaciones" element={<ClientSimulations />} />
        <Route path="perfil" element={<ClientProfile />} />
      </Route>

      {/* 3. RUTAS PROTEGIDAS DE ADMINISTRADOR / ASESOR */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['ASESOR', 'ADMIN']}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="solicitudes" element={<ApplicationsList />} />
        <Route path="solicitudes/:id" element={<ApplicationDetail />} />
        <Route path="solicitudes/inversion/:id" element={<InvestmentApplicationDetail />} />
        <Route path="documentos" element={<DocumentsList />} />
        <Route path="usuarios" element={<UsersList />} />

        {/* Exclusivo ADMIN */}
        <Route
          path="institucion"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <InstitutionConfig />
            </ProtectedRoute>
          }
        />
        <Route
          path="creditos"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <CreditTypesList />
            </ProtectedRoute>
          }
        />
        <Route
          path="creditos/nuevo"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <CreditTypeForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="creditos/:id"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <CreditTypeForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="tasas"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <RatesConfig />
            </ProtectedRoute>
          }
        />
        <Route
          path="cobros"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <ChargesConfig />
            </ProtectedRoute>
          }
        />
        <Route
          path="inversiones"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <InvestmentProductsList />
            </ProtectedRoute>
          }
        />
        <Route
          path="audit"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AuditLogs />
            </ProtectedRoute>
          }
        />
        <Route
          path="auditoria"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AuditLogs />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Ruta comodín */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
