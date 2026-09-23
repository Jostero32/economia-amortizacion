import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminService, publicService } from '../../services/api';
import Card from '../../components/Card';
import Table from '../../components/Table';
import Button from '../../components/Button';
import Badge from '../../components/Badge';
import { LoadingState } from '../../components/Spinner';

export default function AdminDashboard() {
  const [creditApps, setCreditApps] = useState([]);
  const [investmentApps, setInvestmentApps] = useState([]);
  const [users, setUsers] = useState([]);
  const [creditProducts, setCreditProducts] = useState([]);
  const [investmentProducts, setInvestmentProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      adminService.getApplications(),
      adminService.getUsers(),
      publicService.getCreditProducts(),
      publicService.getInvestmentProducts(),
    ])
      .then(([appsRes, usersRes, creditsRes, invRes]) => {
        if (appsRes.success) {
          setCreditApps(appsRes.data.creditApplications || []);
          setInvestmentApps(appsRes.data.investmentApplications || []);
        }
        if (usersRes.success) {
          setUsers(usersRes.data.users || []);
        }
        if (creditsRes.success) {
          setCreditProducts(creditsRes.data.products || []);
        }
        if (invRes.success) {
          setInvestmentProducts(invRes.data.products || []);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalApps = creditApps.length + investmentApps.length;
  const pendingApps = [...creditApps, ...investmentApps].filter(
    (a) => a.estado === 'PENDIENTE' || a.estado === 'EN_REVISION' || a.estado === 'PENDIENTE_DOCUMENTOS'
  ).length;
  const approvedApps = [...creditApps, ...investmentApps].filter((a) => a.estado === 'APROBADA').length;

  const formatUSD = (val) =>
    new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(val || 0);

  const recentApplications = [
    ...creditApps.map((application) => ({ ...application, applicationType: 'CREDITO' })),
    ...investmentApps.map((application) => ({ ...application, applicationType: 'INVERSION' })),
  ]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 6);

  if (loading) {
    return <LoadingState message="Cargando panel de administración..." />;
  }

  return (
    <div className="space-y-space-md max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="bg-surface-container-lowest p-space-lg rounded-xl border border-surface-container-high shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="alert" iconName="admin_panel_settings">
              Gestión Institucional
            </Badge>
          </div>
          <h1 className="font-headline-lg text-[24px] sm:text-[28px] text-primary font-bold">
            Panel de Control y Supervisión
          </h1>
          <p className="font-body-sm text-[13px] text-on-surface-variant mt-0.5">
            Supervisión de solicitudes de crédito e inversión, validaciones biométricas y control de tasas regulatorias.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/admin/solicitudes">
            <Button variant="fintech" size="sm" iconName="assignment">
              Revisar Solicitudes
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
        <Card hover className="p-5" bodyClassName="p-0">
          <div className="flex items-center justify-between">
            <span className="font-badge-label text-[11px] uppercase text-on-surface-variant">
              Solicitudes Pendientes
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">pending_actions</span>
            </div>
          </div>
          <div className="font-numeric-hero text-[28px] text-amber-800 font-bold mt-2">
            {pendingApps}
          </div>
          <span className="font-body-sm text-[11px] text-on-surface-variant">
            Requieren revisión del asesor
          </span>
        </Card>

        <Card hover className="p-5" bodyClassName="p-0">
          <div className="flex items-center justify-between">
            <span className="font-badge-label text-[11px] uppercase text-on-surface-variant">
              Solicitudes Aprobadas
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">verified</span>
            </div>
          </div>
          <div className="font-numeric-hero text-[28px] text-emerald-800 font-bold mt-2">
            {approvedApps}
          </div>
          <span className="font-body-sm text-[11px] text-on-surface-variant">
            De un total de {totalApps} solicitudes
          </span>
        </Card>

        <Card hover className="p-5" bodyClassName="p-0">
          <div className="flex items-center justify-between">
            <span className="font-badge-label text-[11px] uppercase text-on-surface-variant">
              Productos de Crédito
            </span>
            <div className="w-8 h-8 rounded-lg bg-surface-container-high text-secondary flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">credit_card</span>
            </div>
          </div>
          <div className="font-numeric-hero text-[28px] text-primary font-bold mt-2">
            {creditProducts.length}
          </div>
          <span className="font-body-sm text-[11px] text-on-surface-variant">
            Con tasas activas reguladas
          </span>
        </Card>

        <Card hover className="p-5" bodyClassName="p-0">
          <div className="flex items-center justify-between">
            <span className="font-badge-label text-[11px] uppercase text-on-surface-variant">
              Productos de Inversión
            </span>
            <div className="w-8 h-8 rounded-lg bg-surface-container-high text-secondary flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">savings</span>
            </div>
          </div>
          <div className="font-numeric-hero text-[28px] text-primary font-bold mt-2">
            {investmentProducts.length}
          </div>
          <span className="font-body-sm text-[11px] text-on-surface-variant">
            Depósitos a plazo fijo (DPF)
          </span>
        </Card>
      </div>

      {/* Solicitudes para Asesor */}
      <Card
        title="Solicitudes que requieren atención del Asesor"
        subtitle="Verificación de documentos probatorios y validación biométrica simulada"
        action={
          <Link
            to="/admin/solicitudes"
            className="font-title-md text-[13px] text-secondary hover:underline flex items-center gap-1"
          >
            <span>Ver todas las solicitudes</span>
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </Link>
        }
      >
        {recentApplications.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-on-surface-variant">
            No hay solicitudes pendientes en este momento.
          </p>
        ) : (
          <Table
            headers={[
              'Código',
              'Solicitante',
              'Producto',
              { label: 'Monto', align: 'text-right' },
              'Estado',
              'Biometría',
              { label: 'Acción', align: 'text-right' },
            ]}
          >
            {recentApplications.map((app) => (
              <tr key={app.id} className="hover:bg-surface-container-low/40 transition-colors">
                <td className="py-3 px-4 font-bold text-primary font-numeric-data">
                  {app.codigo || app.id.slice(0, 8)}
                </td>
                <td className="py-3 px-4">
                  <div className="font-bold text-primary text-[13px]">
                    {app.nombres} {app.apellidos}
                  </div>
                  <div className="text-[11px] text-on-surface-variant font-numeric-data">
                    C.I: {app.cedula}
                  </div>
                </td>
                <td className="py-3 px-4 text-on-surface font-body-sm text-[13px]">
                  {app.applicationType === 'INVERSION'
                    ? app.product?.nombre || 'Inversión'
                    : app.creditType?.nombre || 'Crédito'}
                </td>
                <td className="py-3 px-4 text-right font-numeric-data font-bold text-primary">
                  {formatUSD(app.monto)}
                </td>
                <td className="py-3 px-4">
                  <Badge variant={app.estado}>{app.estado}</Badge>
                </td>
                <td className="py-3 px-4 text-[12px]">
                  {app.biometriaValidada ? (
                    <span className="text-emerald-800 font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">check_circle</span>
                      Validada
                    </span>
                  ) : (
                    <span className="text-amber-800 font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">schedule</span>
                      Pendiente
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-right">
                  <Link to={app.applicationType === 'INVERSION' ? `/admin/solicitudes/inversion/${app.id}` : `/admin/solicitudes/${app.id}`}>
                    <Button variant="fintech" size="sm">
                      Revisar
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
