import React, { useEffect, useState } from 'react';
import { adminService, clientService } from '../../services/api';
import Card from '../../components/Card';
import Table from '../../components/Table';
import Button from '../../components/Button';
import { ShieldCheck, ExternalLink, Camera, CheckCircle2, XCircle } from 'lucide-react';

export default function DocumentsList() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadDocuments = () => {
    adminService
      .getDocuments()
      .then((res) => {
        if (res.success) setDocuments(res.data.documents || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const handleUpdateDocStatus = async (id, estado) => {
    try {
      await adminService.updateDocumentStatus(id, { estado });
      loadDocuments();
    } catch (err) {
      alert(err.message || 'Error al actualizar documento');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Bandeja de Documentos y Biometría</h1>
        <p className="text-xs text-slate-500 mt-1">
          Revisión de documentos de identidad, comprobantes y selfies de validación biométrica simulada.
        </p>
      </div>

      <Card title={`Documentos Subidos por Clientes (${documents.length})`}>
        {loading ? (
          <div className="py-8 text-center text-xs text-slate-500">Cargando...</div>
        ) : documents.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">No hay documentos registrados.</div>
        ) : (
          <Table headers={['Tipo', 'Archivo / Tamaño', 'Solicitud Vinculada', 'Fecha', 'Estado', 'Acción Rápida', 'Ver']}>
            {documents.map((doc) => (
              <tr key={doc.id} className="hover:bg-slate-50 transition">
                <td className="px-3.5 py-3 font-bold text-slate-900 text-xs">
                  {doc.tipo === 'SELFIE' ? '📸 FOTO SELFIE (Biometría)' : doc.tipo}
                </td>
                <td className="px-3.5 py-3 text-xs">
                  <div className="text-slate-800 font-medium truncate max-w-[150px]">{doc.nombreArchivo}</div>
                  <div className="text-[10px] text-slate-400">{(doc.tamano / 1024).toFixed(1)} KB</div>
                </td>
                <td className="px-3.5 py-3 text-xs text-slate-600 font-mono">
                  {doc.creditApplication?.codigo || doc.investmentApplication?.codigo || 'Expediente'}
                </td>
                <td className="px-3.5 py-3 text-[11px] text-slate-500">
                  {new Date(doc.createdAt).toLocaleDateString('es-EC')}
                </td>
                <td className="px-3.5 py-3">
                  <span
                    className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      doc.estado === 'VALIDADO'
                        ? 'bg-emerald-100 text-emerald-800'
                        : doc.estado === 'RECHAZADO'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {doc.estado}
                  </span>
                </td>
                <td className="px-3.5 py-3">
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleUpdateDocStatus(doc.id, 'VALIDADO')}
                      className="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[10px] font-bold rounded"
                    >
                      Aprobar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateDocStatus(doc.id, 'RECHAZADO')}
                      className="px-2 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 text-[10px] font-bold rounded"
                    >
                      Rechazar
                    </button>
                  </div>
                </td>
                <td className="px-3.5 py-3">
                  <a
                    href={clientService.getDocumentUrl(doc.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-700 hover:text-brand-900 inline-flex items-center text-xs font-semibold"
                  >
                    <ExternalLink className="h-3.5 w-3.5 mr-1" /> Ver
                  </a>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
