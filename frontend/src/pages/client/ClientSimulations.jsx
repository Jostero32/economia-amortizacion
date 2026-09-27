import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { clientService, publicService } from '../../services/api';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Table from '../../components/Table';
import Alert from '../../components/Alert';
import EmptyState from '../../components/EmptyState';
import { LoadingState } from '../../components/Spinner';
import { formatMoney, formatDateTime } from '../../utils/format';

function PdfButton({ onDownload }) {
  const [downloading, setDownloading] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleClick = async () => {
    setDownloading(true);
    setFailed(false);
    try {
      await onDownload();
    } catch {
      setFailed(true);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Button
      variant={failed ? 'destructive' : 'ghost'}
      size="sm"
      iconName="download"
      onClick={handleClick}
      loading={downloading}
      loadingText="PDF..."
      title={failed ? 'No se pudo descargar; intenta nuevamente' : 'Descargar PDF'}
    >
      PDF
    </Button>
  );
}

export default function ClientSimulations() {
  const [creditSimulations, setCreditSimulations] = useState([]);
  const [investmentSimulations, setInvestmentSimulations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    clientService
      .getMySimulations()
      .then((res) => {
        setCreditSimulations(res.data?.simulations || []);
        setInvestmentSimulations(res.data?.investmentSimulations || []);
      })
      .catch((err) => setError(err.message || 'No se pudo cargar tu historial de simulaciones.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <LoadingState message="Cargando tus simulaciones..." />;
  }

  return (
    <div className="space-y-space-md max-w-[1440px] mx-auto">
      <div className="bg-surface-container-lowest p-space-lg rounded-xl border border-surface-container-high shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
        <div>
          <h1 className="font-headline-lg text-[24px] sm:text-[28px] text-primary font-bold">Mis simulaciones</h1>
          <p className="text-[13px] text-on-surface-variant mt-0.5">
            Las simulaciones que haces con tu sesión iniciada quedan guardadas aquí. Descarga su PDF con la tabla completa.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/creditos/simulador"><Button variant="outline" iconName="calculate">Simular crédito</Button></Link>
          <Link to="/inversiones/simulador"><Button variant="fintech" iconName="trending_up">Simular inversión</Button></Link>
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <Card title={`Créditos (${creditSimulations.length})`} iconName="credit_card">
        {creditSimulations.length === 0 ? (
          <EmptyState
            iconName="calculate"
            title="Aún no tienes simulaciones de crédito"
            description="Simula un crédito para ver tu cuota y la tabla de amortización."
          />
        ) : (
          <Table
            headers={[
              'Fecha',
              'Producto',
              { label: 'Monto', align: 'text-right' },
              'Plazo',
              'Tipo de cuota',
              { label: 'Primera cuota', align: 'text-right' },
              { label: 'Acciones', align: 'text-right' },
            ]}
          >
            {creditSimulations.map((sim) => (
              <tr key={sim.id} className="hover:bg-surface-container-low/40 transition-colors">
                <td className="py-3 px-4 text-[12px] text-on-surface-variant">{formatDateTime(sim.createdAt)}</td>
                <td className="py-3 px-4 font-medium text-primary">{sim.creditType?.nombre || 'Crédito'}</td>
                <td className="py-3 px-4 text-right font-numeric-data font-bold text-primary">{formatMoney(sim.monto)}</td>
                <td className="py-3 px-4 text-on-surface-variant">{sim.plazoMeses} meses</td>
                <td className="py-3 px-4 text-[13px]">{sim.sistemaAmortizacion === 'ALEMAN' ? 'Decreciente' : 'Fija'}</td>
                <td className="py-3 px-4 text-right font-numeric-data">{formatMoney(sim.cuotaInicial)}</td>
                <td className="py-3 px-4 text-right whitespace-nowrap">
                  <Link to={`/creditos/simulador/${sim.id}`}>
                    <Button variant="outline" size="sm" iconName="visibility">Ver</Button>
                  </Link>{' '}
                  <PdfButton onDownload={() => publicService.downloadCreditSimulationPdf(sim.id)} />
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title={`Inversiones (${investmentSimulations.length})`} iconName="savings">
        {investmentSimulations.length === 0 ? (
          <EmptyState
            iconName="savings"
            title="Aún no tienes simulaciones de inversión"
            description="Simula un depósito a plazo fijo para ver cuánto recibirás."
          />
        ) : (
          <Table
            headers={[
              'Fecha',
              'Producto',
              { label: 'Capital', align: 'text-right' },
              'Plazo',
              { label: 'Recibirás', align: 'text-right' },
              { label: 'Acciones', align: 'text-right' },
            ]}
          >
            {investmentSimulations.map((sim) => (
              <tr key={sim.id} className="hover:bg-surface-container-low/40 transition-colors">
                <td className="py-3 px-4 text-[12px] text-on-surface-variant">{formatDateTime(sim.createdAt)}</td>
                <td className="py-3 px-4 font-medium text-primary">{sim.product?.nombre || 'Depósito a plazo fijo'}</td>
                <td className="py-3 px-4 text-right font-numeric-data font-bold text-primary">{formatMoney(sim.monto)}</td>
                <td className="py-3 px-4 text-on-surface-variant">{sim.plazoDias} días</td>
                <td className="py-3 px-4 text-right font-numeric-data">{formatMoney(sim.valorFinal)}</td>
                <td className="py-3 px-4 text-right whitespace-nowrap">
                  <Link to={`/inversiones/simulador/${sim.id}`}>
                    <Button variant="outline" size="sm" iconName="visibility">Ver</Button>
                  </Link>{' '}
                  <PdfButton onDownload={() => publicService.downloadInvestmentSimulationPdf(sim.id)} />
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
