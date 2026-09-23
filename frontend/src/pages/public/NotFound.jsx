import React from 'react';
import { Link } from 'react-router-dom';
import Button from '../../components/Button';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-space-xl max-w-md mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-surface-container-high flex items-center justify-center text-secondary mb-4 shadow-xs">
        <span className="material-symbols-outlined text-[36px]">error_outline</span>
      </div>
      <h1 className="font-headline-lg text-[28px] text-primary font-bold">
        Página no encontrada
      </h1>
      <p className="font-body-md text-[14px] text-on-surface-variant mt-2 mb-6 leading-relaxed">
        La ruta financiera o recurso solicitado no existe o fue reubicado dentro de la plataforma.
      </p>
      <Link to="/">
        <Button variant="fintech" iconName="home">
          Volver al inicio
        </Button>
      </Link>
    </div>
  );
}
