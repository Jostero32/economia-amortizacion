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

export default function InvestmentProductsList() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    montoMinimo: '500',
    montoMaximo: '100000',
    plazoMinimoDias: '30',
    plazoMaximoDias: '1080',
    activo: true,
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const loadProducts = () => {
    setLoading(true);
    publicService
      .getInvestmentProducts()
      .then((res) => {
        if (res.success && res.data?.products) {
          setProducts(res.data.products);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const openCreateModal = () => {
    setEditingProduct(null);
    setFormData({
      nombre: '',
      descripcion: '',
      montoMinimo: '500',
      montoMaximo: '100000',
      plazoMinimoDias: '30',
      plazoMaximoDias: '1080',
      activo: true,
    });
    setError(null);
    setModalOpen(true);
  };

  const openEditModal = (p) => {
    setEditingProduct(p);
    setFormData({
      nombre: p.nombre,
      descripcion: p.descripcion || '',
      montoMinimo: String(p.montoMinimo),
      montoMaximo: String(p.montoMaximo),
      plazoMinimoDias: String(p.plazoMinimoDias || 30),
      plazoMaximoDias: String(p.plazoMaximoDias || 1080),
      activo: Boolean(p.activo),
    });
    setError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        nombre: formData.nombre,
        descripcion: formData.descripcion,
        montoMinimo: parseFloat(formData.montoMinimo),
        montoMaximo: parseFloat(formData.montoMaximo),
        plazoMinimoDias: parseInt(formData.plazoMinimoDias, 10),
        plazoMaximoDias: parseInt(formData.plazoMaximoDias, 10),
        activo: formData.activo,
      };

      if (editingProduct) {
        await adminService.updateInvestmentProduct(editingProduct.id, payload);
      } else {
        await adminService.createInvestmentProduct(payload);
      }

      setModalOpen(false);
      loadProducts();
    } catch (err) {
      setError(err.message || 'Error al guardar el producto de inversión.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (p) => {
    try {
      await adminService.updateInvestmentProduct(p.id, { activo: !p.activo });
      loadProducts();
    } catch (err) {
      alert(err.message || 'Error al cambiar estado.');
    }
  };

  const formatUSD = (val) =>
    new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(val || 0);

  if (loading) {
    return <LoadingState message="Cargando productos de inversión..." />;
  }

  return (
    <div className="space-y-space-md max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="bg-surface-container-lowest p-space-lg rounded-xl border border-surface-container-high shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="bce" iconName="savings">
              Renta Fija Institucional
            </Badge>
          </div>
          <h1 className="font-headline-lg text-[24px] sm:text-[28px] text-primary font-bold">
            Administración de Productos de Inversión
          </h1>
          <p className="font-body-sm text-[13px] text-on-surface-variant mt-0.5">
            Depósitos a Plazo Fijo (DPF), pólizas y tramos de tasas de interés pasivas reguladas por el BCE.
          </p>
        </div>

        <Button variant="fintech" onClick={openCreateModal} iconName="add">
          Nuevo Producto
        </Button>
      </div>

      <Card title={`Portafolio de Inversión Configurado (${products.length})`}>
        <Table
          headers={[
            'Producto',
            'Plazo en Días',
            { label: 'Tasa Máx. Tramo', align: 'text-right' },
            { label: 'Monto Mínimo', align: 'text-right' },
            'Estado',
            { label: 'Acción', align: 'text-right' },
          ]}
        >
          {products.map((p) => {
            const maxRate =
              p.rates && p.rates.length > 0
                ? Math.max(...p.rates.map((r) => Number(r.tasa)))
                : 8.65;

            return (
              <tr key={p.id} className="hover:bg-surface-container-low/40 transition-colors">
                <td className="py-3 px-4 font-bold text-primary font-body-sm text-[13px]">
                  {p.nombre}
                  {p.descripcion && (
                    <span className="block font-normal text-[11px] text-on-surface-variant truncate max-w-xs">
                      {p.descripcion}
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 font-numeric-data text-[13px] text-on-surface">
                  {p.plazoMinimoDias || 30} a {p.plazoMaximoDias || 1080} días
                </td>
                <td className="py-3 px-4 text-right font-numeric-data font-bold text-secondary text-[14px]">
                  Hasta {maxRate.toFixed(2)}%
                </td>
                <td className="py-3 px-4 text-right font-numeric-data font-semibold text-primary text-[13px]">
                  {formatUSD(p.montoMinimo)}
                </td>
                <td className="py-3 px-4">
                  <Badge variant={p.activo ? 'seps' : 'alert'} size="sm">
                    {p.activo ? 'Activo' : 'Inactivo'}
                  </Badge>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => openEditModal(p)}
                      className="p-1.5 text-on-surface-variant hover:text-secondary rounded-lg hover:bg-surface-container transition-colors"
                      title="Editar"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button
                      onClick={() => handleToggleActive(p)}
                      className="p-1.5 text-on-surface-variant hover:text-error rounded-lg hover:bg-error-container/30 transition-colors"
                      title={p.activo ? 'Desactivar' : 'Activar'}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {p.activo ? 'block' : 'check_circle'}
                      </span>
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </Table>
      </Card>

      {/* Modal Crear / Editar Producto de Inversión */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingProduct ? 'Editar Producto de Inversión' : 'Nuevo Producto de Inversión'}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert type="error" title="Error">{error}</Alert>}

          <FormInput
            label="Nombre del Producto de Inversión"
            name="nombre"
            value={formData.nombre}
            onChange={(e) => setFormData((p) => ({ ...p, nombre: e.target.value }))}
            placeholder="Ej: Depósito a Plazo Fijo Institucional (DPF)"
            required
          />

          <FormInput
            type="textarea"
            label="Descripción"
            name="descripcion"
            value={formData.descripcion}
            onChange={(e) => setFormData((p) => ({ ...p, descripcion: e.target.value }))}
            placeholder="Condiciones del certificado fiduciario..."
            rows={2}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormInput
              type="number"
              label="Monto Mínimo ($ USD)"
              name="montoMinimo"
              value={formData.montoMinimo}
              onChange={(e) => setFormData((p) => ({ ...p, montoMinimo: e.target.value }))}
              prefix="$"
              required
            />
            <FormInput
              type="number"
              label="Monto Máximo ($ USD)"
              name="montoMaximo"
              value={formData.montoMaximo}
              onChange={(e) => setFormData((p) => ({ ...p, montoMaximo: e.target.value }))}
              prefix="$"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormInput
              type="number"
              label="Plazo Mínimo (Días)"
              name="plazoMinimoDias"
              value={formData.plazoMinimoDias}
              onChange={(e) => setFormData((p) => ({ ...p, plazoMinimoDias: e.target.value }))}
              suffix="días"
              required
            />
            <FormInput
              type="number"
              label="Plazo Máximo (Días)"
              name="plazoMaximoDias"
              value={formData.plazoMaximoDias}
              onChange={(e) => setFormData((p) => ({ ...p, plazoMaximoDias: e.target.value }))}
              suffix="días"
              required
            />
          </div>

          <div className="p-3 rounded-lg bg-surface-container-low border border-surface-container-high">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                name="activo"
                checked={formData.activo}
                onChange={(e) => setFormData((p) => ({ ...p, activo: e.target.checked }))}
                className="h-4 w-4 rounded accent-secondary cursor-pointer"
              />
              <span className="font-title-md text-[13px] text-primary font-bold">
                Producto Activo en el Simulador de Inversión
              </span>
            </label>
          </div>

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
              Guardar producto
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
