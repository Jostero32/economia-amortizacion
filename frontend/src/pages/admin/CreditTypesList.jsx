import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { publicService, adminService } from '../../services/api';
import Card from '../../components/Card';
import Table from '../../components/Table';
import Button from '../../components/Button';
import Badge from '../../components/Badge';
import { LoadingState } from '../../components/Spinner';

export default function CreditTypesList() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadProducts = () => {
    publicService
      .getCreditProducts()
      .then((res) => {
        if (res.success) setProducts(res.data.products || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm('¿Confirma desactivar este producto de crédito?')) {
      try {
        await adminService.deleteCreditProduct(id);
        loadProducts();
      } catch (err) {
        alert(err.message || 'Error al desactivar el producto.');
      }
    }
  };

  const formatUSD = (val) =>
    new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(val || 0);

  if (loading) {
    return <LoadingState message="Cargando catálogo de productos de crédito..." />;
  }

  return (
    <div className="space-y-space-md max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="bg-surface-container-lowest p-space-lg rounded-xl border border-surface-container-high shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="bce" iconName="credit_card">
              Portafolio Institucional
            </Badge>
          </div>
          <h1 className="font-headline-lg text-[24px] sm:text-[28px] text-primary font-bold">
            Administración de Productos de Crédito
          </h1>
          <p className="font-body-sm text-[13px] text-on-surface-variant mt-0.5">
            Configuración de productos, límites financieros y tasas institucionales controladas por techos BCE.
          </p>
        </div>

        <Link to="/admin/creditos/nuevo">
          <Button variant="fintech" iconName="add">
            Nuevo Producto
          </Button>
        </Link>
      </div>

      <Card title={`Productos Registrados (${products.length})`}>
        <Table
          headers={[
            'Producto',
            'Segmento BCE',
            { label: 'Tasa Institución', align: 'text-right' },
            { label: 'Techo BCE', align: 'text-right' },
            { label: 'Montos Permitidos', align: 'text-right' },
            'Plazo',
            'Estado',
            { label: 'Acciones', align: 'text-right' },
          ]}
        >
          {products.map((p) => (
            <tr key={p.id} className="hover:bg-surface-container-low/40 transition-colors">
              <td className="py-3 px-4 font-bold text-primary font-body-sm">
                {p.nombre}
              </td>
              <td className="py-3 px-4 text-on-surface-variant font-body-sm text-[13px]">
                {p.segment?.nombre || 'Segmento BCE'}
              </td>
              <td className="py-3 px-4 text-right font-numeric-data font-bold text-secondary text-[14px]">
                {Number(p.tasaInstitucion).toFixed(2)}%
              </td>
              <td className="py-3 px-4 text-right font-numeric-data font-medium text-on-surface text-[13px]">
                {Number(p.segment?.tasaMaxima || 0).toFixed(2)}%
              </td>
              <td className="py-3 px-4 text-right font-numeric-data text-[12px] text-primary font-semibold">
                {formatUSD(p.montoMinimo)} - {formatUSD(p.montoMaximo)}
              </td>
              <td className="py-3 px-4 font-numeric-data text-[12px] text-on-surface-variant">
                {p.plazoMinimo} a {p.plazoMaximo} m
              </td>
              <td className="py-3 px-4">
                <Badge variant={p.activo ? 'seps' : 'alert'} size="sm">
                  {p.activo ? 'Activo' : 'Inactivo'}
                </Badge>
              </td>
              <td className="py-3 px-4 text-right">
                <div className="flex items-center justify-end gap-1">
                  <Link to={`/admin/creditos/${p.id}`}>
                    <button
                      className="p-1.5 text-on-surface-variant hover:text-secondary rounded-lg hover:bg-surface-container transition-colors"
                      title="Editar"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                  </Link>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="p-1.5 text-on-surface-variant hover:text-error rounded-lg hover:bg-error-container/30 transition-colors"
                    title="Desactivar"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
