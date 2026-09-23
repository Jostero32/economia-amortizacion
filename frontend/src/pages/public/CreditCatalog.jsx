import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { publicService } from '../../services/api';
import Button from '../../components/Button';
import { LoadingState } from '../../components/Spinner';
import { ErrorState } from '../../components/EmptyState';

export default function CreditCatalog() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProducts = () => {
    setLoading(true);
    setError(null);
    publicService
      .getCreditProducts()
      .then((res) => {
        if (res.success) {
          setProducts(res.data.products || []);
        }
      })
      .catch((err) => {
        setError(err.message || 'Error al conectar con el servidor para consultar productos.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const formatUSD = (val) =>
    new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  const getProductIcon = (name = '') => {
    const lower = name.toLowerCase();
    if (lower.includes('vehic') || lower.includes('auto')) return 'directions_car';
    if (lower.includes('vivienda') || lower.includes('hipotec')) return 'home';
    if (lower.includes('educat')) return 'school';
    if (lower.includes('micro') || lower.includes('productiv')) return 'storefront';
    return 'payments';
  };

  if (loading) {
    return <LoadingState message="Cargando opciones de financiamiento..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchProducts} />;
  }

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-8 md:py-10 space-y-8">
      {/* Cabecera Limpia */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-gray-100">
        <div>
          <h1 className="text-[28px] sm:text-[34px] font-bold text-primary tracking-tight">
            Créditos
          </h1>
          <p className="text-[15px] text-on-surface-variant mt-1.5 max-w-xl">
            Encuentra un producto crediticio y simula tu tabla de amortización con cuotas mensuales e intereses en dólares.
          </p>
          <span className="inline-block text-[12px] text-gray-500 mt-2">
            Tasas de referencia y techos legales regulados por el BCE • Actualizado 2026
          </span>
        </div>

        <Link to="/creditos/simulador" className="flex-shrink-0">
          <Button variant="outline" size="md" iconName="calculate">
            Ir al simulador general
          </Button>
        </Link>
      </div>

      {/* Grid de Tarjetas de Crédito */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => (
          <div
            key={product.id}
            className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] hover:border-gray-200 hover:shadow-md transition-all p-6 flex flex-col justify-between"
          >
            <div className="space-y-5">
              {/* Nivel 1: Nombre, Icono y Segmento */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[18px] font-bold text-primary leading-snug">
                    {product.nombre}
                  </h2>
                  <p className="text-[13px] text-on-surface-variant mt-0.5">
                    Segmento: {product.segment?.nombre || 'General'}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-secondary flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-[22px]">
                    {getProductIcon(product.nombre)}
                  </span>
                </div>
              </div>

              {/* Nivel 1 bis: Tasa Anual Hero con fondo suave de contraste */}
              <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-100/80">
                <div className="flex items-baseline justify-between">
                  <div className="text-[32px] font-bold text-secondary tracking-tight font-numeric-data">
                    {Number(product.tasaInstitucion).toFixed(2)}%
                  </div>
                  <span className="material-symbols-outlined text-secondary text-[20px]">
                    trending_up
                  </span>
                </div>
                <div className="text-[13px] text-on-surface-variant font-medium">
                  Tasa anual
                </div>
              </div>

              {/* Nivel 2: Monto y Plazo */}
              <div className="pt-1 space-y-2 text-[14px]">
                <div className="flex justify-between items-center">
                  <span className="text-on-surface-variant flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-secondary">payments</span>
                    Monto:
                  </span>
                  <span className="font-semibold text-primary font-numeric-data">
                    {formatUSD(product.montoMinimo)} – {formatUSD(product.montoMaximo)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-on-surface-variant flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-secondary">calendar_month</span>
                    Plazo:
                  </span>
                  <span className="font-semibold text-primary font-numeric-data">
                    {product.plazoMinimo} – {product.plazoMaximo} meses
                  </span>
                </div>
              </div>

              {/* Nivel 3: Información regulatoria secundaria discreta */}
              {product.segment?.tasaMaxima && (
                <div className="text-[12px] text-gray-500 flex items-center justify-between pt-2 border-t border-gray-100">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px] text-gray-400">balance</span>
                    Máxima legal BCE:
                  </span>
                  <span className="font-medium font-numeric-data text-gray-700">
                    {Number(product.segment.tasaMaxima).toFixed(2)}%
                  </span>
                </div>
              )}
            </div>

            {/* Acción Principal */}
            <div className="pt-6 mt-4 border-t border-gray-100">
              <Link to={`/creditos/simulador?creditTypeId=${product.id}`}>
                <Button variant="fintech" className="w-full" iconName="calculate">
                  Simular crédito
                </Button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
