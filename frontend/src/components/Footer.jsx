import React from 'react';
import { Link } from 'react-router-dom';
import { useInstitution } from '../context/InstitutionContext';

export default function Footer() {
  const { institution, logoUrl } = useInstitution();

  return (
    <footer className="bg-primary text-white font-body-sm text-[13px] border-t border-white/10 mt-auto">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-10">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <img
              src={logoUrl}
              alt={`Logo de ${institution.nombre}`}
              className="h-9 w-auto object-contain brightness-0 invert"
              onLoad={(e) => { e.currentTarget.style.display = 'block'; }}
              onError={(e) => {
                e.target.onerror = null;
                e.target.style.display = 'none';
              }}
            />
            <div className="h-6 w-px bg-white/20 hidden sm:block"></div>
            <span className="text-blue-100/80 text-[13px]">
              Simulador financiero académico para Ecuador
            </span>
          </div>

          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[14px]">
            <Link to="/" className="text-blue-100/80 hover:text-white transition-colors">
              Inicio
            </Link>
            <Link to="/creditos" className="text-blue-100/80 hover:text-white transition-colors">
              Créditos
            </Link>
            <Link to="/creditos/simulador" className="text-blue-100/80 hover:text-white transition-colors">
              Simulador
            </Link>
            <Link to="/inversiones" className="text-blue-100/80 hover:text-white transition-colors">
              Inversiones
            </Link>
          </nav>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[12px] text-blue-200/60 text-center sm:text-left">
          <p>© {new Date().getFullYear()} {institution.nombre} • Tasas referenciales y techos regulados por el BCE y SEPS</p>
          <p>Las simulaciones son académicas e informativas; no constituyen oferta vinculante.</p>
        </div>
      </div>
    </footer>
  );
}
