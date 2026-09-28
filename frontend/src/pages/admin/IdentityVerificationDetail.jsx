import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { adminService } from '../../services/api';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Badge from '../../components/Badge';
import Alert from '../../components/Alert';
import Table from '../../components/Table';
import { LoadingState } from '../../components/Spinner';
import AuthImage from '../../components/identity/AuthImage';
import IdentityBadge from '../../components/identity/IdentityBadge';
import { formatDate, formatDateTime } from '../../utils/format';

const FACE = {
  COINCIDE: { label: 'Coincide', bar: 'bg-emerald-500', text: 'text-emerald-800' },
  DUDOSO: { label: 'Dudoso', bar: 'bg-amber-500', text: 'text-amber-800' },
  NO_COINCIDE: { label: 'No coincide', bar: 'bg-rose-500', text: 'text-rose-800' },
};
const ON_FAIL = { REINTENTO: 'reintento', REVISION: 'revisión del asesor', RECHAZO: 'rechazo' };

function Photo({ verificationId, tipo, label, available }) {
  return (
    <figure className="space-y-1">
      {available ? (
        <AuthImage verificationId={verificationId} tipo={tipo} alt={label} className="w-full h-52 rounded-lg border border-gray-100" />
      ) : (
        <div className="w-full h-52 rounded-lg border border-dashed border-gray-200 flex items-center justify-center text-[12px] text-gray-400">
          Sin captura
        </div>
      )}
      <figcaption className="text-[12px] text-center text-gray-500">{label}</figcaption>
    </figure>
  );
}

/** Detalle de una verificación de identidad y decisión del asesor. */
export default function IdentityVerificationDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [comentario, setComentario] = useState('');
  const [saving, setSaving] = useState(null);
  const [success, setSuccess] = useState(null);

  const load = useCallback(() => {
    adminService.getIdentityVerification(id)
      .then((response) => { setData(response.data); setError(null); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const decide = async (estado) => {
    if (estado === 'RECHAZADA' && comentario.trim().length < 5) {
      setError('Explica al cliente por qué no se aprueba su verificación.');
      return;
    }
    setSaving(estado);
    setError(null);
    try {
      await adminService.decideIdentityVerification(id, { estado, comentario: comentario.trim() });
      setSuccess(estado === 'APROBADA' ? 'Identidad aprobada.' : 'Verificación rechazada.');
      setComentario('');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <LoadingState message="Cargando verificación..." />;
  if (!data) return <Alert type="error">{error || 'Verificación no encontrada.'}</Alert>;

  const { verification: v, history, umbrales } = data;
  const face = v.rostro && FACE[v.rostro.resultado];
  const control = (codigo) => v.controles?.find((c) => c.codigo === codigo);
  const datos = v.datosMrz;
  const rows = datos ? [
    ['Tipo de cédula', datos.consenso ? 'Electrónica (MRZ leída con consenso)' : 'Electrónica (una lectura coincidente con la cédula registrada)', '—', 'MRZ_LEGIBLE'],
    ['Cédula (NUI)', datos.nui, v.user?.cedula || 'no registrada', 'NUI_COINCIDE'],
    ['Cédula en otra cuenta', '—', '—', 'CEDULA_UNICA'],
    ['Nombre', `${datos.apellidos || ''} ${datos.nombres || ''}`.trim(), v.user?.nombre, 'NOMBRE_COINCIDE'],
    ['Fecha de nacimiento', formatDate(datos.fechaNacimiento), '—', 'MAYOR_EDAD'],
    ['Vencimiento', formatDate(datos.fechaVencimiento), '—', 'CEDULA_VIGENTE'],
    ['N.º de documento', datos.numeroDocumento],
    ['Sexo', { M: 'Masculino', F: 'Femenino' }[datos.sexo]],
    ['Donante', datos.donante === true ? 'Sí' : datos.donante === false ? 'No' : '—'],
  ] : [];

  return (
    <div className="space-y-space-md max-w-[1200px] mx-auto">
      <div className="bg-surface-container-lowest p-space-lg rounded-xl border border-surface-container-high shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <Link to="/admin/verificaciones" className="text-[12px] text-secondary hover:underline">← Verificaciones</Link>
          <h1 className="font-headline-lg text-[22px] sm:text-[26px] text-primary font-bold">{v.user?.nombre}</h1>
          <p className="text-[13px] text-on-surface-variant">
            {v.user?.email} · Cédula registrada: <strong className="font-numeric-data">{v.user?.cedula || 'no registrada'}</strong>
          </p>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-1">
          <IdentityBadge identidad={{ estado: v.estado, verificada: v.estado === 'APROBADA' }} />
          {v.aprobacionAutomatica && <Badge variant="success" size="sm" iconName="bolt">Aprobación automática</Badge>}
          <span className="text-[11px] text-gray-500">Intentos: {v.intentos} · Actualizada {formatDateTime(v.updatedAt)}</span>
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {success && <Alert type="success">{success}</Alert>}

      <Card title="Capturas" iconName="photo_library">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Photo verificationId={v.id} tipo="anverso" label="Anverso de la cédula" available={v.capturas.anverso} />
          <Photo verificationId={v.id} tipo="reverso" label="Reverso de la cédula" available={v.capturas.reverso} />
          <Photo verificationId={v.id} tipo="selfie" label="Selfie" available={v.capturas.selfie} />
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md">
        <Card title="Comparación facial" iconName="face">
          {face ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className={`text-[15px] font-bold ${face.text}`}>{face.label}</span>
                <span className="text-[22px] font-bold text-primary">{v.rostro.nivel.toFixed(1)} %</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className={`h-full ${face.bar}`} style={{ width: `${Math.min(100, v.rostro.nivel)}%` }} />
              </div>
              <p className="text-[12px] text-gray-500">
                Distancia entre rostros {v.rostroDistancia?.toFixed(3)}: coincide si es ≤ {umbrales.rostroCoincide}, dudosa hasta {umbrales.rostroDudoso}.
                El porcentaje es una escala para leer la distancia, no una probabilidad.
              </p>
            </div>
          ) : (
            <p className="text-[13px] text-gray-500">Todavía no hay una comparación (falta la selfie o no se detectó un rostro).</p>
          )}
        </Card>

        <Card title="Controles" iconName="fact_check">
          {v.controles?.length ? (
            <ul className="space-y-2">
              {v.controles.map((c) => (
                <li key={c.codigo} className="flex items-start gap-2 text-[13px]">
                  <span className={`material-symbols-outlined text-[18px] ${c.ok ? 'text-emerald-600' : c.ok === false ? 'text-rose-600' : 'text-gray-400'}`}>
                    {c.ok ? 'check_circle' : c.ok === false ? 'cancel' : 'help'}
                  </span>
                  <span>
                    {c.detalle}
                    {c.ok === false && <span className="block text-[11px] text-gray-500">Si falla: {ON_FAIL[c.siFalla]}</span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-gray-500">Sin controles evaluados todavía.</p>
          )}
          {v.motivos?.length > 0 && (
            <Alert type="info" title="Motivos" className="mt-3">
              <ul className="list-disc pl-4 space-y-0.5">{v.motivos.map((m) => <li key={m}>{m}</li>)}</ul>
            </Alert>
          )}
        </Card>
      </div>

      <Card title="Datos de la cédula" iconName="badge">
        {datos && v.tipoCedula !== 'ANTIGUA' ? (
          <Table headers={['Dato', 'En la cédula', 'Registrado', 'Control']}>
            {rows.map(([label, leido, registrado, codigo]) => {
              const c = control(codigo);
              return (
                <tr key={label}>
                  <th scope="row" className="px-4 py-3 font-medium">{label}</th>
                  <td className="px-4 py-3">{leido || '—'}</td>
                  <td className="px-4 py-3">{registrado || '—'}</td>
                  <td className="px-4 py-3">
                    {codigo ? (
                      <span className="flex items-start gap-2">
                        <span aria-hidden="true" className={`material-symbols-outlined text-[18px] ${c?.ok === true ? 'text-emerald-600' : c?.ok === false ? 'text-rose-600' : 'text-gray-400'}`}>
                          {c?.ok === true ? 'check_circle' : c?.ok === false ? 'cancel' : 'help'}
                        </span>
                        <span>{c?.detalle || 'Pendiente de evaluar'}</span>
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              );
            })}
          </Table>
        ) : (
          <p className="text-[13px] text-gray-600">
            Los datos de la cédula no se leyeron automáticamente: compara la cédula de las fotos con los datos registrados del cliente
            ({v.user?.nombre}, cédula {v.user?.cedula || 'no registrada'}).
          </p>
        )}
      </Card>

      {v.estado === 'EN_REVISION' ? (
        <Card title="Decisión" iconName="gavel">
          <div className="space-y-3">
            <label htmlFor="comentario" className="block text-[13px] font-medium text-primary">
              Comentario para el cliente <span className="text-gray-400 font-normal">(obligatorio si no apruebas)</span>
            </label>
            <textarea
              id="comentario"
              rows={3}
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Ej: la selfie no corresponde a la persona de la cédula; vuelve a intentarlo con buena luz."
              className="w-full p-3 rounded-lg border border-gray-200 bg-gray-50 text-[13px]"
            />
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="danger" iconName="gpp_bad" onClick={() => decide('RECHAZADA')} loading={saving === 'RECHAZADA'} loadingText="Guardando..." disabled={Boolean(saving)}>
                Rechazar
              </Button>
              <Button variant="success" iconName="verified_user" onClick={() => decide('APROBADA')} loading={saving === 'APROBADA'} loadingText="Guardando..." disabled={Boolean(saving)}>
                Aprobar identidad
              </Button>
            </div>
          </div>
        </Card>
      ) : v.reviewer && (
        <Card title="Revisión" iconName="gavel">
          <p className="text-[13px]">
            {v.estado === 'APROBADA' ? 'Aprobada' : 'Rechazada'} por <strong>{v.reviewer.nombre}</strong> el {formatDateTime(v.fechaRevision)}.
          </p>
          {v.comentarioRevision && <p className="text-[13px] text-gray-600 mt-1">Comentario: {v.comentarioRevision}</p>}
        </Card>
      )}

      <Card title="Consentimiento e historial" iconName="history">
        <div className="space-y-2 text-[13px]">
          <p>
            Autorización versión <strong>{v.consentimiento.version}</strong> aceptada el {formatDateTime(v.consentimiento.fecha)}
            {v.consentimiento.ip ? ` desde ${v.consentimiento.ip}` : ''}.
          </p>
          {history.length > 0 ? (
            <ul className="list-disc pl-5 text-gray-600">
              {history.map((h) => (
                <li key={h.id}>
                  <Link to={`/admin/verificaciones/${h.id}`} className="text-secondary hover:underline">Verificación anterior</Link>
                  {' '}({h.estado.toLowerCase().replace('_', ' ')}, {formatDateTime(h.createdAt)}){h.comentarioRevision ? `: ${h.comentarioRevision}` : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">Es la primera verificación del cliente.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
