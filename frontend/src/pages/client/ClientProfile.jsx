import React from 'react';
import { useAuth } from '../../context/AuthContext';
import Card from '../../components/Card';
import Badge from '../../components/Badge';

export default function ClientProfile() {
  const { user } = useAuth();

  return (
    <div className="max-w-3xl mx-auto space-y-space-md">
      {/* Header */}
      <div className="bg-surface-container-lowest p-space-lg rounded-xl border border-surface-container-high shadow-xs">
        <h1 className="font-headline-lg text-[24px] text-primary font-bold">Perfil de Usuario</h1>
        <p className="font-body-sm text-[13px] text-on-surface-variant mt-0.5">
          Información personal registrada en la plataforma institucional.
        </p>
      </div>

      <Card>
        <div className="space-y-6">
          {/* User Header */}
          <div className="flex items-center gap-4 pb-6 border-b border-surface-container-low">
            <div className="w-16 h-16 rounded-2xl bg-primary-container text-on-primary flex items-center justify-center font-bold text-[22px] shadow-sm">
              {user?.nombre?.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h3 className="font-title-md text-[18px] text-primary font-bold">{user?.nombre}</h3>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant={user?.rol === 'ADMIN' ? 'alert' : user?.rol === 'ASESOR' ? 'bce' : 'seps'}>
                  {user?.rol || 'CLIENTE'}
                </Badge>
                <span className="font-body-sm text-[11px] text-on-surface-variant">
                  Usuario Activo
                </span>
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md text-[13px]">
            <div className="p-3.5 rounded-lg bg-surface-container-low border border-surface-container-high/60 space-y-1">
              <span className="text-on-surface-variant flex items-center gap-1.5 font-badge-label text-[11px] uppercase">
                <span className="material-symbols-outlined text-[16px] text-secondary">mail</span>
                Correo Electrónico
              </span>
              <p className="font-semibold text-primary">{user?.email}</p>
            </div>

            <div className="p-3.5 rounded-lg bg-surface-container-low border border-surface-container-high/60 space-y-1">
              <span className="text-on-surface-variant flex items-center gap-1.5 font-badge-label text-[11px] uppercase">
                <span className="material-symbols-outlined text-[16px] text-secondary">badge</span>
                Cédula de Identidad
              </span>
              <p className="font-numeric-data font-bold text-primary">{user?.cedula || 'No registrada'}</p>
            </div>

            <div className="p-3.5 rounded-lg bg-surface-container-low border border-surface-container-high/60 space-y-1">
              <span className="text-on-surface-variant flex items-center gap-1.5 font-badge-label text-[11px] uppercase">
                <span className="material-symbols-outlined text-[16px] text-secondary">phone</span>
                Teléfono de Contacto
              </span>
              <p className="font-numeric-data font-semibold text-primary">{user?.telefono || 'No registrado'}</p>
            </div>

            <div className="p-3.5 rounded-lg bg-surface-container-low border border-surface-container-high/60 space-y-1">
              <span className="text-on-surface-variant flex items-center gap-1.5 font-badge-label text-[11px] uppercase">
                <span className="material-symbols-outlined text-[16px] text-secondary">shield</span>
                Nivel de Autorización
              </span>
              <p className="font-semibold text-primary">
                {user?.rol === 'ADMIN'
                  ? 'Administrador Integral del Sistema'
                  : user?.rol === 'ASESOR'
                  ? 'Asesor de Crédito y Verificación Biometría'
                  : 'Cliente Final Registrado'}
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
