import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { adminService } from '../../services/api';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Table from '../../components/Table';
import Alert from '../../components/Alert';
import EmptyState from '../../components/EmptyState';
import { LoadingState } from '../../components/Spinner';
import IdentityBadge from '../../components/identity/IdentityBadge';
import { formatDateTime } from '../../utils/format';

const TABS = [
  { estado: 'EN_REVISION', label: 'Por revisar' },
  { estado: 'EN_CURSO', label: 'En curso' },
  { estado: 'APROBADA', label: 'Aprobadas' },
  { estado: 'RECHAZADA', label: 'Rechazadas' },
  { estado: '', label: 'Todas' },
];

const FACE_TEXT = { COINCIDE: 'Coincide', DUDOSO: 'Dudoso', NO_COINCIDE: 'No coincide' };

/** Cola de verificaciones de identidad para el asesor. */
export default function IdentityVerificationsList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const estado = searchParams.get('estado') ?? 'EN_REVISION';
  const [data, setData] = useState({ verifications: [], counts: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    adminService.getIdentityVerifications(estado || undefined)
      .then((response) => { setData(response.data); setError(null); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [estado]);

  const total = Object.values(data.counts || {}).reduce((sum, n) => sum + n, 0);

  return (
    <div className="space-y-space-md max-w-[1440px] mx-auto">
      <div className="bg-surface-container-lowest p-space-lg rounded-xl border border-surface-container-high shadow-xs">
        <h1 className="font-headline-lg text-[24px] sm:text-[28px] text-primary font-bold">Verificaciones de identidad</h1>
        <p className="text-[13px] text-on-surface-variant mt-0.5">
          Casos que la verificación automática no pudo resolver y el historial de verificaciones de los clientes.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const count = tab.estado ? data.counts?.[tab.estado] || 0 : total;
          const active = tab.estado === estado;
          return (
            <button
              key={tab.label}
              type="button"
              onClick={() => setSearchParams(tab.estado === 'EN_REVISION' ? {} : { estado: tab.estado })}
              className={`px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-colors ${
                active ? 'bg-secondary text-white border-secondary' : 'bg-white text-primary border-gray-200 hover:bg-gray-50'
              }`}
            >
              {tab.label} <span className={active ? 'opacity-90' : 'text-gray-400'}>({count})</span>
            </button>
          );
        })}
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <Card bodyClassName="p-0">
        {loading ? (
          <LoadingState message="Cargando verificaciones..." />
        ) : data.verifications.length === 0 ? (
          <EmptyState
            iconName="verified_user"
            title={estado === 'EN_REVISION' ? 'No hay verificaciones por revisar' : 'No hay verificaciones en este estado'}
            description={estado === 'EN_REVISION' ? 'Los casos que requieran tu revisión aparecerán aquí.' : 'Prueba con otro filtro.'}
            className="m-4"
          />
        ) : (
          <Table headers={['Cliente', 'Cédula registrada', 'Estado', 'Rostro', 'Intentos', 'Actualizada', { label: 'Acción', align: 'text-right' }]}>
            {data.verifications.map((v) => (
              <tr key={v.id} className="hover:bg-surface-container-low/40 transition-colors">
                <td className="py-3 px-4">
                  <strong className="block text-[13px] text-primary">{v.user?.nombre}</strong>
                  <span className="text-[11px] text-on-surface-variant">{v.user?.email}</span>
                </td>
                <td className="py-3 px-4 font-numeric-data text-[13px]">{v.user?.cedula || '—'}</td>
                <td className="py-3 px-4">
                  <div className="flex flex-col gap-1 items-start">
                    <IdentityBadge identidad={{ estado: v.estado, verificada: v.estado === 'APROBADA' }} />
                    {v.aprobacionAutomatica && <span className="text-[11px] text-emerald-700">Automática</span>}
                  </div>
                </td>
                <td className="py-3 px-4 text-[12px]">
                  {v.rostro ? `${FACE_TEXT[v.rostro.resultado]} · ${Math.round(v.rostro.nivel)} %` : '—'}
                </td>
                <td className="py-3 px-4 text-[12px]">{v.intentos}</td>
                <td className="py-3 px-4 text-[12px] text-on-surface-variant">{formatDateTime(v.updatedAt)}</td>
                <td className="py-3 px-4 text-right">
                  <Link to={`/admin/verificaciones/${v.id}`}>
                    <Button variant={v.estado === 'EN_REVISION' ? 'fintech' : 'outline'} size="sm" iconName={v.estado === 'EN_REVISION' ? 'rate_review' : 'visibility'}>
                      {v.estado === 'EN_REVISION' ? 'Revisar' : 'Ver'}
                    </Button>
                  </Link>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
