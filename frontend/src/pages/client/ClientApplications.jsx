import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { clientService, publicService } from '../../services/api';
import Card from '../../components/Card';
import Button from '../../components/Button';
import FormInput from '../../components/FormInput';
import Table from '../../components/Table';
import Badge from '../../components/Badge';
import Alert from '../../components/Alert';
import { LoadingState } from '../../components/Spinner';
import { STATUS_LABELS } from '../../components/application/applicationStatus';
import { formatMoney, formatPercent, formatDate } from '../../utils/format';
import { todayISO } from '../../utils/dates';
import { rules, ageFrom } from '../../utils/validation';
import { getFrequency } from '../../utils/frequencies';
import IdentityStatusCard from '../../components/identity/IdentityStatusCard';
import { useIdentityStatus } from '../../components/identity/identityStatus';

const MIN_AGE = 18;
const MAX_DEBT_TO_INCOME = 40; // %

const ESTADOS_CIVILES = ['Soltero/a', 'Casado/a', 'Unión de hecho', 'Divorciado/a', 'Viudo/a'];
const ACTIVIDADES = [
  'Empleado privado',
  'Empleado público',
  'Negocio propio',
  'Profesional independiente',
  'Jubilado/a',
  'Otra',
];

function ApplicationsTable({ applications, type }) {
  const isInvestment = type === 'INVERSION';

  if (applications.length === 0) {
    return (
      <div className="py-8 text-center space-y-3">
        <span className="material-symbols-outlined text-[32px] text-on-surface-variant">folder_open</span>
        <p className="text-[13px] text-on-surface-variant">
          No tienes solicitudes de {isInvestment ? 'inversión' : 'crédito'}.
        </p>
        <Link to={isInvestment ? '/inversiones/simulador' : '/creditos/simulador'}>
          <Button variant="fintech" size="sm" iconName="calculate">Simular ahora</Button>
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
        { label: 'Acción', align: 'text-right' },
      ]}
    >
      {applications.map((app) => (
        <tr key={app.id} className="hover:bg-surface-container-low/40 transition-colors">
          <td className="py-3 px-4 font-bold text-primary font-numeric-data">{app.codigo || app.id.slice(0, 8)}</td>
          <td className="py-3 px-4 text-on-surface font-medium">
            {isInvestment ? app.product?.nombre || 'Inversión' : app.creditType?.nombre || 'Crédito'}
          </td>
          <td className="py-3 px-4 text-right font-numeric-data font-bold text-primary">{formatMoney(app.monto)}</td>
          <td className="py-3 px-4 text-on-surface-variant text-[12px]">
            {isInvestment ? `${app.plazoDias} días` : `${app.plazoMeses} meses`}
          </td>
          <td className="py-3 px-4">
            <Badge variant={app.estado}>{STATUS_LABELS[app.estado] || app.estado}</Badge>
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

function Checkbox({ checked, onChange, error, children }) {
  return (
    <div className="space-y-1">
      <label className="flex items-start gap-2.5 cursor-pointer p-3 rounded-lg border border-gray-200 text-[13px]">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 mt-0.5 accent-secondary" />
        <span className="text-gray-700">{children}</span>
      </label>
      {error && <p className="text-[11px] font-medium text-error">{error}</p>}
    </div>
  );
}

function validatePersonal(form) {
  return {
    nombres: rules.name(form.nombres, 'nombres'),
    apellidos: rules.name(form.apellidos, 'apellidos'),
    cedula: rules.cedula(form.cedula),
    telefono: rules.phone(form.telefono),
    email: rules.email(form.email),
    actividadEconomica: rules.required(form.actividadEconomica, 'Indica tu actividad económica.'),
    ingresosMensuales: rules.money(form.ingresosMensuales, { emptyMessage: 'Ingresa tus ingresos mensuales.' }),
  };
}

function validateCredit(form) {
  const today = todayISO();
  let fechaNacimiento;
  if (!form.fechaNacimiento) fechaNacimiento = 'Ingresa tu fecha de nacimiento.';
  else if (form.fechaNacimiento >= today) fechaNacimiento = 'La fecha de nacimiento no puede ser hoy ni una fecha futura.';
  else if (ageFrom(form.fechaNacimiento, today) < MIN_AGE) fechaNacimiento = 'Debes ser mayor de edad para solicitar un crédito.';

  return {
    ...validatePersonal(form),
    fechaNacimiento,
    ciudad: rules.required(form.ciudad, 'Ingresa tu ciudad.'),
    direccion: String(form.direccion).trim().length >= 5 ? undefined : 'Ingresa tu dirección de domicilio completa.',
    egresosMensuales: rules.money(form.egresosMensuales, { emptyMessage: 'Ingresa tus gastos mensuales (puede ser 0).', allowZero: true }),
    autorizaConsultaBuro: form.autorizaConsultaBuro ? undefined : 'Debes autorizar la consulta de tu historial crediticio para continuar.',
  };
}

function validateInvestment(form) {
  return {
    ...validatePersonal(form),
    origenFondos: String(form.origenFondos).trim().length >= 5 ? undefined : 'Indica el origen de los fondos.',
    finalidadInversion: String(form.finalidadInversion).trim().length >= 5 ? undefined : 'Indica la finalidad de la inversión.',
    declaraLicitudFondos: form.declaraLicitudFondos ? undefined : 'Debes declarar que los fondos tienen un origen lícito para continuar.',
  };
}

const withoutEmpty = (errors) => Object.fromEntries(Object.entries(errors).filter(([, value]) => value));

export default function ClientApplications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const identity = useIdentityStatus();
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
  const [serverErrors, setServerErrors] = useState({});
  const [showErrors, setShowErrors] = useState(false);

  // Solo se precargan los datos del perfil del cliente; el resto lo completa él
  const [nombres, ...apellidos] = (user?.nombre || '').trim().split(/\s+/);
  const [formData, setFormData] = useState({
    nombres: nombres || '',
    apellidos: apellidos.join(' '),
    cedula: user?.cedula || '',
    fechaNacimiento: '',
    estadoCivil: '',
    direccion: '',
    ciudad: '',
    telefono: user?.telefono || '',
    email: user?.email || '',
    actividadEconomica: '',
    ingresosMensuales: '',
    egresosMensuales: '',
    autorizaConsultaBuro: false,
    origenFondos: '',
    finalidadInversion: '',
    declaraLicitudFondos: false,
  });

  useEffect(() => {
    Promise.all([clientService.getMyCreditApplications(), clientService.getMyInvestmentApplications()])
      .then(([creditResponse, investmentResponse]) => {
        setCreditApps(creditResponse.data.applications || []);
        setInvestmentApps(investmentResponse.data.applications || []);
      })
      .catch((err) => setError(err.message || 'No se pudieron cargar tus solicitudes.'))
      .finally(() => setLoading(false));

    if (simulationId) {
      publicService.getCreditSimulation(simulationId)
        .then((res) => setCreditSimulation(res.data.simulation))
        .catch((err) => setError(err.message));
    }
    if (invSimulationId) {
      publicService.getInvestmentSimulation(invSimulationId)
        .then((res) => setInvestmentSimulation(res.data.simulation))
        .catch((err) => setError(err.message));
    }
  }, [simulationId, invSimulationId]);

  const creditErrors = useMemo(() => withoutEmpty(validateCredit(formData)), [formData]);
  const investmentErrors = useMemo(() => withoutEmpty(validateInvestment(formData)), [formData]);

  const updateField = (name, value) => {
    setFormData((previous) => ({ ...previous, [name]: value }));
    setServerErrors((previous) => ({ ...previous, [name]: undefined }));
  };
  const handleInputChange = (event) => updateField(event.target.name, event.target.value);
  const fieldError = (errors, name) => serverErrors[name] || (showErrors ? errors[name] : undefined);

  // Capacidad de pago: la cuota más alta (mensual equivalente) frente a los ingresos disponibles
  const frecuencia = getFrequency(creditSimulation?.frecuenciaPago);
  const cuotaMaxima = creditSimulation
    ? Math.max(...(creditSimulation.rows || []).map((row) => Number(row.totalPago)), Number(creditSimulation.cuotaInicial))
      / frecuencia.meses
    : 0;
  const ingresos = Number(formData.ingresosMensuales) || 0;
  const disponible = ingresos - (Number(formData.egresosMensuales) || 0);
  const relacionCuota = ingresos > 0 ? (cuotaMaxima / ingresos) * 100 : null;

  const handleServerError = (err) => {
    setError(err.message || 'No se pudo enviar la solicitud.');
    // Sin identidad verificada: se actualiza el estado para mostrar cómo verificarla
    if (err.errors?.identidad) identity.reload();
    else if (err.errors && !Array.isArray(err.errors)) setServerErrors(err.errors);
  };

  const submitCreditApplication = async (event) => {
    event.preventDefault();
    setShowErrors(true);
    if (Object.keys(creditErrors).length > 0) {
      setError('Revisa los campos marcados antes de enviar.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await clientService.createCreditApplication({
        simulationId,
        creditTypeId: creditSimulation.creditTypeId,
        monto: creditSimulation.monto,
        plazoMeses: creditSimulation.plazoMeses,
        sistemaAmortizacion: creditSimulation.sistemaAmortizacion,
        frecuenciaPago: creditSimulation.frecuenciaPago || 'MENSUAL',
        polizaDesgravamenPropia: Boolean(creditSimulation.polizaDesgravamenPropia),
        nombres: formData.nombres.trim(),
        apellidos: formData.apellidos.trim(),
        cedula: formData.cedula.trim(),
        fechaNacimiento: formData.fechaNacimiento,
        estadoCivil: formData.estadoCivil,
        direccion: formData.direccion.trim(),
        ciudad: formData.ciudad.trim(),
        telefono: formData.telefono.trim(),
        email: formData.email.trim(),
        actividadEconomica: formData.actividadEconomica,
        ingresosMensuales: formData.ingresosMensuales,
        egresosMensuales: formData.egresosMensuales,
        autorizaConsultaBuro: formData.autorizaConsultaBuro,
      });
      navigate(`/cliente/solicitudes/${response.data.application.id}`);
    } catch (err) {
      handleServerError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const submitInvestmentApplication = async (event) => {
    event.preventDefault();
    setShowErrors(true);
    if (Object.keys(investmentErrors).length > 0) {
      setError('Revisa los campos marcados antes de enviar.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await clientService.createInvestmentApplication({
        simulationId: invSimulationId,
        investmentProductId: investmentSimulation.investmentProductId,
        monto: investmentSimulation.monto,
        plazoDias: investmentSimulation.plazoDias,
        nombres: formData.nombres.trim(),
        apellidos: formData.apellidos.trim(),
        cedula: formData.cedula.trim(),
        telefono: formData.telefono.trim(),
        email: formData.email.trim(),
        actividadEconomica: formData.actividadEconomica,
        ingresosMensuales: formData.ingresosMensuales,
        origenFondos: formData.origenFondos.trim(),
        finalidadInversion: formData.finalidadInversion.trim(),
        declaraLicitudFondos: formData.declaraLicitudFondos,
      });
      navigate(`/cliente/inversiones/${response.data.application.id}`);
    } catch (err) {
      handleServerError(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || identity.loading) return <LoadingState message="Cargando tus solicitudes..." />;

  // Solicitar exige la identidad verificada (o en revisión); después de verificarla se vuelve aquí
  const wantsToApply = Boolean((simulationId && creditSimulation) || (invSimulationId && investmentSimulation));
  const needsIdentity = wantsToApply && identity.status && !identity.status.puedeSolicitar;
  const identityInReview = wantsToApply && identity.status?.verification?.estado === 'EN_REVISION';

  const personalFields = (errors) => (
    <>
      <FormInput label="Nombres" name="nombres" value={formData.nombres} onChange={handleInputChange} error={fieldError(errors, 'nombres')} required />
      <FormInput label="Apellidos" name="apellidos" value={formData.apellidos} onChange={handleInputChange} error={fieldError(errors, 'apellidos')} required />
      <FormInput label="Cédula" name="cedula" inputMode="numeric" maxLength={10} value={formData.cedula} onChange={handleInputChange} error={fieldError(errors, 'cedula')} required />
      <FormInput label="Teléfono celular" name="telefono" inputMode="tel" placeholder="09XXXXXXXX" value={formData.telefono} onChange={handleInputChange} error={fieldError(errors, 'telefono')} required />
      <FormInput type="email" label="Correo electrónico" name="email" value={formData.email} onChange={handleInputChange} error={fieldError(errors, 'email')} required />
      <FormInput
        type="select"
        label="Actividad económica"
        name="actividadEconomica"
        value={formData.actividadEconomica}
        onChange={handleInputChange}
        options={[{ value: '', label: 'Selecciona una opción' }, ...ACTIVIDADES.map((a) => ({ value: a, label: a }))]}
        error={fieldError(errors, 'actividadEconomica')}
        required
      />
      <FormInput label="Ingresos mensuales" name="ingresosMensuales" inputMode="decimal" prefix="$" value={formData.ingresosMensuales} onChange={(e) => updateField('ingresosMensuales', e.target.value.replace(',', '.'))} error={fieldError(errors, 'ingresosMensuales')} required />
    </>
  );

  return (
    <div className="space-y-space-md max-w-[1440px] mx-auto">
      <div className="bg-surface-container-lowest p-space-lg rounded-xl border border-surface-container-high shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
        <div>
          <h1 className="font-headline-lg text-[24px] sm:text-[28px] text-primary font-bold">Mis solicitudes</h1>
          <p className="text-[13px] text-on-surface-variant mt-0.5">
            Solicita un crédito o una inversión a partir de una simulación y sigue su estado.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/creditos/simulador"><Button variant="outline" iconName="calculate">Simular crédito</Button></Link>
          <Link to="/inversiones/simulador"><Button variant="fintech" iconName="trending_up">Simular inversión</Button></Link>
        </div>
      </div>

      {error && <Alert type="error" title="No pudimos enviar tu solicitud">{error}</Alert>}

      {(needsIdentity || identityInReview) && (
        <IdentityStatusCard status={identity.status} volver={`${location.pathname}${location.search}`} />
      )}

      {!needsIdentity && simulationId && creditSimulation && (
        <Card title="Solicitar crédito" subtitle="Completa tus datos para que un asesor revise tu solicitud" iconName="assignment" className="border-2 border-secondary/30">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface-container-low p-4 rounded-lg mb-4 text-[13px]">
            <div><span className="block text-on-surface-variant">Producto</span><strong>{creditSimulation.creditType?.nombre}</strong></div>
            <div><span className="block text-on-surface-variant">Monto</span><strong>{formatMoney(creditSimulation.monto)}</strong></div>
            <div><span className="block text-on-surface-variant">Plazo</span><strong>{creditSimulation.plazoMeses} meses · pagos {frecuencia.plural}</strong></div>
            <div>
              <span className="block text-on-surface-variant">{frecuencia.meses > 1 ? 'Cuota mensual equivalente' : 'Cuota'}</span>
              <strong>{formatMoney(cuotaMaxima)}</strong>
            </div>
          </div>
          <form onSubmit={submitCreditApplication} noValidate className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {personalFields(creditErrors)}
              <FormInput
                label="Gastos mensuales"
                name="egresosMensuales"
                inputMode="decimal"
                prefix="$"
                value={formData.egresosMensuales}
                onChange={(e) => updateField('egresosMensuales', e.target.value.replace(',', '.'))}
                error={fieldError(creditErrors, 'egresosMensuales')}
                hint="Arriendo, alimentación, otras deudas."
                required
              />
              <FormInput type="date" label="Fecha de nacimiento" name="fechaNacimiento" max={todayISO()} value={formData.fechaNacimiento} onChange={handleInputChange} error={fieldError(creditErrors, 'fechaNacimiento')} required />
              <FormInput
                type="select"
                label="Estado civil"
                name="estadoCivil"
                value={formData.estadoCivil}
                onChange={handleInputChange}
                options={[{ value: '', label: 'Selecciona una opción' }, ...ESTADOS_CIVILES.map((e) => ({ value: e, label: e }))]}
              />
              <FormInput label="Ciudad" name="ciudad" value={formData.ciudad} onChange={handleInputChange} error={fieldError(creditErrors, 'ciudad')} required />
              <FormInput label="Dirección de domicilio" name="direccion" value={formData.direccion} onChange={handleInputChange} error={fieldError(creditErrors, 'direccion')} required />
            </div>

            {relacionCuota !== null && (
              <Alert type={cuotaMaxima > disponible ? 'error' : relacionCuota > MAX_DEBT_TO_INCOME ? 'warning' : 'success'}>
                {cuotaMaxima > disponible
                  ? `La cuota de ${formatMoney(cuotaMaxima)} supera tus ingresos disponibles (${formatMoney(Math.max(disponible, 0))}). Considera un monto menor o un plazo mayor.`
                  : `Tu cuota representa el ${formatPercent(relacionCuota, 1, 0)} de tus ingresos${relacionCuota > MAX_DEBT_TO_INCOME ? '; se recomienda no superar el 40 %.' : '.'}`}
              </Alert>
            )}

            <Checkbox
              checked={formData.autorizaConsultaBuro}
              onChange={(value) => updateField('autorizaConsultaBuro', value)}
              error={fieldError(creditErrors, 'autorizaConsultaBuro')}
            >
              Autorizo a la institución a consultar mi historial crediticio y a tratar mis datos personales para evaluar esta solicitud.
            </Checkbox>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => navigate('/cliente/solicitudes')}>Cancelar</Button>
              <Button type="submit" variant="fintech" loading={submitting} loadingText="Enviando..." iconName="send">Enviar solicitud</Button>
            </div>
          </form>
        </Card>
      )}

      {!needsIdentity && invSimulationId && investmentSimulation && (
        <Card title="Solicitar inversión" subtitle="Completa tus datos para abrir tu depósito a plazo" iconName="savings" className="border-2 border-secondary/30">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface-container-low p-4 rounded-lg mb-4 text-[13px]">
            <div><span className="block text-on-surface-variant">Producto</span><strong>{investmentSimulation.product?.nombre}</strong></div>
            <div>
              <span className="block text-on-surface-variant">{investmentSimulation.aporteMensual != null ? 'Aporte mensual' : 'Capital'}</span>
              <strong>{formatMoney(investmentSimulation.aporteMensual ?? investmentSimulation.monto)}</strong>
            </div>
            <div><span className="block text-on-surface-variant">Plazo</span><strong>{investmentSimulation.plazoDias} días · vence {formatDate(investmentSimulation.fechaVencimiento)}</strong></div>
            <div><span className="block text-on-surface-variant">Recibirás</span><strong>{formatMoney(investmentSimulation.valorFinal)}</strong></div>
          </div>
          <form onSubmit={submitInvestmentApplication} noValidate className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {personalFields(investmentErrors)}
              <FormInput label="Origen de los fondos" name="origenFondos" placeholder="Ej: ahorros de mi sueldo" value={formData.origenFondos} onChange={handleInputChange} error={fieldError(investmentErrors, 'origenFondos')} required />
              <FormInput type="textarea" label="Finalidad de la inversión" name="finalidadInversion" value={formData.finalidadInversion} onChange={handleInputChange} rows={2} className="sm:col-span-2" error={fieldError(investmentErrors, 'finalidadInversion')} required />
            </div>
            <Checkbox
              checked={formData.declaraLicitudFondos}
              onChange={(value) => updateField('declaraLicitudFondos', value)}
              error={fieldError(investmentErrors, 'declaraLicitudFondos')}
            >
              Declaro que los fondos provienen de actividades lícitas y que la información entregada es verdadera.
            </Checkbox>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => navigate('/cliente/solicitudes')}>Cancelar</Button>
              <Button type="submit" variant="fintech" loading={submitting} loadingText="Enviando..." iconName="send">Solicitar inversión</Button>
            </div>
          </form>
        </Card>
      )}

      <Card title={`Solicitudes de crédito (${creditApps.length})`} iconName="credit_card">
        <ApplicationsTable applications={creditApps} type="CREDITO" />
      </Card>

      <Card title={`Solicitudes de inversión (${investmentApps.length})`} iconName="savings">
        <ApplicationsTable applications={investmentApps} type="INVERSION" />
      </Card>
    </div>
  );
}
