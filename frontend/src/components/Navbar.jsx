import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useInstitution } from '../context/InstitutionContext';

export default function Navbar() {
  const { user, isAuthenticated, logout, isAdmin, isAdvisor } = useAuth();
  const { institution, logoUrl } = useInstitution();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
    setMobileMenuOpen(false);
  };

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <header className="fixed top-0 left-0 right-0 w-full z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)]">
      <div className="h-20 max-w-[1440px] mx-auto px-4 sm:px-8 flex items-center justify-between gap-4">
        {/* Logo oficial agrandado y sin texto duplicado */}
        <Link
          to="/"
          onClick={() => setMobileMenuOpen(false)}
          className="flex items-center flex-shrink-0 group py-2"
        >
          <img
            src={logoUrl}
            alt={`Logo de ${institution.nombre}`}
            className="h-11 sm:h-12 w-auto object-contain transition-transform group-hover:scale-[1.02]"
            onLoad={(e) => { e.currentTarget.style.display = 'block'; }}
            onError={(e) => {
              e.target.onerror = null;
              e.target.style.display = 'none';
            }}
          />
          <span className="hidden xl:block ml-3 max-w-48 truncate text-[15px] font-bold text-primary">
            {institution.nombre}
          </span>
        </Link>

        {/* Navegación Desktop */}
        <nav className="hidden md:flex items-center gap-2 lg:gap-3">
          <Link
            to="/"
            className={`px-3.5 py-2 text-[15px] font-medium transition-colors relative ${
              isActive('/') && location.pathname === '/'
                ? 'text-secondary font-semibold'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            Inicio
            {isActive('/') && location.pathname === '/' && (
              <span className="absolute bottom-0 left-3.5 right-3.5 h-0.5 bg-secondary rounded-full" />
            )}
          </Link>

          <Link
            to="/creditos"
            className={`px-3.5 py-2 text-[15px] font-medium transition-colors relative ${
              isActive('/creditos') && location.pathname === '/creditos'
                ? 'text-secondary font-semibold'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            Créditos
            {isActive('/creditos') && location.pathname === '/creditos' && (
              <span className="absolute bottom-0 left-3.5 right-3.5 h-0.5 bg-secondary rounded-full" />
            )}
          </Link>

          <Link
            to="/creditos/simulador"
            className={`px-3.5 py-2 text-[15px] font-medium transition-colors relative ${
              isActive('/creditos/simulador')
                ? 'text-secondary font-semibold'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            Simulador
            {isActive('/creditos/simulador') && (
              <span className="absolute bottom-0 left-3.5 right-3.5 h-0.5 bg-secondary rounded-full" />
            )}
          </Link>

          <Link
            to="/inversiones"
            className={`px-3.5 py-2 text-[15px] font-medium transition-colors relative ${
              isActive('/inversiones')
                ? 'text-secondary font-semibold'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            Inversiones
            {isActive('/inversiones') && (
              <span className="absolute bottom-0 left-3.5 right-3.5 h-0.5 bg-secondary rounded-full" />
            )}
          </Link>
        </nav>

        {/* Acciones Derecha */}
        <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <Link
                to={isAdmin || isAdvisor ? '/admin' : '/cliente'}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[14px] font-medium text-primary hover:bg-gray-100 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px] text-secondary">
                  {isAdmin || isAdvisor ? 'admin_panel_settings' : 'account_circle'}
                </span>
                <span>{isAdmin ? 'Panel Admin' : isAdvisor ? 'Panel Asesor' : 'Mi Cuenta'}</span>
              </Link>
              <span className="text-[13px] text-on-surface-variant hidden lg:inline font-medium">
                {user.nombre}
              </span>
              <button
                onClick={handleLogout}
                title="Cerrar sesión"
                className="p-2 text-on-surface-variant hover:text-error hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[20px]">logout</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="px-3.5 py-2 text-[14px] font-medium text-on-surface-variant hover:text-primary transition-colors"
              >
                Iniciar sesión
              </Link>
              <Link
                to="/register"
                className="px-3.5 py-2 text-[14px] font-medium text-on-surface-variant hover:text-primary transition-colors"
              >
                Registrarse
              </Link>
              <Link
                to="/creditos/simulador"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-[14px] font-semibold rounded-lg bg-secondary text-white hover:bg-secondary-container transition-all shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">calculate</span>
                <span>Simular crédito</span>
              </Link>
            </div>
          )}
        </div>

        {/* Botón Móvil */}
        <div className="flex sm:hidden items-center gap-2">
          <Link
            to="/creditos/simulador"
            className="px-3 py-1.5 text-[13px] font-semibold rounded-lg bg-secondary text-white"
          >
            Simular
          </Link>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-primary hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Abrir menú"
          >
            <span className="material-symbols-outlined text-[24px]">
              {mobileMenuOpen ? 'close' : 'menu'}
            </span>
          </button>
        </div>
      </div>

      {/* Menú Móvil */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-t border-gray-100 bg-white px-4 py-4 space-y-2 shadow-lg">
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className={`block px-3 py-2 rounded-lg text-[14px] font-medium ${
              isActive('/') && location.pathname === '/'
                ? 'bg-blue-50 text-secondary font-semibold'
                : 'text-on-surface-variant hover:bg-gray-50'
            }`}
          >
            Inicio
          </Link>
          <Link
            to="/creditos"
            onClick={() => setMobileMenuOpen(false)}
            className={`block px-3 py-2 rounded-lg text-[14px] font-medium ${
              isActive('/creditos') && location.pathname === '/creditos'
                ? 'bg-blue-50 text-secondary font-semibold'
                : 'text-on-surface-variant hover:bg-gray-50'
            }`}
          >
            Créditos
          </Link>
          <Link
            to="/creditos/simulador"
            onClick={() => setMobileMenuOpen(false)}
            className={`block px-3 py-2 rounded-lg text-[14px] font-medium ${
              isActive('/creditos/simulador')
                ? 'bg-blue-50 text-secondary font-semibold'
                : 'text-on-surface-variant hover:bg-gray-50'
            }`}
          >
            Simulador de Crédito
          </Link>
          <Link
            to="/inversiones"
            onClick={() => setMobileMenuOpen(false)}
            className={`block px-3 py-2 rounded-lg text-[14px] font-medium ${
              isActive('/inversiones')
                ? 'bg-blue-50 text-secondary font-semibold'
                : 'text-on-surface-variant hover:bg-gray-50'
            }`}
          >
            Inversiones
          </Link>

          <div className="pt-3 border-t border-gray-100 space-y-2">
            {isAuthenticated ? (
              <>
                <Link
                  to={isAdmin || isAdvisor ? '/admin' : '/cliente'}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 rounded-lg text-[14px] font-medium text-primary hover:bg-gray-50"
                >
                  {isAdmin ? 'Panel Admin' : isAdvisor ? 'Panel Asesor' : 'Mi Cuenta'} ({user.nombre})
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2 rounded-lg text-[14px] font-medium text-error hover:bg-red-50"
                >
                  Cerrar sesión
                </button>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center py-2 text-[14px] font-medium rounded-lg border border-gray-200 text-primary hover:bg-gray-50"
                >
                  Iniciar sesión
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center py-2 text-[14px] font-medium rounded-lg border border-gray-200 text-primary hover:bg-gray-50"
                >
                  Registrarse
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
