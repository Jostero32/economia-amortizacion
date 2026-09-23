import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminService } from '../../services/api';
import Card from '../../components/Card';
import Table from '../../components/Table';
import Button from '../../components/Button';
import Badge from '../../components/Badge';
import Alert from '../../components/Alert';
import { LoadingState } from '../../components/Spinner';

function ApplicationsTable({ applications, type, formatUSD }) {
  const isInvestment = type === 'INVERSION';

  if (applications.length === 0) {
    return <p className="py-8 text-center text-[13px] text-on-surface-variant">No se encontraron solicitudes.</p>;
  }

  return (
    <Table
      headers={[
        'Código',
        'Solicitante / Cédula',
        'Producto',
        { label: 'Monto', align: 'text-right' },
        'Plazo',
        'Estado',
        'Biometría',
        { label: 'Acción', align: 'text-right' },
      ]}
    >
      {applications.map((application) => (
        <tr key={application.id} className="hover:bg-surface-container-low/40 transition-colors">
          <td className="py-3 px-4 font-bold text-primary font-numeric-data">
            {application.codigo || application.id.slice(0, 8)}
          </td>
          <td className="py-3 px-4">
            <strong className="block text-[13px] text-primary">{application.nombres} {application.apellidos}</strong>
            <span className="text-[11px] text-on-surface-variant">C.I: {application.cedula}</span>
          </td>
          <td className="py-3 px-4 text-[13px]">
            {isInvestment ? application.product?.nombre : application.creditType?.nombre}
          </td>
          <td className="py-3 px-4 text-right font-numeric-data font-bold text-primary">
            {formatUSD(application.monto)}
          </td>
          <td className="py-3 px-4 text-[12px] text-on-surface-variant">
            {isInvestment ? `${application.plazoDias} días` : `${application.plazoMeses} meses`}
          </td>
          <td className="py-3 px-4"><Badge variant={application.estado}>{application.estado}</Badge></td>
          <td className="py-3 px-4 text-[12px]">
            <span className={application.biometriaValidada ? 'text-emerald-800 font-bold' : 'text-amber-800 font-bold'}>
              {application.biometriaValidada ? 'Validada' : 'Por validar'}
            </span>
          </td>
          <td className="py-3 px-4 text-right">
            <Link to={isInvestment ? `/admin/solicitudes/inversion/${application.id}` : `/admin/solicitudes/${application.id}`}>
              <Button variant="fintech" size="sm" iconName="rate_review">Revisar</Button>
            </Link>
          </td>
        </tr>
      ))}
    </Table>
  );
}

export default function ApplicationsList() {
  const [creditApplications, setCreditApplications] = useState([]);
  const [investmentApplications, setInvestmentApplications] = useState([]);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    adminService.getApplications()
      .then((response) => {
        if (response.success) {
          setCreditApplications(response.data.creditApplications || []);
          setInvestmentApplications(response.data.investmentApplications || []);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filterByStatus = (applications) => applications.filter(
    (application) => filterStatus === 'ALL' || application.estado === filterStatus
  );
  const filteredCredits = filterByStatus(creditApplications);
  const filteredInvestments = filterByStatus(investmentApplications);
  const totalApplications = creditApplications.length + investmentApplications.length;
  const formatUSD = (value) =>
    new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(value || 0);

  if (loading) return <LoadingState message="Cargando bandeja de solicitudes..." />;

  return (
    <div className="space-y-space-md max-w-[1440px] mx-auto">
      <div className="bg-surface-container-lowest p-space-lg rounded-xl border border-surface-container-high shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <Badge variant="bce" iconName="assignment">Bandeja de entrada</Badge>
          <h1 className="font-headline-lg text-[24px] sm:text-[28px] text-primary font-bold mt-1">Gestión de solicitudes</h1>
          <p className="font-body-sm text-[13px] text-on-surface-variant">
            Revisión integral de créditos e inversiones, documentos y biometría simulada.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={filterType} onChange={(event) => setFilterType(event.target.value)} className="h-10 px-3 rounded-lg border border-surface-container-high bg-surface-container-low text-[13px]">
            <option value="ALL">Todos los tipos ({totalApplications})</option>
            <option value="CREDITO">Créditos ({creditApplications.length})</option>
            <option value="INVERSION">Inversiones ({investmentApplications.length})</option>
          </select>
          <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)} className="h-10 px-3 rounded-lg border border-surface-container-high bg-surface-container-low text-[13px]">
            <option value="ALL">Todos los estados</option>
            <option value="PENDIENTE">PENDIENTE</option>
            <option value="EN_REVISION">EN REVISIÓN</option>
            <option value="PENDIENTE_DOCUMENTOS">PENDIENTE DOCUMENTOS</option>
            <option value="APROBADA">APROBADA</option>
            <option value="RECHAZADA">RECHAZADA</option>
          </select>
        </div>
      </div>

      {error && <Alert type="error" title="Error">{error}</Alert>}

      {(filterType === 'ALL' || filterType === 'CREDITO') && (
        <Card title={`Solicitudes de crédito (${filteredCredits.length})`} iconName="credit_card">
          <ApplicationsTable applications={filteredCredits} type="CREDITO" formatUSD={formatUSD} />
        </Card>
      )}

      {(filterType === 'ALL' || filterType === 'INVERSION') && (
        <Card title={`Solicitudes de inversión (${filteredInvestments.length})`} iconName="savings">
          <ApplicationsTable applications={filteredInvestments} type="INVERSION" formatUSD={formatUSD} />
        </Card>
      )}
    </div>
  );
}
