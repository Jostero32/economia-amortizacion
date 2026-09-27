// Estados de una solicitud y su explicación para el cliente

export const STATUS_LABELS = {
  PENDIENTE: 'Recibida',
  EN_REVISION: 'En revisión',
  PENDIENTE_DOCUMENTOS: 'Documentos pendientes',
  APROBADA: 'Aprobada',
  RECHAZADA: 'No aprobada',
};

export const STATUS_DESCRIPTIONS = {
  PENDIENTE: 'Recibimos tu solicitud. Sube tus documentos para que un asesor pueda revisarla.',
  EN_REVISION: 'Un asesor está analizando tu solicitud y tus documentos.',
  PENDIENTE_DOCUMENTOS: 'Necesitamos que completes o corrijas documentos. Revisa la observación del asesor.',
  APROBADA: 'Tu solicitud fue aprobada. Un asesor te contactará para continuar.',
  RECHAZADA: 'Tu solicitud no fue aprobada. Revisa la observación del asesor.',
};

export const CLOSED_STATUSES = ['APROBADA', 'RECHAZADA'];

// Estados a los que el asesor puede mover una solicitud (igual que en el backend)
export const STATUS_TRANSITIONS = {
  PENDIENTE: ['EN_REVISION', 'PENDIENTE_DOCUMENTOS', 'RECHAZADA'],
  EN_REVISION: ['PENDIENTE_DOCUMENTOS', 'APROBADA', 'RECHAZADA'],
  PENDIENTE_DOCUMENTOS: ['EN_REVISION', 'RECHAZADA'],
  APROBADA: [],
  RECHAZADA: [],
};

// El cliente necesita saber qué corregir en estos estados
export const STATUSES_REQUIRING_NOTE = ['PENDIENTE_DOCUMENTOS', 'RECHAZADA'];

export const REQUIRED_DOCUMENTS = [
  { tipo: 'CEDULA', label: 'Cédula de identidad', hint: 'Ambos lados, legible.' },
  { tipo: 'COMPROBANTE_DOMICILIO', label: 'Comprobante de domicilio', hint: 'Planilla de luz, agua o teléfono de los últimos 3 meses.' },
  { tipo: 'COMPROBANTE_INGRESOS', label: 'Comprobante de ingresos', hint: 'Rol de pagos, certificado laboral o declaración de impuestos.' },
  { tipo: 'SELFIE', label: 'Selfie con tu cédula', hint: 'Para la validación biométrica (simulada).' },
];

export const POLICY_DOCUMENT = {
  tipo: 'POLIZA_DESGRAVAMEN',
  label: 'Póliza de desgravamen endosada',
  hint: 'Tu póliza propia, endosada a favor de la institución.',
};

// Con póliza de desgravamen propia se exige además la póliza endosada
export function requiredDocumentsFor(application) {
  return application?.polizaDesgravamenPropia ? [...REQUIRED_DOCUMENTS, POLICY_DOCUMENT] : REQUIRED_DOCUMENTS;
}

export const DOCUMENT_STATUS = {
  PENDIENTE: { label: 'En revisión', variant: 'EN_REVISION' },
  VALIDADO: { label: 'Validado', variant: 'VALIDADO' },
  RECHAZADO: { label: 'Rechazado', variant: 'RECHAZADA' },
};
