import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { clientService } from '../../services/api';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Badge from '../../components/Badge';
import Table from '../../components/Table';
import { LoadingState } from '../../components/Spinner';

export default function ClientDashboard() {
  const { user } = useAuth();
  const [creditApps, setCreditApps] = useState([]);
  const [investmentApps, setInvestmentApps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      clientService.getMyCreditApplications(),
      clientService.getMyInvestmentApplications(),
    ])
      .then(([creRes, invRes]) => {
        if (creRes.success) setCreditApps(creRes.data.applications || []);
        if (invRes.success) setInvestmentApps(invRes.data.applications || []);
      })
      .catch((err) => console.error(err))
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
    .slice(0, 5);

  if (loading) {
    return <LoadingState message="Cargando panel de cliente..." />;
  }

  return (
    <div className="space-y-space-md">
      {/* Welcome Banner */}
      <div className="bg-primary text-on-primary p-6 sm:p-8 rounded-xl shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-primary-container relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-40 h-40 rounded-full bg-secondary opacity-15 pointer-events-none"></div>

        <div className="z-10">
          <Badge variant="bce" size="sm" iconName="account_circle" className="mb-2">
            Portal Oficial de Cliente
          </Badge>
          <h1 className="font-headline-lg text-[26px] sm:text-[32px] text-white font-bold leading-tight">
            Bienvenido, {user?.nombre}!
          </h1>
          <p className="font-body-md text-[13px] text-surface-variant mt-1 max-w-xl leading-relaxed">
            Gestiona tus solicitudes de crédito e inversión, revisa el estado de tus trámites y sube tus documentos para validación fiduciaria.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5 z-10">
          <Link to="/creditos/simulador">
            <Button variant="fintech" size="md" iconName="calculate">
              Simular crédito
            </Button>
          </Link>
          <Link to="/inversiones/simulador">
            <Button variant="secondary" size="md" iconName="trending_up">
              Simular inversión
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md">
        <Card hover className="p-5" bodyClassName="p-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-surface-container-high flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-[26px]">description</span>
            </div>
            <div>
              <span className="font-badge-label text-[11px] text-on-surface-variant uppercase">
                Mis Solicitudes
              </span>
              <div className="font-numeric-hero text-[28px] text-primary font-bold">
                {totalApps}
              </div>
            </div>
          </div>
        </Card>

        <Card hover className="p-5" bodyClassName="p-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-amber-50 flex items-center justify-center text-amber-700">
              <span className="material-symbols-outlined text-[26px]">pending_actions</span>
            </div>
            <div>
              <span className="font-badge-label text-[11px] text-on-surface-variant uppercase">
                En Revisión / Pendiente
              </span>
              <div className="font-numeric-hero text-[28px] text-amber-800 font-bold">
                {pendingApps}
              </div>
            </div>
          </div>
        </Card>

        <Card hover className="p-5" bodyClassName="p-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700">
              <span className="material-symbols-outlined text-[26px]">verified</span>
            </div>
            <div>
              <span className="font-badge-label text-[11px] text-on-surface-variant uppercase">
                Solicitudes Aprobadas
              </span>
              <div className="font-numeric-hero text-[28px] text-emerald-800 font-bold">
                {approvedApps}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Access Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link
          to="/creditos/simulador"
          className="p-3.5 rounded-lg bg-surface-container-lowest border border-surface-container-high hover:border-secondary transition-colors flex items-center gap-2.5 shadow-2xs"
        >
          <span className="material-symbols-outlined text-secondary text-[20px]">calculate</span>
          <span className="font-title-md text-[13px] text-primary">Simular crédito</span>
        </Link>
        <Link
          to="/inversiones/simulador"
          className="p-3.5 rounded-lg bg-surface-container-lowest border border-surface-container-high hover:border-secondary transition-colors flex items-center gap-2.5 shadow-2xs"
        >
          <span className="material-symbols-outlined text-secondary text-[20px]">trending_up</span>
          <span className="font-title-md text-[13px] text-primary">Simular inversión</span>
        </Link>
        <Link
          to="/cliente/solicitudes"
          className="p-3.5 rounded-lg bg-surface-container-lowest border border-surface-container-high hover:border-secondary transition-colors flex items-center gap-2.5 shadow-2xs"
        >
          <span className="material-symbols-outlined text-secondary text-[20px]">list_alt</span>
          <span className="font-title-md text-[13px] text-primary">Mis solicitudes</span>
        </Link>
        <Link
          to="/cliente/perfil"
          className="p-3.5 rounded-lg bg-surface-container-lowest border border-surface-container-high hover:border-secondary transition-colors flex items-center gap-2.5 shadow-2xs"
        >
          <span className="material-symbols-outlined text-secondary text-[20px]">person</span>
          <span className="font-title-md text-[13px] text-primary">Mi perfil</span>
        </Link>
      </div>

      {/* Solicitudes Recientes */}
      <Card
        title="Mis Solicitudes Recientes"
        action={
          <Link
            to="/cliente/solicitudes"
            className="font-title-md text-[13px] text-secondary hover:underline flex items-center gap-1"
          >
            <span>Ver todas</span>
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </Link>
        }
      >
        {creditApps.length === 0 && investmentApps.length === 0 ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-surface-container-low mx-auto flex items-center justify-center text-on-surface-variant">
              <span className="material-symbols-outlined text-[24px]">folder_open</span>
            </div>
            <p className="font-body-sm text-[13px] text-on-surface-variant">
              Aún no has registrado solicitudes de crédito o inversión.
            </p>
            <Link to="/creditos/simulador">
              <Button variant="fintech" size="sm" iconName="calculate">
                Simular crédito ahora
              </Button>
            </Link>
          </div>
        ) : (
          <Table
            headers={[
              'Código',
              'Producto',
              { label: 'Monto', align: 'text-right' },
              'Plazo',
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
                <td className="py-3 px-4 text-on-surface font-medium font-body-sm">
                  {app.applicationType === 'INVERSION'
                    ? app.product?.nombre || 'Inversión'
                    : app.creditType?.nombre || 'Crédito'}
                </td>
                <td className="py-3 px-4 text-right font-numeric-data font-bold text-primary">
                  {formatUSD(app.monto)}
                </td>
                <td className="py-3 px-4 font-numeric-data text-on-surface-variant">
                  {app.applicationType === 'INVERSION' ? `${app.plazoDias} días` : `${app.plazoMeses} meses`}
                </td>
                <td className="py-3 px-4">
                  <Badge variant={app.estado}>{app.estado}</Badge>
                </td>
                <td className="py-3 px-4 font-body-sm text-[12px]">
                  {app.biometriaValidada ? (
                    <span className="text-emerald-800 font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">check_circle</span>
                      Validada
                    </span>
                  ) : (
                    <span className="text-on-surface-variant">Pendiente</span>
                  )}
                </td>
                <td className="py-3 px-4 text-right">
                  <Link to={app.applicationType === 'INVERSION' ? `/cliente/inversiones/${app.id}` : `/cliente/solicitudes/${app.id}`}>
                    <Button variant="outline" size="sm">
                      Gestionar
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
