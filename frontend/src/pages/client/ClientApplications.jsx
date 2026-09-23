import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { clientService, publicService } from '../../services/api';
import Card from '../../components/Card';
import Button from '../../components/Button';
import FormInput from '../../components/FormInput';
import Table from '../../components/Table';
import Badge from '../../components/Badge';
import Alert from '../../components/Alert';
import { LoadingState } from '../../components/Spinner';

function ApplicationsTable({ applications, type, formatUSD }) {
  const isInvestment = type === 'INVERSION';

  if (applications.length === 0) {
    return (
      <div className="py-8 text-center space-y-3">
        <span className="material-symbols-outlined text-[32px] text-on-surface-variant">folder_open</span>
        <p className="font-body-sm text-[13px] text-on-surface-variant">
          No tienes solicitudes de {isInvestment ? 'inversión' : 'crédito'} registradas.
        </p>
        <Link to={isInvestment ? '/inversiones/simulador' : '/creditos/simulador'}>
          <Button variant="fintech" size="sm" iconName="calculate">
            Iniciar simulación
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <Table
      headers={[
        'Número',
        'Producto',
        { label: 'Monto', align: 'text-right' },
        'Plazo',
        'Estado',
        'Biometría',
        { label: 'Acción', align: 'text-right' },
      ]}
    >
      {applications.map((app) => (
        <tr key={app.id} className="hover:bg-surface-container-low/40 transition-colors">
          <td className="py-3 px-4 font-bold text-primary font-numeric-data">
            {app.codigo || app.id.slice(0, 8)}
          </td>
          <td className="py-3 px-4 text-on-surface font-medium font-body-sm">
            {isInvestment ? app.product?.nombre || 'Inversión' : app.creditType?.nombre || 'Crédito'}
          </td>
          <td className="py-3 px-4 text-right font-numeric-data font-bold text-primary">
            {formatUSD(app.monto)}
          </td>
          <td className="py-3 px-4 text-on-surface-variant font-numeric-data text-[12px]">
            {isInvestment ? `${app.plazoDias} días` : `${app.plazoMeses} meses`}
          </td>
          <td className="py-3 px-4">
            <Badge variant={app.estado}>{app.estado}</Badge>
          </td>
          <td className="py-3 px-4 text-[12px]">
            {app.biometriaValidada ? (
              <span className="text-emerald-800 font-bold">Validada</span>
            ) : (
              <span className="text-on-surface-variant">Pendiente</span>
            )}
          </td>
          <td className="py-3 px-4 text-right">
            <Link to={isInvestment ? `/cliente/inversiones/${app.id}` : `/cliente/solicitudes/${app.id}`}>
              <Button variant="outline" size="sm" iconName="visibility">Ver detalle</Button>
            </Link>
          </td>
        </tr>
      ))}
    </Table>
  );
}

export default function ClientApplications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const simulationId = searchParams.get('simulationId');
  const invSimulationId = searchParams.get('invSimulationId');

  const [creditApps, setCreditApps] = useState([]);
  const [investmentApps, setInvestmentApps] = useState([]);
  const [creditSimulation, setCreditSimulation] = useState(null);
  const [investmentSimulation, setInvestmentSimulation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    nombres: user?.nombre?.split(' ')[0] || '',
    apellidos: user?.nombre?.split(' ').slice(1).join(' ') || '',
    cedula: user?.cedula || '',
    fechaNacimiento: '1995-05-15',
    estadoCivil: 'Soltero/a',
    direccion: 'Av. 10 de Agosto y Colón, Edif. Central',
    ciudad: 'Quito',
    telefono: user?.telefono || '0991234567',
    email: user?.email || '',
    actividadEconomica: 'Empleado bajo relación de dependencia',
    ingresosMensuales: '1200',
    egresosMensuales: '450',
    origenFondos: 'Ahorros provenientes de ingresos laborales',
    finalidadInversion: 'Ahorro y crecimiento patrimonial',
  });

  const loadApplications = async () => {
    try {
      const [creditResponse, investmentResponse] = await Promise.all([
        clientService.getMyCreditApplications(),
        clientService.getMyInvestmentApplications(),
      ]);
      if (creditResponse.success) setCreditApps(creditResponse.data.applications || []);
      if (investmentResponse.success) setInvestmentApps(investmentResponse.data.applications || []);
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las solicitudes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();

    if (simulationId) {
      publicService.getCreditSimulation(simulationId)
        .then((res) => res.success && setCreditSimulation(res.data.simulation))
        .catch((err) => setError(err.message));
    }

    if (invSimulationId) {
      publicService.getInvestmentSimulation(invSimulationId)
        .then((res) => res.success && setInvestmentSimulation(res.data.simulation))
        .catch((err) => setError(err.message));
    }
  }, [simulationId, invSimulationId]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  const submitCreditApplication = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await clientService.createCreditApplication({
        simulationId,
        creditTypeId: creditSimulation.creditTypeId,
        monto: creditSimulation.monto,
        plazoMeses: creditSimulation.plazoMeses,
        sistemaAmortizacion: creditSimulation.sistemaAmortizacion,
        nombres: formData.nombres,
        apellidos: formData.apellidos,
        cedula: formData.cedula,
        fechaNacimiento: formData.fechaNacimiento,
        estadoCivil: formData.estadoCivil,
        direccion: formData.direccion,
        ciudad: formData.ciudad,
        telefono: formData.telefono,
        email: formData.email,
        actividadEconomica: formData.actividadEconomica,
        ingresosMensuales: formData.ingresosMensuales,
        egresosMensuales: formData.egresosMensuales,
      });
      navigate(`/cliente/solicitudes/${response.data.application.id}`);
    } catch (err) {
      setError(err.message || 'Error al enviar la solicitud de crédito.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitInvestmentApplication = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await clientService.createInvestmentApplication({
        simulationId: invSimulationId,
        investmentProductId: investmentSimulation.investmentProductId,
        monto: investmentSimulation.monto,
        plazoDias: investmentSimulation.plazoDias,
        nombres: formData.nombres,
        apellidos: formData.apellidos,
        cedula: formData.cedula,
        telefono: formData.telefono,
        email: formData.email,
        actividadEconomica: formData.actividadEconomica,
        ingresosMensuales: formData.ingresosMensuales,
        origenFondos: formData.origenFondos,
        finalidadInversion: formData.finalidadInversion,
      });
      navigate(`/cliente/inversiones/${response.data.application.id}`);
    } catch (err) {
      setError(err.message || 'Error al enviar la solicitud de inversión.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatUSD = (value) =>
    new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(value || 0);

  if (loading) return <LoadingState message="Cargando solicitudes registradas..." />;

  return (
    <div className="space-y-space-md max-w-[1440px] mx-auto">
      <div className="bg-surface-container-lowest p-space-lg rounded-xl border border-surface-container-high shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
        <div>
          <Badge variant="bce" iconName="description">Portal de trámites</Badge>
          <h1 className="font-headline-lg text-[24px] sm:text-[28px] text-primary font-bold mt-1">
            Mis solicitudes
          </h1>
          <p className="font-body-sm text-[13px] text-on-surface-variant mt-0.5">
            Gestiona solicitudes de crédito e inversión y completa sus expedientes digitales.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/creditos/simulador"><Button variant="outline" iconName="calculate">Simular crédito</Button></Link>
          <Link to="/inversiones/simulador"><Button variant="fintech" iconName="trending_up">Simular inversión</Button></Link>
        </div>
      </div>

      {error && <Alert type="error" title="Error">{error}</Alert>}

      {simulationId && creditSimulation && (
        <Card title="Formalizar solicitud de crédito" subtitle={`Simulación #${simulationId.slice(0, 8)}`} iconName="assignment" className="border-2 border-secondary/30">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface-container-low p-4 rounded-lg mb-4 text-[12px]">
            <div><span className="block text-on-surface-variant">Producto</span><strong>{creditSimulation.creditType?.nombre}</strong></div>
            <div><span className="block text-on-surface-variant">Monto</span><strong>{formatUSD(creditSimulation.monto)}</strong></div>
            <div><span className="block text-on-surface-variant">Plazo</span><strong>{creditSimulation.plazoMeses} meses</strong></div>
            <div><span className="block text-on-surface-variant">Cuota estimada</span><strong>{formatUSD(creditSimulation.cuotaInicial)}</strong></div>
          </div>
          <form onSubmit={submitCreditApplication} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormInput label="Nombres" name="nombres" value={formData.nombres} onChange={handleInputChange} required />
              <FormInput label="Apellidos" name="apellidos" value={formData.apellidos} onChange={handleInputChange} required />
              <FormInput label="Cédula" name="cedula" value={formData.cedula} onChange={handleInputChange} maxLength={10} required />
              <FormInput type="date" label="Fecha de nacimiento" name="fechaNacimiento" value={formData.fechaNacimiento} onChange={handleInputChange} required />
              <FormInput label="Teléfono" name="telefono" value={formData.telefono} onChange={handleInputChange} required />
              <FormInput type="email" label="Correo" name="email" value={formData.email} onChange={handleInputChange} required />
              <FormInput label="Ciudad" name="ciudad" value={formData.ciudad} onChange={handleInputChange} required />
              <FormInput label="Dirección" name="direccion" value={formData.direccion} onChange={handleInputChange} required />
              <FormInput label="Actividad económica" name="actividadEconomica" value={formData.actividadEconomica} onChange={handleInputChange} required />
              <FormInput type="number" label="Ingresos mensuales" name="ingresosMensuales" value={formData.ingresosMensuales} onChange={handleInputChange} prefix="$" min="0" required />
              <FormInput type="number" label="Egresos mensuales" name="egresosMensuales" value={formData.egresosMensuales} onChange={handleInputChange} prefix="$" min="0" required />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => navigate('/cliente/solicitudes')}>Cancelar</Button>
              <Button type="submit" variant="fintech" loading={submitting} loadingText="Enviando..." iconName="send">Enviar solicitud</Button>
            </div>
          </form>
        </Card>
      )}

      {invSimulationId && investmentSimulation && (
        <Card title="Formalizar solicitud de inversión" subtitle={`Simulación #${invSimulationId.slice(0, 8)}`} iconName="savings" className="border-2 border-secondary/30">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface-container-low p-4 rounded-lg mb-4 text-[12px]">
            <div><span className="block text-on-surface-variant">Producto</span><strong>{investmentSimulation.product?.nombre}</strong></div>
            <div><span className="block text-on-surface-variant">Capital</span><strong>{formatUSD(investmentSimulation.monto)}</strong></div>
            <div><span className="block text-on-surface-variant">Plazo</span><strong>{investmentSimulation.plazoDias} días</strong></div>
            <div><span className="block text-on-surface-variant">Valor final</span><strong>{formatUSD(investmentSimulation.valorFinal)}</strong></div>
          </div>
          <form onSubmit={submitInvestmentApplication} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormInput label="Nombres" name="nombres" value={formData.nombres} onChange={handleInputChange} required />
              <FormInput label="Apellidos" name="apellidos" value={formData.apellidos} onChange={handleInputChange} required />
              <FormInput label="Cédula" name="cedula" value={formData.cedula} onChange={handleInputChange} maxLength={10} required />
              <FormInput label="Teléfono" name="telefono" value={formData.telefono} onChange={handleInputChange} required />
              <FormInput type="email" label="Correo" name="email" value={formData.email} onChange={handleInputChange} required />
              <FormInput label="Actividad económica" name="actividadEconomica" value={formData.actividadEconomica} onChange={handleInputChange} required />
              <FormInput type="number" label="Ingresos mensuales" name="ingresosMensuales" value={formData.ingresosMensuales} onChange={handleInputChange} prefix="$" min="0" required />
              <FormInput label="Origen de los fondos" name="origenFondos" value={formData.origenFondos} onChange={handleInputChange} required />
              <FormInput type="textarea" label="Finalidad de la inversión" name="finalidadInversion" value={formData.finalidadInversion} onChange={handleInputChange} rows={2} className="sm:col-span-2" required />
            </div>
            <Alert type="info" title="Declaración del cliente">
              Al enviar confirmas que la información proporcionada y el origen declarado de los fondos son veraces.
            </Alert>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => navigate('/cliente/solicitudes')}>Cancelar</Button>
              <Button type="submit" variant="fintech" loading={submitting} loadingText="Enviando..." iconName="send">Solicitar inversión</Button>
            </div>
          </form>
        </Card>
      )}

      <Card title={`Solicitudes de crédito (${creditApps.length})`} iconName="credit_card">
        <ApplicationsTable applications={creditApps} type="CREDITO" formatUSD={formatUSD} />
      </Card>

      <Card title={`Solicitudes de inversión (${investmentApps.length})`} iconName="savings">
        <ApplicationsTable applications={investmentApps} type="INVERSION" formatUSD={formatUSD} />
      </Card>
    </div>
  );
}
