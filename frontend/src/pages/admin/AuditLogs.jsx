import React, { useEffect, useState } from 'react';
import { adminService } from '../../services/api';
import Card from '../../components/Card';
import Table from '../../components/Table';
import Badge from '../../components/Badge';
import { LoadingState } from '../../components/Spinner';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminService
      .getAuditLogs()
      .then((res) => {
        if (res.success) setLogs(res.data.logs || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <LoadingState message="Cargando bitácora de auditoría inmutable..." />;
  }

  return (
    <div className="space-y-space-md max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="bg-surface-container-lowest p-space-lg rounded-xl border border-surface-container-high shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="bce" iconName="security">
              Pista de Auditoría Fiduciaria
            </Badge>
            <span className="font-badge-label text-[11px] text-on-surface-variant uppercase">
              Registros Inmutables
            </span>
          </div>
          <h1 className="font-headline-lg text-[24px] sm:text-[28px] text-primary font-bold">
            Auditoría de Operaciones del Sistema
          </h1>
          <p className="font-body-sm text-[13px] text-on-surface-variant mt-0.5">
            Trazabilidad completa de operaciones críticas: creación de créditos, cambios de tasas, validaciones y accesos de usuarios.
          </p>
        </div>
      </div>

      <Card title={`Bitácora de Eventos Registrados (${logs.length})`}>
        {logs.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-on-surface-variant">
            No hay registros de auditoría aún.
          </p>
        ) : (
          <Table
            headers={[
              'Fecha y Hora',
              'Usuario',
              'Rol',
              'Acción Realizada',
              'Entidad / Objeto',
              { label: 'Dirección IP', align: 'text-right' },
            ]}
          >
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-surface-container-low/40 transition-colors">
                <td className="py-3 px-4 text-[12px] text-on-surface font-numeric-data">
                  {new Date(log.fecha).toLocaleString('es-EC')}
                </td>
                <td className="py-3 px-4 font-bold text-primary font-body-sm text-[13px]">
                  {log.usuario}
                </td>
                <td className="py-3 px-4">
                  <Badge
                    variant={log.rol === 'ADMIN' ? 'alert' : log.rol === 'ASESOR' ? 'bce' : 'default'}
                    size="sm"
                  >
                    {log.rol || 'PÚBLICO'}
                  </Badge>
                </td>
                <td className="py-3 px-4 font-numeric-data font-bold text-secondary text-[13px]">
                  {log.accion}
                </td>
                <td className="py-3 px-4 text-[12px] text-on-surface font-body-sm">
                  {log.entidad} {log.entidadId ? `(#${log.entidadId.slice(0, 8)})` : ''}
                </td>
                <td className="py-3 px-4 text-right text-[12px] text-on-surface-variant font-numeric-data">
                  {log.ip || '127.0.0.1'}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
