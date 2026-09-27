import React, { useEffect, useState } from 'react';
import { publicService, adminService } from '../../services/api';
import Card from '../../components/Card';
import Table from '../../components/Table';
import Button from '../../components/Button';
import FormInput from '../../components/FormInput';
import Modal from '../../components/Modal';
import Badge from '../../components/Badge';
import Alert from '../../components/Alert';
import { LoadingState } from '../../components/Spinner';
import { formatMoney, formatPercent } from '../../utils/format';

const CATEGORY_OPTIONS = [
  { value: 'IMPUESTO', label: 'Impuesto de ley (ej. SOLCA)' },
  { value: 'SEGURO_DESGRAVAMEN', label: 'Seguro de desgravamen' },
  { value: 'SEGURO', label: 'Otro seguro (incendio, vehículo)' },
  { value: 'GASTO_TERCEROS', label: 'Gasto a terceros (avalúo, notaría)' },
  { value: 'DONACION', label: 'Donación (siempre voluntaria)' },
];

const CATEGORY_LABELS = {
  IMPUESTO: 'Impuesto de ley',
  SEGURO_DESGRAVAMEN: 'Seguro de desgravamen',
  SEGURO: 'Seguro',
  GASTO_TERCEROS: 'Gasto a terceros',
  DONACION: 'Donación',
};

const BASE_LABELS = {
  MONTO_OPERACION: 'monto del crédito',
  SALDO_INSOLUTO: 'saldo de capital',
  CUOTA: 'cuota',
};

const EMPTY_FORM = {
  nombre: '',
  categoria: 'SEGURO',
  tipo: 'PORCENTAJE',
  porcentaje: '',
  valor: '',
  aplicacion: 'POR_CUOTA',
  baseCalculo: 'SALDO_INSOLUTO',
  anualizarSiPlazoMenorAnio: false,
  obligatorio: false,
  creditTypeId: '',
  descripcion: '',
};

const isPeriodic = (aplicacion) => aplicacion === 'POR_CUOTA' || aplicacion === 'MENSUAL';

// Ejemplo de referencia para un crédito de $10.000 a 12 meses (cuota francesa ≈ $888,49 al 12 % TEA)
function chargeExample(form) {
  const monto = 10000;
  if (form.tipo === 'VALOR_FIJO') {
    const valor = Number(form.valor) || 0;
    return isPeriodic(form.aplicacion)
      ? `${formatMoney(valor)} en cada cuota`
      : `${formatMoney(valor)} descontados al desembolso`;
  }
  const porcentaje = (Number(form.porcentaje) || 0) / 100;
  if (!isPeriodic(form.aplicacion)) {
    const valor = monto * porcentaje;
    return form.anualizarSiPlazoMenorAnio
      ? `${formatMoney(valor)} al desembolso (a 6 meses: ${formatMoney(valor / 2)})`
      : `${formatMoney(valor)} descontados al desembolso`;
  }
  const base = form.baseCalculo === 'CUOTA' ? 888.49 : monto;
  const prefix = form.baseCalculo === 'SALDO_INSOLUTO' ? 'Primera cuota: ' : 'Cada cuota: ';
  return `${prefix}${formatMoney(base * porcentaje)}`;
}

function describeCharge(charge) {
  return charge.tipo === 'PORCENTAJE'
    ? `${formatPercent(charge.porcentaje, 4)} del ${BASE_LABELS[charge.baseCalculo] || 'monto'}`
    : formatMoney(charge.valor);
}

export default function ChargesConfig() {
  const [charges, setCharges] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCharge, setEditingCharge] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [pageError, setPageError] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [chargesRes, productsRes] = await Promise.all([
        adminService.getCharges(),
        publicService.getCreditProducts(),
      ]);
      setCharges(chargesRes.data?.charges || []);
      setProducts(productsRes.data?.products || []);
    } catch (err) {
      setPageError(err.message || 'No se pudieron cargar los cobros.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const updateField = (field, value) => {
    setFormData((current) => ({
      ...current,
      [field]: value,
      // Una donación nunca puede ser obligatoria
      ...(field === 'categoria' && value === 'DONACION' ? { obligatorio: false } : {}),
    }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const openCreate = () => {
    setEditingCharge(null);
    setFormData(EMPTY_FORM);
    setFieldErrors({});
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (charge) => {
    setEditingCharge(charge);
    setFormData({
      nombre: charge.nombre,
      categoria: charge.categoria || 'GASTO_TERCEROS',
      tipo: charge.tipo,
      porcentaje: charge.tipo === 'PORCENTAJE' ? String(Number(charge.porcentaje)) : '',
      valor: charge.tipo === 'VALOR_FIJO' ? String(Number(charge.valor)) : '',
      aplicacion: charge.aplicacion === 'MENSUAL' ? 'POR_CUOTA' : charge.aplicacion,
      baseCalculo: charge.baseCalculo,
      anualizarSiPlazoMenorAnio: Boolean(charge.anualizarSiPlazoMenorAnio),
      obligatorio: Boolean(charge.obligatorio),
      creditTypeId: charge.creditTypeId ? String(charge.creditTypeId) : '',
      descripcion: charge.descripcion || '',
    });
    setFieldErrors({});
    setError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    const payload = {
      nombre: formData.nombre.trim(),
      categoria: formData.categoria,
      tipo: formData.tipo,
      aplicacion: formData.aplicacion,
      baseCalculo: formData.tipo === 'PORCENTAJE' ? formData.baseCalculo : 'MONTO_OPERACION',
      anualizarSiPlazoMenorAnio:
        formData.tipo === 'PORCENTAJE' && formData.aplicacion === 'UNA_VEZ' && formData.anualizarSiPlazoMenorAnio,
      obligatorio: formData.obligatorio,
      creditTypeId: formData.creditTypeId ? Number(formData.creditTypeId) : null,
      descripcion: formData.descripcion.trim() || null,
      porcentaje: formData.tipo === 'PORCENTAJE' ? formData.porcentaje : 0,
      valor: formData.tipo === 'VALOR_FIJO' ? formData.valor : 0,
    };

    try {
      if (editingCharge) {
        await adminService.updateCharge(editingCharge.id, payload);
      } else {
        await adminService.createCharge(payload);
      }
      setModalOpen(false);
      loadData();
    } catch (err) {
      setError(err.message || 'No se pudo guardar el cobro.');
      if (err.errors && !Array.isArray(err.errors)) setFieldErrors(err.errors);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (charge) => {
    setPageError(null);
    try {
      if (charge.activo) {
        await adminService.deleteCharge(charge.id);
      } else {
        await adminService.updateCharge(charge.id, { activo: true });
      }
      loadData();
    } catch (err) {
      setPageError(err.message || 'No se pudo cambiar el estado del cobro.');
    }
  };

  if (loading) {
    return <LoadingState message="Cargando cobros adicionales..." />;
  }

  return (
    <div className="space-y-space-md max-w-[1440px] mx-auto">
      <div className="bg-surface-container-lowest p-space-lg rounded-xl border border-surface-container-high shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
        <div>
          <h1 className="font-headline-lg text-[24px] sm:text-[28px] text-primary font-bold">
            Cobros adicionales
          </h1>
          <p className="font-body-sm text-[13px] text-on-surface-variant mt-0.5">
            Impuestos de ley, seguros y gastos a terceros que se suman al costo del crédito.
          </p>
        </div>
        <Button variant="fintech" onClick={openCreate} iconName="add">
          Nuevo cobro
        </Button>
      </div>

      <Alert type="info" title="Qué se puede cobrar">
        La ley prohíbe cobrar comisiones por conceder un crédito o por pagarlo por anticipado. Registra solo
        impuestos de ley (SOLCA: 0,5 % retenido al desembolso, anualizado si el plazo es menor a un año),
        seguros y gastos pagados a terceros. El seguro de desgravamen es obligatorio en créditos de vivienda;
        en los demás el cliente decide si lo contrata.
      </Alert>

      {pageError && <Alert type="error">{pageError}</Alert>}

      <Card title={`Cobros registrados (${charges.length})`}>
        <Table
          headers={[
            'Cobro',
            'Categoría',
            'Valor',
            'Se cobra',
            'Aplica a',
            'Cliente',
            'Estado',
            { label: 'Acciones', align: 'text-right' },
          ]}
        >
          {charges.map((charge) => (
            <tr
              key={charge.id}
              className={`transition-colors ${charge.activo ? 'hover:bg-surface-container-low/40' : 'opacity-60'}`}
            >
              <td className="py-3 px-4 text-[13px]">
                <span className="font-bold text-primary">{charge.nombre}</span>
                {charge.descripcion && (
                  <span className="block text-[11px] text-on-surface-variant max-w-[320px]">{charge.descripcion}</span>
                )}
              </td>
              <td className="py-3 px-4 text-[12px]">{CATEGORY_LABELS[charge.categoria] || '—'}</td>
              <td className="py-3 px-4 text-[13px] font-numeric-data">{describeCharge(charge)}</td>
              <td className="py-3 px-4 text-[12px]">
                {isPeriodic(charge.aplicacion) ? 'En cada cuota' : 'Al desembolso'}
                {charge.anualizarSiPlazoMenorAnio && (
                  <span className="block text-[11px] text-on-surface-variant">Anualizado si el plazo es menor a 1 año</span>
                )}
              </td>
              <td className="py-3 px-4 text-[12px]">
                {charge.creditTypeId ? charge.creditType?.nombre : 'Todos los créditos'}
              </td>
              <td className="py-3 px-4">
                <Badge variant={charge.obligatorio ? 'alert' : 'default'} size="sm">
                  {charge.obligatorio ? 'Obligatorio' : 'Opcional'}
                </Badge>
              </td>
              <td className="py-3 px-4">
                <Badge variant={charge.activo ? 'seps' : 'default'} size="sm">
                  {charge.activo ? 'Activo' : 'Inactivo'}
                </Badge>
              </td>
              <td className="py-3 px-4 text-right whitespace-nowrap">
                <Button variant="ghost" size="sm" iconName="edit" onClick={() => openEdit(charge)}>
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  iconName={charge.activo ? 'block' : 'check_circle'}
                  onClick={() => toggleActive(charge)}
                >
                  {charge.activo ? 'Desactivar' : 'Activar'}
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingCharge ? 'Editar cobro' : 'Nuevo cobro'}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {error && <Alert type="error">{error}</Alert>}

          <FormInput
            label="Nombre"
            name="nombre"
            value={formData.nombre}
            onChange={(e) => updateField('nombre', e.target.value)}
            placeholder="Ej: Seguro de incendio"
            error={fieldErrors.nombre}
            required
          />

          <FormInput
            type="select"
            label="Categoría"
            name="categoria"
            value={formData.categoria}
            onChange={(e) => updateField('categoria', e.target.value)}
            options={CATEGORY_OPTIONS}
            error={fieldErrors.categoria}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormInput
              type="select"
              label="Tipo"
              name="tipo"
              value={formData.tipo}
              onChange={(e) => updateField('tipo', e.target.value)}
              options={[
                { value: 'PORCENTAJE', label: 'Porcentaje (%)' },
                { value: 'VALOR_FIJO', label: 'Valor fijo ($)' },
              ]}
            />
            {formData.tipo === 'PORCENTAJE' ? (
              <FormInput
                label="Porcentaje"
                name="porcentaje"
                inputMode="decimal"
                suffix="%"
                value={formData.porcentaje}
                onChange={(e) => updateField('porcentaje', e.target.value.replace(',', '.'))}
                error={fieldErrors.porcentaje}
                required
              />
            ) : (
              <FormInput
                label="Valor"
                name="valor"
                inputMode="decimal"
                prefix="$"
                value={formData.valor}
                onChange={(e) => updateField('valor', e.target.value.replace(',', '.'))}
                error={fieldErrors.valor}
                required
              />
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormInput
              type="select"
              label="¿Cuándo se cobra?"
              name="aplicacion"
              value={formData.aplicacion}
              onChange={(e) => updateField('aplicacion', e.target.value)}
              options={[
                { value: 'UNA_VEZ', label: 'Al desembolso (se descuenta)' },
                { value: 'POR_CUOTA', label: 'En cada cuota' },
              ]}
            />
            {formData.tipo === 'PORCENTAJE' && (
              <FormInput
                type="select"
                label="Se calcula sobre"
                name="baseCalculo"
                value={formData.baseCalculo}
                onChange={(e) => updateField('baseCalculo', e.target.value)}
                options={[
                  { value: 'MONTO_OPERACION', label: 'Monto del crédito' },
                  { value: 'SALDO_INSOLUTO', label: 'Saldo de capital' },
                  { value: 'CUOTA', label: 'Valor de la cuota' },
                ]}
              />
            )}
          </div>

          <FormInput
            type="select"
            label="Aplica a"
            name="creditTypeId"
            value={formData.creditTypeId}
            onChange={(e) => updateField('creditTypeId', e.target.value)}
            options={[
              { value: '', label: 'Todos los créditos' },
              ...products.map((p) => ({ value: String(p.id), label: p.nombre })),
            ]}
            error={fieldErrors.creditTypeId}
          />

          <div className="space-y-2 p-3 rounded-lg bg-surface-container-low border border-surface-container-high">
            <label className="flex items-start gap-2.5 cursor-pointer text-[13px]">
              <input
                type="checkbox"
                checked={formData.obligatorio}
                disabled={formData.categoria === 'DONACION'}
                onChange={(e) => updateField('obligatorio', e.target.checked)}
                className="h-4 w-4 mt-0.5 accent-secondary"
              />
              <span>
                <strong className="text-primary">Obligatorio</strong>
                <span className="block text-[11px] text-on-surface-variant">
                  Si no se marca, el cliente puede excluirlo en el simulador.
                </span>
              </span>
            </label>
            {formData.tipo === 'PORCENTAJE' && formData.aplicacion === 'UNA_VEZ' && (
              <label className="flex items-start gap-2.5 cursor-pointer text-[13px]">
                <input
                  type="checkbox"
                  checked={formData.anualizarSiPlazoMenorAnio}
                  onChange={(e) => updateField('anualizarSiPlazoMenorAnio', e.target.checked)}
                  className="h-4 w-4 mt-0.5 accent-secondary"
                />
                <span>
                  <strong className="text-primary">Anualizar si el plazo es menor a un año</strong>
                  <span className="block text-[11px] text-on-surface-variant">
                    Monto × porcentaje × días/360, como la contribución SOLCA.
                  </span>
                </span>
              </label>
            )}
          </div>

          <FormInput
            type="textarea"
            label="Descripción o base legal"
            name="descripcion"
            value={formData.descripcion}
            onChange={(e) => updateField('descripcion', e.target.value)}
            rows={2}
            error={fieldErrors.descripcion}
          />

          <p className="text-[12px] text-on-surface-variant">
            Ejemplo en un crédito de $10.000 a 12 meses:{' '}
            <strong className="text-primary">{chargeExample(formData)}</strong>
          </p>

          <div className="pt-3 border-t border-surface-container-high flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="fintech" loading={submitting} loadingText="Guardando..." iconName="save">
              Guardar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
