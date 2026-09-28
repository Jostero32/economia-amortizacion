import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ mode = 'client' }) {
  const { user, isAdmin } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const clientLinks = [
    { to: '/cliente', label: 'Mi Resumen', iconName: 'dashboard', end: true },
    { to: '/cliente/solicitudes', label: 'Mis Solicitudes', iconName: 'description' },
    { to: '/cliente/simulaciones', label: 'Mis Simulaciones', iconName: 'history' },
    { to: '/cliente/verificacion', label: 'Mi Identidad', iconName: 'verified_user' },
    { to: '/cliente/perfil', label: 'Mi Perfil', iconName: 'person' },
    { to: '/creditos/simulador', label: 'Simular Crédito', iconName: 'calculate' },
    { to: '/inversiones/simulador', label: 'Simular Inversión', iconName: 'trending_up' },
  ];

  const adminLinks = [
    { to: '/admin', label: 'Panel General', iconName: 'analytics', end: true, role: 'ASESOR' },
    { to: '/admin/solicitudes', label: 'Solicitudes', iconName: 'assignment', role: 'ASESOR' },
    { to: '/admin/verificaciones', label: 'Verificaciones', iconName: 'verified_user', role: 'ASESOR' },
    { to: '/admin/documentos', label: 'Documentos', iconName: 'folder_shared', role: 'ASESOR' },
    { to: '/admin/usuarios', label: 'Usuarios y Accesos', iconName: 'group', role: 'ASESOR' },

    // Exclusivo ADMIN
    { to: '/admin/institucion', label: 'Config. Institución', iconName: 'account_balance', role: 'ADMIN' },
    { to: '/admin/creditos', label: 'Productos de Crédito', iconName: 'credit_card', role: 'ADMIN' },
    { to: '/admin/tasas', label: 'Tasas Oficiales BCE', iconName: 'balance', role: 'ADMIN' },
    { to: '/admin/cobros', label: 'Cobros y SOLCA', iconName: 'receipt_long', role: 'ADMIN' },
    { to: '/admin/inversiones', label: 'Productos Inversión', iconName: 'savings', role: 'ADMIN' },
    { to: '/admin/audit', label: 'Auditoría del Sistema', iconName: 'security', role: 'ADMIN' },
  ];

  const links = mode === 'admin' ? adminLinks : clientLinks;

  return (
    <aside className="w-full md:w-64 bg-white border-b md:border-r border-gray-100 md:min-h-[calc(100vh-5rem)] p-3 md:p-4 flex flex-col flex-shrink-0">
      {/* User Session Box */}
      <div className="px-3.5 py-2.5 md:mb-4 bg-gray-50 rounded-lg border border-gray-100 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-[13px] flex-shrink-0">
          {user?.nombre ? user.nombre.charAt(0).toUpperCase() : 'U'}
        </div>
        <div className="overflow-hidden flex-1">
          <div className="font-semibold text-[13px] text-primary truncate leading-tight">
            {user?.nombre || 'Usuario'}
          </div>
          <div className="text-[11px] text-secondary font-semibold uppercase tracking-wider mt-0.5">
            {user?.rol || 'CLIENTE'}
          </div>
        </div>
        <button type="button" className="md:hidden rounded px-2 py-1 text-[13px] text-secondary font-semibold"
          aria-expanded={mobileOpen} aria-controls={`sidebar-nav-${mode}`} onClick={() => setMobileOpen((open) => !open)}>
          {mobileOpen ? 'Cerrar menú' : 'Menú'}
        </button>
      </div>

      {/* Navigation list */}
      <nav id={`sidebar-nav-${mode}`} className={`${mobileOpen ? 'block' : 'hidden'} md:block space-y-1 flex-1 mt-3 md:mt-0`}>
        {links.map((link) => {
          if (link.role === 'ADMIN' && !isAdmin) return null;

          return (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
                  isActive
                    ? 'bg-blue-50 text-secondary font-semibold'
                    : 'text-on-surface-variant hover:bg-gray-50 hover:text-primary'
                }`
              }
            >
              <span className="material-symbols-outlined text-[18px]">
                {link.iconName}
              </span>
              <span>{link.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
