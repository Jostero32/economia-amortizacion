import React, { useEffect, useState } from 'react';
import { adminService } from '../../services/api';
import Button from '../../components/Button';
import FormInput from '../../components/FormInput';
import Modal from '../../components/Modal';
import Badge from '../../components/Badge';
import Alert from '../../components/Alert';
import { LoadingState } from '../../components/Spinner';
import { formatMoneyWhole, formatPercent, formatDate } from '../../utils/format';

const EMPTY_PRODUCT = {
  nombre: '',
  descripcion: '',
  montoMinimo: '500',
  montoMaximo: '100000',
  plazoMinimoDias: '30',
  plazoMaximoDias: '1080',
  tasa: '',
  pagoIntereses: 'AL_VENCIMIENTO',
};

const PAYMENT_LABELS = {
  AL_VENCIMIENTO: 'Intereses al vencimiento',
  MENSUAL: 'Intereses cada mes',
};

function RateRow({ product, rate, onChanged, onError }) {
  const [editing, setEditing] = useState(false);
  const [tasa, setTasa] = useState(String(Number(rate.tasa)));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await adminService.updateInvestmentRate(product.id, rate.id, { tasa: Number(tasa) });
      setEditing(false);
      onChanged();
    } catch (err) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await adminService.deleteInvestmentRate(product.id, rate.id);
      onChanged();
    } catch (err) {
      onError(err.message);
    }
  };

  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="py-2 px-3">{rate.plazoMinDias} a {rate.plazoMaxDias} días</td>
      <td className="py-2 px-3 text-right font-numeric-data">
        {editing ? (
          <input
            value={tasa}
            onChange={(e) => setTasa(e.target.value.replace(',', '.'))}
            inputMode="decimal"
            className="w-20 h-8 px-2 rounded border border-gray-300 text-right"
            aria-label="Nueva tasa"
          />
        ) : (
          formatPercent(rate.tasa)
        )}
      </td>
      <td className="py-2 px-3 text-gray-500">{formatDate(rate.fechaVigencia)}</td>
      <td className="py-2 px-3 text-right whitespace-nowrap">
        {editing ? (
          <>
            <Button size="sm" variant="fintech" onClick={save} loading={saving} loadingText="...">Guardar</Button>{' '}
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="ghost" iconName="edit" onClick={() => setEditing(true)}>Cambiar tasa</Button>
            <Button size="sm" variant="ghost" iconName="block" onClick={remove}>Quitar</Button>
          </>
        )}
      </td>
    </tr>
  );
}

function ProductCard({ product, onEdit, onToggle, onChanged }) {
  const [newRate, setNewRate] = useState({ plazoMinDias: '', plazoMaxDias: '', tasa: '' });
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  const activeRates = (product.rates || []).filter((rate) => rate.activo);
  const history = (product.rates || []).filter((rate) => !rate.activo);

  const addRate = async (event) => {
    event.preventDefault();
    setAdding(true);
    setError(null);
    try {
      await adminService.createInvestmentRate(product.id, {
        plazoMinDias: Number(newRate.plazoMinDias),
        plazoMaxDias: Number(newRate.plazoMaxDias),
        tasa: Number(newRate.tasa),
      });
      setNewRate({ plazoMinDias: '', plazoMaxDias: '', tasa: '' });
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className={`bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] p-6 space-y-4 ${product.activo ? '' : 'opacity-70'}`}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[17px] font-bold text-primary">{product.nombre}</h2>
            <Badge variant={product.activo ? 'seps' : 'default'} size="sm">{product.activo ? 'Activo' : 'Inactivo'}</Badge>
            <Badge variant="bce" size="sm">{PAYMENT_LABELS[product.pagoIntereses] || PAYMENT_LABELS.AL_VENCIMIENTO}</Badge>
          </div>
          {product.descripcion && <p className="text-[13px] text-gray-500 mt-1 max-w-2xl">{product.descripcion}</p>}
          <p className="text-[13px] text-gray-600 mt-1">
            {formatMoneyWhole(product.montoMinimo)} a {formatMoneyWhole(product.montoMaximo)} · {product.plazoMinimoDias} a {product.plazoMaximoDias} días · tasa base {formatPercent(product.tasa)}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button size="sm" variant="outline" iconName="edit" onClick={() => onEdit(product)}>Editar</Button>
          <Button size="sm" variant="ghost" iconName={product.activo ? 'block' : 'check_circle'} onClick={() => onToggle(product)}>
            {product.activo ? 'Desactivar' : 'Activar'}
          </Button>
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <div>
        <h3 className="text-[14px] font-semibold text-primary mb-2">Tasas según el plazo</h3>
        <div className="overflow-x-auto rounded-lg border border-gray-100">
          <table className="w-full text-[13px]">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="py-2 px-3 text-left font-medium">Tramo</th>
                <th className="py-2 px-3 text-right font-medium">Tasa nominal anual</th>
                <th className="py-2 px-3 text-left font-medium">Vigente desde</th>
                <th className="py-2 px-3" />
              </tr>
            </thead>
            <tbody>
              {activeRates.length === 0 && (
                <tr><td colSpan={4} className="py-3 px-3 text-gray-500">Sin tramos: se usa la tasa base en todos los plazos.</td></tr>
              )}
              {activeRates.map((rate) => (
                <RateRow key={rate.id} product={product} rate={rate} onChanged={onChanged} onError={setError} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <form onSubmit={addRate} className="flex flex-wrap items-end gap-2">
        <FormInput label="Desde (días)" name={`min-${product.id}`} inputMode="numeric" value={newRate.plazoMinDias} onChange={(e) => setNewRate((r) => ({ ...r, plazoMinDias: e.target.value }))} className="w-28" />
        <FormInput label="Hasta (días)" name={`max-${product.id}`} inputMode="numeric" value={newRate.plazoMaxDias} onChange={(e) => setNewRate((r) => ({ ...r, plazoMaxDias: e.target.value }))} className="w-28" />
        <FormInput label="Tasa" name={`tasa-${product.id}`} inputMode="decimal" suffix="%" value={newRate.tasa} onChange={(e) => setNewRate((r) => ({ ...r, tasa: e.target.value.replace(',', '.') }))} className="w-28" />
        <Button type="submit" variant="outline" iconName="add" loading={adding} loadingText="Agregando...">Agregar tramo</Button>
      </form>

      {history.length > 0 && (
        <div>
          <button type="button" className="text-[12px] text-secondary hover:underline" onClick={() => setShowHistory((v) => !v)}>
            {showHistory ? 'Ocultar histórico' : `Ver histórico de tasas (${history.length})`}
          </button>
          {showHistory && (
            <ul className="mt-2 text-[12px] text-gray-500 space-y-1">
              {history.map((rate) => (
                <li key={rate.id}>
                  {rate.plazoMinDias} a {rate.plazoMaxDias} días · {formatPercent(rate.tasa)} · desde {formatDate(rate.fechaVigencia)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function InvestmentProductsList() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState(EMPTY_PRODUCT);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const loadProducts = () => {
    adminService
      .getInvestmentProducts()
      .then((res) => setProducts(res.data?.products || []))
      .catch((err) => setPageError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const openModal = (product = null) => {
    setEditingProduct(product);
    setFormData(product ? {
      nombre: product.nombre,
      descripcion: product.descripcion || '',
      montoMinimo: String(Number(product.montoMinimo)),
      montoMaximo: String(Number(product.montoMaximo)),
      plazoMinimoDias: String(product.plazoMinimoDias),
      plazoMaximoDias: String(product.plazoMaximoDias),
      tasa: String(Number(product.tasa)),
      pagoIntereses: product.pagoIntereses || 'AL_VENCIMIENTO',
    } : EMPTY_PRODUCT);
    setFieldErrors({});
    setError(null);
    setModalOpen(true);
  };

  const updateField = (name, value) => {
    setFormData((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      const payload = { ...formData, descripcion: formData.descripcion.trim() || null };
      if (editingProduct) {
        await adminService.updateInvestmentProduct(editingProduct.id, payload);
      } else {
        await adminService.createInvestmentProduct(payload);
      }
      setModalOpen(false);
      loadProducts();
    } catch (err) {
      setError(err.message);
      if (err.errors && !Array.isArray(err.errors)) setFieldErrors(err.errors);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleProduct = async (product) => {
    setPageError(null);
    try {
      if (product.activo) {
        await adminService.deleteInvestmentProduct(product.id);
      } else {
        await adminService.updateInvestmentProduct(product.id, { activo: true });
      }
      loadProducts();
    } catch (err) {
      setPageError(err.message);
    }
  };

  if (loading) {
    return <LoadingState message="Cargando productos de inversión..." />;
  }

  const numberField = (name, label, props = {}) => (
    <FormInput
      label={label}
      name={name}
      value={formData[name]}
      onChange={(e) => updateField(name, e.target.value.replace(',', '.'))}
      error={fieldErrors[name]}
      required
      {...props}
    />
  );

  return (
    <div className="space-y-space-md max-w-[1440px] mx-auto">
      <div className="bg-surface-container-lowest p-space-lg rounded-xl border border-surface-container-high shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-headline-lg text-[24px] sm:text-[28px] text-primary font-bold">Productos de inversión</h1>
          <p className="text-[13px] text-on-surface-variant mt-0.5">
            Depósitos a plazo fijo, forma de pago de intereses y tasas por tramo de días. Los cambios de tasa conservan el histórico.
          </p>
        </div>
        <Button variant="fintech" iconName="add" onClick={() => openModal()}>Nuevo producto</Button>
      </div>

      {pageError && <Alert type="error">{pageError}</Alert>}

      {products.map((product) => (
        <ProductCard key={product.id} product={product} onEdit={openModal} onToggle={toggleProduct} onChanged={loadProducts} />
      ))}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingProduct ? 'Editar producto' : 'Nuevo producto de inversión'} maxWidth="max-w-lg">
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {error && <Alert type="error">{error}</Alert>}
          <FormInput label="Nombre" name="nombre" value={formData.nombre} onChange={(e) => updateField('nombre', e.target.value)} error={fieldErrors.nombre} required />
          <FormInput type="textarea" label="Descripción" name="descripcion" rows={2} value={formData.descripcion} onChange={(e) => updateField('descripcion', e.target.value)} error={fieldErrors.descripcion} />
          <div className="grid grid-cols-2 gap-3">
            {numberField('montoMinimo', 'Monto mínimo', { prefix: '$', inputMode: 'decimal' })}
            {numberField('montoMaximo', 'Monto máximo', { prefix: '$', inputMode: 'decimal' })}
            {numberField('plazoMinimoDias', 'Plazo mínimo', { suffix: 'días', inputMode: 'numeric' })}
            {numberField('plazoMaximoDias', 'Plazo máximo', { suffix: 'días', inputMode: 'numeric' })}
            {numberField('tasa', 'Tasa base', { suffix: '%', inputMode: 'decimal', hint: 'Se usa si ningún tramo cubre el plazo.' })}
            <FormInput
              type="select"
              label="Pago de intereses"
              name="pagoIntereses"
              value={formData.pagoIntereses}
              onChange={(e) => updateField('pagoIntereses', e.target.value)}
              options={[
                { value: 'AL_VENCIMIENTO', label: 'Al vencimiento' },
                { value: 'MENSUAL', label: 'Cada mes' },
              ]}
            />
          </div>
          <div className="pt-3 border-t border-surface-container-high flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="fintech" loading={submitting} loadingText="Guardando..." iconName="save">Guardar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
