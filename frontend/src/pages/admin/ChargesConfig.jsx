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

export default function ChargesConfig() {
  const [charges, setCharges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    tipo: 'PORCENTAJE',
    valor: '0',
    porcentaje: '0.50',
    baseCalculo: 'MONTO_OPERACION',
    aplicacion: 'UNA_VEZ',
    obligatorio: false,
    descripcion: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const loadData = () => {
    setLoading(true);
    publicService
      .getCreditProducts()
      .then((res) => {
        if (res.success && res.data?.generalCharges) {
          setCharges(res.data.generalCharges);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateCharge = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await adminService.createCharge({
        ...formData,
        valor: parseFloat(formData.valor) || 0,
        porcentaje: parseFloat(formData.porcentaje) || 0,
      });
      setModalOpen(false);
      loadData();
    } catch (err) {
      setError(err.message || 'Error al registrar cobro adicional.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCharge = async (id) => {
    if (window.confirm('¿Desea desactivar este cobro adicional?')) {
      try {
        await adminService.deleteCharge(id);
        loadData();
      } catch (err) {
        alert(err.message || 'Error al eliminar el cobro.');
      }
    }
  };

  if (loading) {
    return <LoadingState message="Cargando catálogo de cobros y retenciones..." />;
  }

  return (
    <div className="space-y-space-md max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="bg-surface-container-lowest p-space-lg rounded-xl border border-surface-container-high shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="bce" iconName="receipt_long">
              Marco Legal y Operativo
            </Badge>
          </div>
          <h1 className="font-headline-lg text-[24px] sm:text-[28px] text-primary font-bold">
            Cobros Adicionales y Retenciones
          </h1>
          <p className="font-body-sm text-[13px] text-on-surface-variant mt-0.5">
            Configuración de contribuciones obligatorias (SOLCA 0.50%), seguros de desgravamen y cargos por cuota.
          </p>
        </div>

        <Button
          variant="fintech"
          onClick={() => {
            setFormData({
              nombre: '',
              tipo: 'PORCENTAJE',
              valor: '0',
              porcentaje: '0.065',
              baseCalculo: 'SALDO_INSOLUTO',
              aplicacion: 'POR_CUOTA',
              obligatorio: false,
              descripcion: '',
            });
            setModalOpen(true);
          }}
          iconName="add"
        >
          Nuevo Cobro Adicional
        </Button>
      </div>

      {/* Info note regarding insurance not being universally mandatory (Requerimiento 33) */}
      <div className="bg-surface-container-low p-3.5 rounded-xl border border-surface-container-high text-[12px] text-on-surface-variant flex items-start gap-2.5">
        <span className="material-symbols-outlined text-secondary text-[20px] flex-shrink-0 mt-0.5">
          info
        </span>
        <div>
          <strong className="text-primary font-bold">Criterio Regulatorio de Aplicación:</strong> La contribución del 0.50% para SOLCA es una retención legal única obligatoria sobre el monto de la operación crediticia. El seguro de desgravamen se configura por producto y no es universalmente obligatorio para todas las operaciones según la normativa ecuatoriana.
        </div>
      </div>

      <Card title={`Cobros y Retenciones Registrados (${charges.length})`}>
        <Table
          headers={[
            'Nombre del Cobro',
            'Tipo',
            { label: 'Valor / Tarifa', align: 'text-right' },
            'Aplicación',
            'Obligatorio',
            'Estado',
            { label: 'Acción', align: 'text-right' },
          ]}
        >
          {charges.map((c) => (
            <tr key={c.id} className="hover:bg-surface-container-low/40 transition-colors">
              <td className="py-3 px-4 font-bold text-primary font-body-sm text-[13px]">
                {c.nombre}
                {c.descripcion && (
                  <span className="block font-normal text-[11px] text-on-surface-variant">
                    {c.descripcion}
                  </span>
                )}
              </td>
              <td className="py-3 px-4 text-on-surface-variant font-body-sm text-[12px]">
                {c.tipo === 'PORCENTAJE' ? 'Porcentaje (%)' : 'Valor Fijo ($)'}
              </td>
              <td className="py-3 px-4 text-right font-numeric-data font-bold text-primary text-[14px]">
                {c.tipo === 'PORCENTAJE' ? `${Number(c.porcentaje).toFixed(2)}%` : `$ ${Number(c.valor).toFixed(2)}`}
              </td>
              <td className="py-3 px-4 text-on-surface font-body-sm text-[12px]">
                {c.aplicacion === 'UNA_VEZ' ? 'Una sola vez' : 'Por cuota mensual'}
              </td>
              <td className="py-3 px-4">
                <Badge variant={c.obligatorio ? 'alert' : 'default'} size="sm">
                  {c.obligatorio ? 'Obligatorio' : 'Opcional / Por producto'}
                </Badge>
              </td>
              <td className="py-3 px-4">
                <Badge variant={c.activo ? 'seps' : 'alert'} size="sm">
                  {c.activo ? 'Activo' : 'Inactivo'}
                </Badge>
              </td>
              <td className="py-3 px-4 text-right">
                <button
                  onClick={() => handleDeleteCharge(c.id)}
                  className="p-1.5 text-on-surface-variant hover:text-error rounded-lg hover:bg-error-container/30 transition-colors"
                  title="Desactivar"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      {/* Modal Crear Cobro */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Configurar Nuevo Cobro o Retención"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleCreateCharge} className="space-y-4">
          {error && <Alert type="error" title="Error">{error}</Alert>}

          <FormInput
            label="Nombre del Cobro / Cargo"
            name="nombre"
            value={formData.nombre}
            onChange={(e) => setFormData((p) => ({ ...p, nombre: e.target.value }))}
            placeholder="Ej: Seguro de Desgravamen Mensual"
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormInput
              type="select"
              label="Tipo de Cargo"
              name="tipo"
              value={formData.tipo}
              onChange={(e) => setFormData((p) => ({ ...p, tipo: e.target.value }))}
              options={[
                { value: 'PORCENTAJE', label: 'Porcentaje (%)' },
                { value: 'FIJO', label: 'Valor Fijo en USD ($)' },
              ]}
            />

            {formData.tipo === 'PORCENTAJE' ? (
              <FormInput
                type="number"
                step="0.001"
                label="Porcentaje Aplicable"
                name="porcentaje"
                value={formData.porcentaje}
                onChange={(e) => setFormData((p) => ({ ...p, porcentaje: e.target.value }))}
                suffix="%"
                required
              />
            ) : (
              <FormInput
                type="number"
                step="0.01"
                label="Valor Fijo en USD"
                name="valor"
                value={formData.valor}
                onChange={(e) => setFormData((p) => ({ ...p, valor: e.target.value }))}
                prefix="$"
                required
              />
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormInput
              type="select"
              label="Momento de Aplicación"
              name="aplicacion"
              value={formData.aplicacion}
              onChange={(e) => setFormData((p) => ({ ...p, aplicacion: e.target.value }))}
              options={[
                { value: 'UNA_VEZ', label: 'Una sola vez (Al inicio)' },
                { value: 'POR_CUOTA', label: 'En cada cuota mensual' },
              ]}
            />

            <FormInput
              type="select"
              label="Base de Cálculo"
              name="baseCalculo"
              value={formData.baseCalculo}
              onChange={(e) => setFormData((p) => ({ ...p, baseCalculo: e.target.value }))}
              options={[
                { value: 'MONTO_OPERACION', label: 'Monto de la Operación' },
                { value: 'SALDO_INSOLUTO', label: 'Saldo Insoluto / Pendiente' },
              ]}
            />
          </div>

          <div className="p-3 rounded-lg bg-surface-container-low border border-surface-container-high">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                name="obligatorio"
                checked={formData.obligatorio}
                onChange={(e) => setFormData((p) => ({ ...p, obligatorio: e.target.checked }))}
                className="h-4 w-4 rounded accent-secondary cursor-pointer"
              />
              <span className="font-title-md text-[13px] text-primary font-bold">
                Marcar como cobro obligatorio universal
              </span>
            </label>
            <p className="font-body-sm text-[11px] text-on-surface-variant pl-6 mt-0.5">
              (No marcar si es un seguro que se contrata según el producto de crédito).
            </p>
          </div>

          <FormInput
            type="textarea"
            label="Descripción o Base Legal"
            name="descripcion"
            value={formData.descripcion}
            onChange={(e) => setFormData((p) => ({ ...p, descripcion: e.target.value }))}
            placeholder="Fundamento normativo o condición aplicable..."
            rows={2}
          />

          <div className="pt-3 border-t border-surface-container-high flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="fintech"
              loading={submitting}
              loadingText="Guardando..."
              iconName="save"
            >
              Guardar cobro
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
