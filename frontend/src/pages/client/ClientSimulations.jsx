import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { clientService, publicService } from '../../services/api';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Badge from '../../components/Badge';
import Table from '../../components/Table';
import EmptyState from '../../components/EmptyState';
import { LoadingState } from '../../components/Spinner';

export default function ClientSimulations() {
  const [simulations, setSimulations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    clientService
      .getMyCreditSimulations()
      .then((res) => {
        if (res.success && res.data?.simulations) {
          setSimulations(res.data.simulations);
        }
      })
      .catch((err) => {
        setError(err.message || 'Error al consultar historial de simulaciones.');
      })
      .finally(() => setLoading(false));
  }, []);

  const formatUSD = (val) =>
    new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(val || 0);
  const handleDownloadPdf = (simulationId) => {
    const pdfUrl = publicService.getCreditSimulationPdfUrl(simulationId);
    window.open(pdfUrl, '_blank');
  };

  if (loading) {
    return <LoadingState message="Cargando historial de simulaciones..." />;
  }

  return (
    <div className="space-y-space-md max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="bg-surface-container-lowest p-space-lg rounded-xl border border-surface-container-high shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="bce" iconName="history">
              Registro Financiero
            </Badge>
          </div>
          <h1 className="font-headline-lg text-[24px] sm:text-[28px] text-primary font-bold">
            Historial de Simulaciones
          </h1>
          <p className="font-body-sm text-[13px] text-on-surface-variant mt-0.5">
            Registro de simulaciones calculadas en tu cuenta con desglose de cuotas y sistemas de amortización.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/creditos/simulador">
            <Button variant="fintech" iconName="calculate">
              Nueva Simulación
            </Button>
          </Link>
        </div>
      </div>

      <Card title="Simulaciones Realizadas">
        {simulations.length === 0 ? (
          <EmptyState
            iconName="calculate"
            title="Sin simulaciones en tu historial"
            description="Las simulaciones que generes mientras tengas la sesión iniciada quedarán registradas aquí para tu consulta o descarga de PDF."
            action={
              <Link to="/creditos/simulador">
                <Button variant="fintech" size="sm" iconName="calculate">
                  Simular crédito ahora
                </Button>
              </Link>
            }
          />
        ) : (
          <Table
            headers={[
              'Fecha',
              'Tipo',
              'Producto',
              { label: 'Monto', align: 'text-right' },
              'Plazo',
              'Sistema',
              { label: 'Total', align: 'text-right' },
              { label: 'Acción', align: 'text-right' },
            ]}
          >
            {simulations.map((sim) => (
              <tr key={sim.id} className="hover:bg-surface-container-low/40 transition-colors">
                <td className="py-3 px-4 font-numeric-data text-[12px] text-on-surface-variant">
                  {new Date(sim.createdAt).toLocaleDateString('es-EC')}
                </td>
                <td className="py-3 px-4">
                  <Badge variant="default" size="sm">
                    Crédito
                  </Badge>
                </td>
                <td className="py-3 px-4 font-medium text-primary font-body-sm">
                  {sim.creditType?.nombre || 'Crédito'}
                </td>
                <td className="py-3 px-4 text-right font-numeric-data font-bold text-primary">
                  {formatUSD(sim.monto)}
                </td>
                <td className="py-3 px-4 font-numeric-data text-on-surface-variant">
                  {sim.plazoMeses} meses
                </td>
                <td className="py-3 px-4">
                  <Badge variant={sim.sistemaAmortizacion === 'FRANCES' ? 'bce' : 'seps'} size="sm">
                    {sim.sistemaAmortizacion}
                  </Badge>
                </td>
                <td className="py-3 px-4 text-right font-numeric-data font-bold text-secondary">
                  {formatUSD(sim.totalPagar)}
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="inline-flex items-center gap-2">
                    <Link to={`/creditos/simulador/${sim.id}`}>
                      <Button variant="outline" size="sm" iconName="visibility">
                        Ver
                      </Button>
                    </Link>
                    <Button variant="ghost" size="sm" iconName="download" onClick={() => handleDownloadPdf(sim.id)}>
                      PDF
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
