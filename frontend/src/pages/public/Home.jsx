import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../../components/Button';

export default function Home() {
  const navigate = useNavigate();

  // Quick Calculator Widget State
  const [quickAmount, setQuickAmount] = useState(5000);
  const [quickTerm, setQuickTerm] = useState(24);

  // Quick estimation for French system preview (using 15.80% ref rate)
  const annualRate = 0.158;
  const monthlyRate = Math.pow(1 + annualRate, 30 / 360) - 1;
  const quickQuota =
    (quickAmount * (monthlyRate * Math.pow(1 + monthlyRate, quickTerm))) /
    (Math.pow(1 + monthlyRate, quickTerm) - 1);
  const quickTotal = quickQuota * quickTerm;
  const quickInterest = quickTotal - quickAmount;

  const formatUSD = (val) =>
    new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="flex flex-col w-full space-y-16 pb-16">
      {/* HERO SECTION */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-8 pt-8 md:pt-12 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Hero Columna Izquierda */}
          <div className="lg:col-span-7 space-y-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-secondary text-[12px] font-semibold border border-blue-100">
              Tasas referenciales reguladas por el BCE • Actualizado 2026
            </span>

            <h1 className="text-[36px] sm:text-[48px] lg:text-[54px] font-bold text-primary tracking-tight leading-[1.1]">
              Simula tus opciones de <br />
              <span className="text-secondary">crédito e inversión</span>
            </h1>

            <p className="text-[16px] sm:text-[17px] text-on-surface-variant max-w-xl leading-relaxed">
              Consulta cuotas mensuales, intereses y condiciones antes de tomar una decisión. Calcula tablas de amortización bajo los sistemas francés y alemán sin cobros ocultos.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link to="/creditos/simulador">
                <Button variant="fintech" size="lg">
                  Simular un crédito →
                </Button>
              </Link>
              <Link to="/creditos">
                <Button variant="outline" size="lg">
                  Ver catálogo de créditos
                </Button>
              </Link>
            </div>

            {/* Marcadores de referencia */}
            <div className="grid grid-cols-3 gap-6 pt-6 border-t border-gray-100 max-w-lg">
              <div>
                <div className="text-[20px] font-bold text-primary font-numeric-data">16.77%</div>
                <div className="text-[13px] text-gray-500">Techo legal consumo</div>
              </div>
              <div>
                <div className="text-[20px] font-bold text-secondary font-numeric-data">Hasta 8.65%</div>
                <div className="text-[13px] text-gray-500">Rendimiento en DPF</div>
              </div>
              <div>
                <div className="text-[20px] font-bold text-primary font-numeric-data">Base 360</div>
                <div className="text-[13px] text-gray-500">Cálculo comercial Ecuador</div>
              </div>
            </div>
          </div>

          {/* Hero Columna Derecha: Calculadora Rápida */}
          <div className="lg:col-span-5 w-full">
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-100 shadow-[0_4px_12px_0_rgba(0,0,0,0.04)] space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div>
                  <h2 className="text-[17px] font-bold text-primary">Cálculo rápido</h2>
                  <p className="text-[13px] text-gray-500">Estimación preliminar cuota fija</p>
                </div>
                <span className="text-[12px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-secondary border border-blue-100">
                  USD
                </span>
              </div>

              {/* Slider de Monto */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[14px]">
                  <span className="font-medium text-primary">Monto a financiar:</span>
                  <span className="font-bold text-secondary font-numeric-data text-[16px]">
                    {formatUSD(quickAmount)}
                  </span>
                </div>
                <input
                  type="range"
                  min="500"
                  max="30000"
                  step="500"
                  value={quickAmount}
                  onChange={(e) => setQuickAmount(Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-secondary"
                />
                <div className="flex justify-between text-[12px] text-gray-400 font-numeric-data">
                  <span>$500</span>
                  <span>$15,000</span>
                  <span>$30,000</span>
                </div>
              </div>

              {/* Slider de Plazo */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[14px]">
                  <span className="font-medium text-primary">Plazo de pago:</span>
                  <span className="font-bold text-secondary font-numeric-data text-[16px]">
                    {quickTerm} meses
                  </span>
                </div>
                <input
                  type="range"
                  min="6"
                  max="60"
                  step="6"
                  value={quickTerm}
                  onChange={(e) => setQuickTerm(Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-secondary"
                />
                <div className="flex justify-between text-[12px] text-gray-400 font-numeric-data">
                  <span>6 meses</span>
                  <span>36 meses</span>
                  <span>60 meses</span>
                </div>
              </div>

              {/* Resultado Rápido */}
              <div className="p-4 rounded-xl bg-gray-50/70 border border-gray-100 space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-[13px] text-gray-600">Cuota mensual estimada:</span>
                  <div className="text-[28px] font-bold text-primary font-numeric-hero">
                    {formatUSD(quickQuota)}
                    <span className="text-[13px] font-normal text-gray-500">/mes</span>
                  </div>
                </div>
                <div className="flex justify-between text-[12px] text-gray-500 pt-2 border-t border-gray-200/60">
                  <span>Tasa estimada: 15.80% anual</span>
                  <span>Intereses: {formatUSD(quickInterest)}</span>
                </div>
              </div>

              <Button
                type="button"
                variant="fintech"
                onClick={() =>
                  navigate(`/creditos/simulador?monto=${quickAmount}&plazo=${quickTerm}`)
                }
                className="w-full"
              >
                Ver tabla completa y comparar →
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* SECCIÓN 3 TARJETAS PRINCIPALES */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-8 w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Créditos */}
          <div className="bg-white p-7 rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] hover:border-gray-200 hover:shadow-sm transition-all flex flex-col justify-between space-y-5">
            <div>
              <h3 className="text-[19px] font-bold text-primary">Créditos</h3>
              <p className="text-[14px] text-on-surface-variant mt-2 leading-relaxed">
                Revisa los productos crediticios autorizados para consumo, vivienda y vehículos con las tasas vigentes del sistema financiero nacional.
              </p>
            </div>
            <Link
              to="/creditos"
              className="text-[14px] font-semibold text-secondary hover:underline inline-flex items-center gap-1"
            >
              Explorar créditos →
            </Link>
          </div>

          {/* Amortización */}
          <div className="bg-white p-7 rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] hover:border-gray-200 hover:shadow-sm transition-all flex flex-col justify-between space-y-5">
            <div>
              <h3 className="text-[19px] font-bold text-primary">Simulador de amortización</h3>
              <p className="text-[14px] text-on-surface-variant mt-2 leading-relaxed">
                Calcula la cuota exacta mes a mes, compara el sistema francés con el alemán y descarga tu tabla en formato PDF oficial.
              </p>
            </div>
            <Link
              to="/creditos/simulador"
              className="text-[14px] font-semibold text-secondary hover:underline inline-flex items-center gap-1"
            >
              Simular financiamiento →
            </Link>
          </div>

          {/* Inversiones */}
          <div className="bg-white p-7 rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] hover:border-gray-200 hover:shadow-sm transition-all flex flex-col justify-between space-y-5">
            <div>
              <h3 className="text-[19px] font-bold text-primary">Inversiones a plazo (DPF)</h3>
              <p className="text-[14px] text-on-surface-variant mt-2 leading-relaxed">
                Proyecta el rendimiento de tus ahorros en depósitos a plazo fijo y revisa los beneficios fiscales y cobertura del seguro COSEDE.
              </p>
            </div>
            <Link
              to="/inversiones"
              className="text-[14px] font-semibold text-secondary hover:underline inline-flex items-center gap-1"
            >
              Ver inversiones →
            </Link>
          </div>
        </div>
      </section>

      {/* SECCIÓN: CÓMO FUNCIONA (PASOS) */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-8 w-full">
        <div className="bg-white rounded-2xl p-8 sm:p-10 border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] space-y-8">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h2 className="text-[26px] sm:text-[30px] font-bold text-primary">
              ¿Cómo funciona?
            </h2>
            <p className="text-[15px] text-gray-500">
              Un flujo simple y transparente en cuatro pasos para planificar tu financiamiento.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <div className="w-9 h-9 rounded-full bg-blue-50 text-secondary font-bold text-[15px] flex items-center justify-center">
                1
              </div>
              <h4 className="text-[16px] font-bold text-primary">Elige el tipo de crédito</h4>
              <p className="text-[13px] text-gray-500 leading-relaxed">
                Selecciona la modalidad adecuada (consumo, vehicular, productivo o educativo).
              </p>
            </div>

            <div className="space-y-2">
              <div className="w-9 h-9 rounded-full bg-blue-50 text-secondary font-bold text-[15px] flex items-center justify-center">
                2
              </div>
              <h4 className="text-[16px] font-bold text-primary">Ingresa monto y plazo</h4>
              <p className="text-[13px] text-gray-500 leading-relaxed">
                Ajusta el capital en dólares que requieres y los meses para pagarlo.
              </p>
            </div>

            <div className="space-y-2">
              <div className="w-9 h-9 rounded-full bg-blue-50 text-secondary font-bold text-[15px] flex items-center justify-center">
                3
              </div>
              <h4 className="text-[16px] font-bold text-primary">Compara sistemas</h4>
              <p className="text-[13px] text-gray-500 leading-relaxed">
                Evalúa entre cuotas fijas (francés) o cuotas decrecientes (alemán).
              </p>
            </div>

            <div className="space-y-2">
              <div className="w-9 h-9 rounded-full bg-blue-50 text-secondary font-bold text-[15px] flex items-center justify-center">
                4
              </div>
              <h4 className="text-[16px] font-bold text-primary">Obtén tu tabla o solicita</h4>
              <p className="text-[13px] text-gray-500 leading-relaxed">
                Revisa el desglose cuota a cuota, descarga el PDF o inicia tu solicitud.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
