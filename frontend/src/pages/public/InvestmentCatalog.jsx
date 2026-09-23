import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { publicService } from '../../services/api';
import Button from '../../components/Button';
import { LoadingState } from '../../components/Spinner';
import { ErrorState } from '../../components/EmptyState';

export default function InvestmentCatalog() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProducts = () => {
    setLoading(true);
    setError(null);
    publicService
      .getInvestmentProducts()
      .then((res) => {
        if (res.success && res.data?.products) {
          setProducts(res.data.products);
        }
      })
      .catch((err) => {
        setError(err.message || 'Error al conectar con el servidor.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const formatUSD = (val) =>
    new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  if (loading) {
    return <LoadingState message="Cargando productos de inversión..." />;
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
            Inversiones y Depósitos a Plazo
          </h1>
          <p className="text-[15px] text-on-surface-variant mt-1.5 max-w-xl">
            Haz crecer tu capital en dólares con instrumentos de renta fija regulados. Consulta los rendimientos según el plazo de colocación.
          </p>
          <span className="inline-block text-[12px] text-gray-500 mt-2">
            Tasas pasivas de referencia BCE • Cobertura del fondo COSEDE hasta $32.000 USD
          </span>
        </div>

        <Link to="/inversiones/simulador" className="flex-shrink-0">
          <Button variant="outline" size="md" iconName="trending_up">
            Ir al simulador de inversión
          </Button>
        </Link>
      </div>

      {/* Grid de Productos de Inversión */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => {
          const highestRate =
            product.rates && product.rates.length > 0
              ? Math.max(...product.rates.map((r) => Number(r.tasa)))
              : 8.65;

          return (
            <div
              key={product.id}
              className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] hover:border-gray-200 hover:shadow-md transition-all p-6 flex flex-col justify-between"
            >
              <div className="space-y-5">
                {/* Nivel 1: Título y Categoría con Icono */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-[18px] font-bold text-primary leading-snug">
                      {product.nombre}
                    </h2>
                    <p className="text-[13px] text-on-surface-variant mt-0.5">
                      Renta fija en dólares • Depósito a plazo (DPF)
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-secondary flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-[22px]">savings</span>
                  </div>
                </div>

                {/* Nivel 1 bis: Tasa Anual con caja de contraste */}
                <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-100/80">
                  <div className="flex items-baseline justify-between">
                    <div className="text-[32px] font-bold text-secondary tracking-tight font-numeric-data">
                      Hasta {highestRate.toFixed(2)}%
                    </div>
                    <span className="material-symbols-outlined text-secondary text-[20px]">
                      trending_up
                    </span>
                  </div>
                  <div className="text-[13px] text-on-surface-variant font-medium">
                    Rendimiento anual estimado
                  </div>
                </div>

                {/* Nivel 2: Parámetros */}
                <div className="pt-1 space-y-2 text-[14px]">
                  <div className="flex justify-between items-center">
                    <span className="text-on-surface-variant flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-secondary">payments</span>
                      Monto mínimo:
                    </span>
                    <span className="font-semibold text-primary font-numeric-data">
                      {formatUSD(product.montoMinimo || 500)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-on-surface-variant flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-secondary">calendar_month</span>
                      Plazos:
                    </span>
                    <span className="font-semibold text-primary font-numeric-data">
                      Desde 30 hasta 720+ días
                    </span>
                  </div>
                </div>

                {/* Nivel 3: Garantía y Beneficios */}
                <div className="text-[12px] text-gray-500 pt-2 border-t border-gray-100 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-emerald-600">verified_user</span>
                  <span>Protegido por COSEDE • Exento de retención SRI (≥ 180 días)</span>
                </div>
              </div>

              {/* Acción Principal */}
              <div className="pt-6 mt-4 border-t border-gray-100">
                <Link to={`/inversiones/simulador?productId=${product.id}`}>
                  <Button variant="fintech" className="w-full" iconName="trending_up">
                    Simular inversión
                  </Button>
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
