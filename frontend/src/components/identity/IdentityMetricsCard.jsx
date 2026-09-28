import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminService } from '../../services/api';
import Card from '../Card';
import Alert from '../Alert';
import Button from '../Button';

const number = (value) => Number(value).toLocaleString('es-EC', { maximumFractionDigits: 2 });

/** Resumen de verificaciones y motivos de revisión; su carga es independiente del resto del panel. */
export default function IdentityMetricsCard() {
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return adminService.getIdentityMetrics().then((response) => setMetrics(response.data))
      .catch((err) => setError(err.message || 'No pudimos cargar las métricas de identidad.'))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const maxDistanceCount = Math.max(1, ...(metrics?.distanciasAprobadas || []).map((range) => range.cantidad));
  return (
    <Card title="Verificación de identidad" iconName="verified_user" action={
      <Link to="/admin/verificaciones" className="text-[13px] text-secondary hover:underline">Revisar verificaciones →</Link>
    }>
      {loading ? <p className="text-[13px] text-gray-500" role="status">Cargando métricas de identidad...</p>
        : error ? <Alert type="warning">{error}<Button variant="ghost" size="sm" onClick={load}>Volver a cargar</Button></Alert>
          : metrics && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-[13px]">
                <Link to="/admin/verificaciones" className="rounded-lg bg-amber-50 p-3 text-amber-900 hover:underline">
                  <span className="block">Por revisar</span>
                  <strong className="block text-2xl">{metrics.porEstado.EN_REVISION}</strong>
                </Link>
                <div className="rounded-lg bg-emerald-50 p-3 text-emerald-900">
                  <span className="block">Aprobación automática</span>
                  <strong className="block text-2xl">{number(metrics.porcentajeAutomatico)} %</strong>
                  <span className="text-[11px]">{metrics.aprobadasAutomaticas} de {metrics.porEstado.APROBADA} aprobadas</span>
                </div>
                <div className="rounded-lg bg-rose-50 p-3 text-rose-900">
                  <span className="block">Rechazadas</span>
                  <strong className="block text-2xl">{metrics.porEstado.RECHAZADA}</strong>
                </div>
                <div className="rounded-lg bg-surface-container-low p-3 text-primary">
                  <span className="block">Tiempo promedio de revisión</span>
                  <strong className="block text-2xl">{metrics.tiempoPromedioRevisionHoras === null ? '—' : `${number(metrics.tiempoPromedioRevisionHoras)} h`}</strong>
                  <span className="text-[11px]">{metrics.tiempoPromedioRevisionHoras === null ? 'Sin revisiones del asesor' : 'Desde el inicio hasta la decisión del asesor'}</span>
                </div>
              </div>
              <p className="text-[12px] text-gray-600">
                {metrics.total} verificaciones · {metrics.porEstado.EN_CURSO} en curso · {metrics.porEstado.APROBADA} aprobadas
                {' · '}{metrics.tiposCedula.ELECTRONICA} cédulas electrónicas · {metrics.tiposCedula.ANTIGUA} del modelo anterior
              </p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div>
                  <h3 className="text-[14px] font-semibold text-primary mb-2">Motivos frecuentes de revisión o rechazo</h3>
                  {metrics.motivosFrecuentes.length ? (
                    <ul className="space-y-2 text-[13px]">
                      {metrics.motivosFrecuentes.map(({ motivo, cantidad }) => (
                        <li key={motivo} className="flex justify-between gap-3"><span className="text-gray-600">{motivo}</span><strong>{cantidad}</strong></li>
                      ))}
                    </ul>
                  ) : <p className="text-[13px] text-gray-500">Todavía no hay motivos de revisión o rechazo.</p>}
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold text-primary mb-2">Distancias faciales de las aprobadas</h3>
                  <ul className="space-y-2 text-[12px]">
                    {metrics.distanciasAprobadas.map(({ desde, hasta, cantidad }, index) => (
                      <li key={hasta} className="flex items-center gap-3">
                        <span className="w-28 shrink-0">{index ? '> ' : ''}{number(desde)} a {number(hasta)}</span>
                        <div className="flex-1 h-3 rounded bg-gray-100 overflow-hidden" aria-hidden="true">
                          <div className="h-full bg-secondary rounded" style={{ width: `${cantidad / maxDistanceCount * 100}%` }} />
                        </div>
                        <span className="w-8 text-right font-semibold">{cantidad}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-gray-500 mt-2">Cada tramo incluye su límite superior. Se muestran distancias de 0 a 0,60.</p>
                </div>
              </div>
            </div>
          )}
    </Card>
  );
}
