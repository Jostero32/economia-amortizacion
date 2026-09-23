import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { adminService, publicService } from '../../services/api';
import Card from '../../components/Card';
import Button from '../../components/Button';
import FormInput from '../../components/FormInput';
import Alert from '../../components/Alert';
import Badge from '../../components/Badge';
import { LoadingState } from '../../components/Spinner';

export default function CreditTypeForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    segmentId: '',
    tasaInstitucion: '15.50',
    montoMinimo: '500',
    montoMaximo: '25000',
    plazoMinimo: '6',
    plazoMaximo: '48',
    activo: true,
  });

  const selectedSegment = segments.find((s) => String(s.id) === String(formData.segmentId));

  useEffect(() => {
    adminService
      .getSegments()
      .then((res) => {
        if (res.success && res.data?.segments) {
          setSegments(res.data.segments);
          if (!isEditing && res.data.segments.length > 0) {
            setFormData((prev) => ({
              ...prev,
              segmentId: String(res.data.segments[0].id),
              tasaInstitucion: String(res.data.segments[0].tasaReferencial || '15.50'),
            }));
          }
        }
      })
      .catch(console.error);

    if (isEditing) {
      publicService
        .getCreditProductById(id)
        .then((res) => {
          if (res.success && res.data?.product) {
            const p = res.data.product;
            setFormData({
              nombre: p.nombre,
              descripcion: p.descripcion || '',
              segmentId: String(p.segmentId),
              tasaInstitucion: String(p.tasaInstitucion),
              montoMinimo: String(p.montoMinimo),
              montoMaximo: String(p.montoMaximo),
              plazoMinimo: String(p.plazoMinimo),
              plazoMaximo: String(p.plazoMaximo),
              activo: Boolean(p.activo),
            });
          }
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [id, isEditing]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const finalValue = type === 'checkbox' ? checked : value;
    setFormData((prev) => ({ ...prev, [name]: finalValue }));

    // Si cambia el segmento y es nuevo, sugerir la tasa referencial
    if (name === 'segmentId' && !isEditing) {
      const seg = segments.find((s) => String(s.id) === String(value));
      if (seg) {
        setFormData((prev) => ({ ...prev, tasaInstitucion: String(seg.tasaReferencial) }));
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validación estricta en frontend contra el techo legal del BCE (Requerimiento 31)
    if (selectedSegment && Number(formData.tasaInstitucion) > Number(selectedSegment.tasaMaxima)) {
      setError(
        `Operación rechazada: La tasa configurada (${formData.tasaInstitucion}%) supera la tasa activa máxima fijada por el BCE (${selectedSegment.tasaMaxima}%).`
      );
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        nombre: formData.nombre,
        descripcion: formData.descripcion,
        segmentId: parseInt(formData.segmentId, 10),
        tasaInstitucion: parseFloat(formData.tasaInstitucion),
        montoMinimo: parseFloat(formData.montoMinimo),
        montoMaximo: parseFloat(formData.montoMaximo),
        plazoMinimo: parseInt(formData.plazoMinimo, 10),
        plazoMaximo: parseInt(formData.plazoMaximo, 10),
        activo: formData.activo,
      };

      if (isEditing) {
        await adminService.updateCreditProduct(id, payload);
      } else {
        await adminService.createCreditProduct(payload);
      }

      navigate('/admin/creditos');
    } catch (err) {
      setError(err.message || 'Error al guardar el producto de crédito.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingState message="Cargando datos del producto..." />;
  }

  // Warning if rate is close to maximum ceiling (>95%)
  const isCloseToMax =
    selectedSegment &&
    Number(formData.tasaInstitucion) > Number(selectedSegment.tasaMaxima) * 0.95 &&
    Number(formData.tasaInstitucion) <= Number(selectedSegment.tasaMaxima);

  const isExceedingMax =
    selectedSegment && Number(formData.tasaInstitucion) > Number(selectedSegment.tasaMaxima);

  return (
    <div className="max-w-3xl mx-auto space-y-space-md">
      {/* Header */}
      <div className="bg-surface-container-lowest p-space-lg rounded-xl border border-surface-container-high shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
        <div>
          <div className="flex items-center gap-1.5 text-on-surface-variant font-body-sm text-[12px] mb-1">
            <Link to="/admin/creditos" className="hover:text-secondary flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">arrow_back</span>
              Productos de crédito
            </Link>
            <span>/</span>
            <span className="text-primary font-semibold">
              {isEditing ? 'Editar Producto' : 'Crear Producto'}
            </span>
          </div>
          <h1 className="font-headline-lg text-[24px] text-primary font-bold">
            {isEditing ? `Editar: ${formData.nombre}` : 'Nuevo Producto de Crédito'}
          </h1>
          <p className="font-body-sm text-[13px] text-on-surface-variant mt-0.5">
            Definición de parámetros, límites y validación regulatoria frente al Banco Central del Ecuador.
          </p>
        </div>
      </div>

      {error && <Alert type="error" title="Atención">{error}</Alert>}

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormInput
            label="Nombre del Producto de Crédito"
            name="nombre"
            value={formData.nombre}
            onChange={handleChange}
            placeholder="Ej: Crédito de Consumo Ordinario"
            required
          />

          <FormInput
            type="textarea"
            label="Descripción Institucional"
            name="descripcion"
            value={formData.descripcion}
            onChange={handleChange}
            placeholder="Describe las condiciones, requisitos o destino de los fondos..."
            rows={3}
          />

          {/* Segment Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="font-title-md text-[13px] text-primary" htmlFor="segmentId">
              Segmento Regulatorio BCE
            </label>
            <div className="relative">
              <select
                id="segmentId"
                name="segmentId"
                value={formData.segmentId}
                onChange={handleChange}
                className="w-full h-11 px-3.5 pr-10 rounded-lg bg-surface-container-low text-on-surface font-body-md text-[13px] border border-surface-container-high focus:outline-none focus:border-secondary appearance-none cursor-pointer"
                required
              >
                {segments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre} (Máx: {Number(s.tasaMaxima).toFixed(2)}% | Ref: {Number(s.tasaReferencial).toFixed(2)}%)
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant text-[20px]">
                expand_more
              </span>
            </div>
          </div>

          {/* BCE Comparison Box (Requerimiento 31) */}
          {selectedSegment && (
            <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container-high space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-title-md text-[13px] text-primary font-bold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-secondary">balance</span>
                  Límites Legales del Segmento: {selectedSegment.nombre}
                </span>
                <span className="font-badge-label text-[10px] text-on-surface-variant uppercase">
                  Resolución Vigente
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-[13px] pt-1 border-t border-surface-container-high/60">
                <div>
                  <span className="text-on-surface-variant text-[11px] block">Tasa Referencial BCE:</span>
                  <span className="font-numeric-data font-bold text-primary text-[15px]">
                    {Number(selectedSegment.tasaReferencial).toFixed(2)}%
                  </span>
                </div>
                <div>
                  <span className="text-on-surface-variant text-[11px] block">Tasa Máxima Permitida (Techo):</span>
                  <span className="font-numeric-data font-bold text-primary text-[15px]">
                    {Number(selectedSegment.tasaMaxima).toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* Warning if rate is close to or exceeding max */}
              {isExceedingMax ? (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-900 text-[12px] flex items-center gap-2">
                  <span className="material-symbols-outlined text-red-600 text-[18px]">gavel</span>
                  <span><strong>¡Tasa Máxima Excedida!</strong> El valor ingresado supera el techo legal del Banco Central.</span>
                </div>
              ) : isCloseToMax ? (
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[12px] flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-600 text-[18px]">warning</span>
                  <span><strong>Advertencia:</strong> La tasa configurada se acerca al techo legal máximo ({selectedSegment.tasaMaxima}%).</span>
                </div>
              ) : null}
            </div>
          )}

          {/* Rate Input */}
          <FormInput
            type="number"
            step="0.01"
            label="Tasa Activa Efectiva Anual de la Institución (TEA)"
            name="tasaInstitucion"
            value={formData.tasaInstitucion}
            onChange={handleChange}
            suffix="%"
            placeholder="15.50"
            required
            hint="Tasa pactada para los clientes. Debe ser menor o igual al techo legal del BCE."
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormInput
              type="number"
              label="Monto Mínimo ($ USD)"
              name="montoMinimo"
              value={formData.montoMinimo}
              onChange={handleChange}
              prefix="$"
              required
            />
            <FormInput
              type="number"
              label="Monto Máximo ($ USD)"
              name="montoMaximo"
              value={formData.montoMaximo}
              onChange={handleChange}
              prefix="$"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormInput
              type="number"
              label="Plazo Mínimo (Meses)"
              name="plazoMinimo"
              value={formData.plazoMinimo}
              onChange={handleChange}
              suffix="meses"
              required
            />
            <FormInput
              type="number"
              label="Plazo Máximo (Meses)"
              name="plazoMaximo"
              value={formData.plazoMaximo}
              onChange={handleChange}
              suffix="meses"
              required
            />
          </div>

          <div className="p-3 rounded-lg bg-surface-container-low border border-surface-container-high">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                name="activo"
                checked={formData.activo}
                onChange={handleChange}
                className="h-4 w-4 rounded accent-secondary cursor-pointer"
              />
              <span className="font-title-md text-[13px] text-primary font-bold">
                Producto Activo en el Simulador Público
              </span>
            </label>
          </div>

          <div className="pt-4 border-t border-surface-container-high flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/admin/creditos')}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="fintech"
              loading={submitting}
              loadingText="Guardando producto..."
              disabled={Boolean(isExceedingMax)}
              iconName="save"
            >
              {isEditing ? 'Guardar cambios' : 'Crear producto de crédito'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
