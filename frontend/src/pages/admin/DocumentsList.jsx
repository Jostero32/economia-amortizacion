import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminService, clientService } from '../../services/api';
import Card from '../../components/Card';
import Table from '../../components/Table';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import Alert from '../../components/Alert';
import { LoadingState } from '../../components/Spinner';
import { REQUIRED_DOCUMENTS, POLICY_DOCUMENT, DOCUMENT_STATUS } from '../../components/application/applicationStatus';
import { formatDateTime } from '../../utils/format';

const DOCUMENT_LABELS = Object.fromEntries(
  [...REQUIRED_DOCUMENTS, POLICY_DOCUMENT].map((doc) => [doc.tipo, doc.label])
);
const FILTERS = [
  { value: 'PENDIENTE', label: 'Por revisar' },
  { value: 'RECHAZADO', label: 'Rechazados' },
  { value: 'VALIDADO', label: 'Validados' },
  { value: 'TODOS', label: 'Todos' },
];

export default function DocumentsList() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('PENDIENTE');

  useEffect(() => {
    adminService
      .getDocuments()
      .then((res) => setDocuments(res.data.documents || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <LoadingState message="Cargando documentos..." />;
  }

  const visible = filter === 'TODOS' ? documents : documents.filter((doc) => doc.estado === filter);

  return (
    <div className="space-y-space-md max-w-[1440px] mx-auto">
      <div className="bg-surface-container-lowest p-space-lg rounded-xl border border-surface-container-high shadow-xs">
        <h1 className="font-headline-lg text-[24px] sm:text-[28px] text-primary font-bold">Documentos recibidos</h1>
        <p className="text-[13px] text-on-surface-variant mt-0.5">
          Documentos subidos por los clientes. La validación se hace desde cada solicitud.
        </p>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value)}
            className={`px-3 py-1.5 rounded-lg text-[13px] border ${
              filter === option.value ? 'bg-secondary text-white border-secondary' : 'bg-white text-primary border-gray-200'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <Card title={`${visible.length} documento(s)`}>
        {visible.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-on-surface-variant">No hay documentos en esta categoría.</p>
        ) : (
          <Table headers={['Documento', 'Solicitud', 'Recibido', 'Estado', { label: 'Acciones', align: 'text-right' }]}>
            {visible.map((doc) => {
              const application = doc.creditApplication || doc.investmentApplication;
              const reviewPath = doc.creditApplication
                ? `/admin/solicitudes/${doc.creditApplicationId}`
                : `/admin/solicitudes/inversion/${doc.investmentApplicationId}`;
              const status = DOCUMENT_STATUS[doc.estado];
              return (
                <tr key={doc.id} className="hover:bg-surface-container-low/40">
                  <td className="py-3 px-4 text-[13px]">
                    <span className="block font-medium text-primary">{DOCUMENT_LABELS[doc.tipo] || 'Otro documento'}</span>
                    <span className="block text-[11px] text-on-surface-variant truncate max-w-[220px]">{doc.nombreArchivo}</span>
                  </td>
                  <td className="py-3 px-4 text-[13px]">
                    <span className="block font-numeric-data text-primary">{application?.codigo || '—'}</span>
                    <span className="block text-[11px] text-on-surface-variant">
                      {application ? `${application.nombres} ${application.apellidos}` : ''}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-[12px] text-on-surface-variant">{formatDateTime(doc.createdAt)}</td>
                  <td className="py-3 px-4">
                    <Badge variant={status?.variant} size="sm">{status?.label || doc.estado}</Badge>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <a href={clientService.getDocumentUrl(doc.id)} target="_blank" rel="noreferrer" className="text-[12px] text-secondary hover:underline mr-3">
                      Ver archivo
                    </a>
                    {application && (
                      <Link to={reviewPath}>
                        <Button variant="outline" size="sm">Revisar solicitud</Button>
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
    </div>
  );
}
