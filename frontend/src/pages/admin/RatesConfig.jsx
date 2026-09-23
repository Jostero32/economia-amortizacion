import React, { useEffect, useState } from 'react';
import { adminService, publicService } from '../../services/api';
import Card from '../../components/Card';
import Table from '../../components/Table';
import Button from '../../components/Button';
import FormInput from '../../components/FormInput';
import Modal from '../../components/Modal';
import Badge from '../../components/Badge';
import Alert from '../../components/Alert';
import { LoadingState } from '../../components/Spinner';

export default function RatesConfig() {
  const [segments, setSegments] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [formData, setFormData] = useState({
    tasa: '',
    fechaVigencia: new Date().toISOString().split('T')[0],
    fuente: 'Banco Central del Ecuador',
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = () => {
    setLoading(true);
    Promise.all([adminService.getSegments(), publicService.getCreditProducts()])
      .then(([segRes, prodRes]) => {
        if (segRes.success) setSegments(segRes.data.segments || []);
        if (prodRes.success) setProducts(prodRes.data.products || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const openNewRateModal = (prod) => {
    setSelectedProduct(prod);
    setFormData({
      tasa: String(prod.tasaInstitucion),
      fechaVigencia: new Date().toISOString().split('T')[0],
      fuente: 'Banco Central del Ecuador - Resolución JPRMF',
    });
    setError(null);
    setModalOpen(true);
  };

  const handleSaveRate = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const maxRate = Number(selectedProduct.segment?.tasaMaxima);
    if (Number(formData.tasa) > maxRate) {
      setError(`La tasa ingresada (${formData.tasa}%) supera el techo legal del BCE (${maxRate}%).`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await adminService.createRate({
        creditTypeId: selectedProduct.id,
        tasa: parseFloat(formData.tasa),
        fechaVigencia: formData.fechaVigencia,
        fuente: formData.fuente,
      });

      setModalOpen(false);
      loadData();
    } catch (err) {
      setError(err.message || 'Error al guardar la nueva tasa.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingState message="Cargando cuadro de tasas oficiales del BCE..." />;
  }

  return (
    <div className="space-y-space-md max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="bg-surface-container-lowest p-space-lg rounded-xl border border-surface-container-high shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="bce" iconName="balance">
              Banco Central del Ecuador
            </Badge>
            <span className="font-badge-label text-[11px] text-on-surface-variant uppercase">
              Vigencia Oficial: Septiembre 2026
            </span>
          </div>
          <h1 className="font-headline-lg text-[24px] sm:text-[28px] text-primary font-bold">
            Marco Regulatorio de Tasas Oficiales
          </h1>
          <p className="font-body-sm text-[13px] text-on-surface-variant mt-0.5">
            Diferenciación estricta entre Tasas Referenciales, Techos Legales Máximos del BCE y Tasas de Producto.
          </p>
        </div>
      </div>

      {/* Distinction Guide Box (Requerimiento 32) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200">
          <span className="font-title-md text-[13px] text-secondary font-bold block mb-1">
            1. Tasa Referencial BCE
          </span>
          <p className="font-body-sm text-[11px] text-on-surface-variant leading-relaxed">
            Tasa promedio ponderada calculada por el Banco Central a partir de las operaciones efectivas reportadas por las instituciones financieras.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-red-50/60 border border-red-200">
          <span className="font-title-md text-[13px] text-error font-bold block mb-1">
            2. Tasa Máxima BCE (Techo Legal)
          </span>
          <p className="font-body-sm text-[11px] text-on-surface-variant leading-relaxed">
            Límite legal inquebrantable establecido por la Junta de Política y Regulación Financiera. Cobrar por encima constituye infracción y usura.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high">
          <span className="font-title-md text-[13px] text-primary font-bold block mb-1">
            3. Tasa de Producto (Institucional)
          </span>
          <p className="font-body-sm text-[11px] text-on-surface-variant leading-relaxed">
            Tasa efectiva anual (TEA) pactada contractualmente por FinanEcuador para cada producto. Debe ser siempre menor o igual al techo legal.
          </p>
        </div>
      </div>

      {/* Tabla Oficial de Segmentos BCE (Requerimiento 32) */}
      <Card
        title="Segmentos y Tasas del Banco Central del Ecuador"
        subtitle="Fuente oficial: Banco Central del Ecuador (BCE) • Vigencia: Septiembre 2026"
        iconName="balance"
      >
        <Table
          headers={[
            'Segmento Crediticio',
            { label: 'Tasa Referencial BCE', align: 'text-right' },
            { label: 'Tasa Máxima BCE (Techo)', align: 'text-right' },
            'Fuente Oficial',
            'Vigencia',
          ]}
        >
          {segments.map((s) => (
            <tr key={s.id} className="hover:bg-surface-container-low/40 transition-colors">
              <td className="py-3 px-4 font-bold text-primary font-body-sm text-[13px]">
                {s.nombre}
              </td>
              <td className="py-3 px-4 text-right font-numeric-data font-bold text-secondary text-[14px]">
                {Number(s.tasaReferencial).toFixed(2)}%
              </td>
              <td className="py-3 px-4 text-right font-numeric-data font-bold text-error text-[14px]">
                {Number(s.tasaMaxima).toFixed(2)}%
              </td>
              <td className="py-3 px-4 text-on-surface-variant font-body-sm text-[12px]">
                Banco Central del Ecuador
              </td>
              <td className="py-3 px-4 text-on-surface font-numeric-data text-[12px]">
                Septiembre 2026
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      {/* Tabla de Tasas Institucionales Configuradas */}
      <Card
        title="Tasas Configuradas por Producto en FinanEcuador"
        subtitle="Ajuste y actualización de tasas por producto para el simulador"
        iconName="tune"
      >
        <Table
          headers={[
            'Producto de Crédito',
            'Segmento BCE',
            { label: 'Tasa Configurada', align: 'text-right' },
            { label: 'Techo Legal BCE', align: 'text-right' },
            'Estado',
            { label: 'Acción', align: 'text-right' },
          ]}
        >
          {products.map((p) => (
            <tr key={p.id} className="hover:bg-surface-container-low/40 transition-colors">
              <td className="py-3 px-4 font-bold text-primary font-body-sm text-[13px]">
                {p.nombre}
              </td>
              <td className="py-3 px-4 text-on-surface-variant font-body-sm text-[12px]">
                {p.segment?.nombre}
              </td>
              <td className="py-3 px-4 text-right font-numeric-data font-bold text-secondary text-[15px]">
                {Number(p.tasaInstitucion).toFixed(2)}%
              </td>
              <td className="py-3 px-4 text-right font-numeric-data font-semibold text-primary text-[13px]">
                {Number(p.segment?.tasaMaxima || 0).toFixed(2)}%
              </td>
              <td className="py-3 px-4">
                <Badge variant={p.activo ? 'seps' : 'alert'} size="sm">
                  {p.activo ? 'Vigente' : 'Inactivo'}
                </Badge>
              </td>
              <td className="py-3 px-4 text-right">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openNewRateModal(p)}
                  iconName="tune"
                >
                  Modificar tasa
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      {/* Modal para Modificar Tasa Institucional */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`Ajustar Tasa: ${selectedProduct?.nombre}`}
        maxWidth="max-w-md"
      >
        {selectedProduct && (
          <form onSubmit={handleSaveRate} className="space-y-4">
            {error && <Alert type="error" title="Error">{error}</Alert>}

            <div className="p-3.5 rounded-lg bg-surface-container-low border border-surface-container-high space-y-1 text-[12px]">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Segmento BCE:</span>
                <span className="font-bold text-primary">{selectedProduct.segment?.nombre}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Tasa Referencial:</span>
                <span className="font-numeric-data font-bold text-secondary">
                  {Number(selectedProduct.segment?.tasaReferencial).toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Techo Máximo Legal:</span>
                <span className="font-numeric-data font-bold text-error">
                  {Number(selectedProduct.segment?.tasaMaxima).toFixed(2)}%
                </span>
              </div>
            </div>

            <FormInput
              type="number"
              step="0.01"
              label="Nueva Tasa Institucional (TEA)"
              name="tasa"
              value={formData.tasa}
              onChange={(e) => setFormData((p) => ({ ...p, tasa: e.target.value }))}
              suffix="%"
              required
              hint={`No puede superar el techo legal de ${selectedProduct.segment?.tasaMaxima}%`}
            />

            <FormInput
              type="date"
              label="Fecha de Entrada en Vigencia"
              name="fechaVigencia"
              value={formData.fechaVigencia}
              onChange={(e) => setFormData((p) => ({ ...p, fechaVigencia: e.target.value }))}
              required
            />

            <FormInput
              label="Fuente / Resolución"
              name="fuente"
              value={formData.fuente}
              onChange={(e) => setFormData((p) => ({ ...p, fuente: e.target.value }))}
              required
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
                Guardar nueva tasa
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
