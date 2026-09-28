const STATES = ['EN_CURSO', 'EN_REVISION', 'APROBADA', 'RECHAZADA'];
const LIMITS = [0, 0.3, 0.4, 0.45, 0.5, 0.55, 0.6];
const round = (value) => Math.round(value * 100) / 100;

/** Agrega verificaciones sin incluir datos de los titulares ni rutas de capturas. */
function identityMetrics(verifications) {
  const porEstado = Object.fromEntries(STATES.map((state) => [state, 0]));
  const tiposCedula = { ELECTRONICA: 0, ANTIGUA: 0 };
  const distanciasAprobadas = LIMITS.slice(1).map((hasta, index) => ({ desde: LIMITS[index], hasta, cantidad: 0 }));
  const reasons = new Map();
  let aprobadasAutomaticas = 0;
  let reviewHours = 0;
  let reviews = 0;

  for (const v of verifications) {
    if (STATES.includes(v.estado)) porEstado[v.estado] += 1;
    if (['ELECTRONICA', 'ANTIGUA'].includes(v.tipoCedula)) tiposCedula[v.tipoCedula] += 1;
    if (v.estado === 'APROBADA') {
      if (v.aprobacionAutomatica) aprobadasAutomaticas += 1;
      const distance = v.rostroDistancia == null ? NaN : Number(v.rostroDistancia);
      // Tramos sin solapamiento: [0; 0,30], (0,30; 0,40], …, (0,55; 0,60].
      if (Number.isFinite(distance) && distance >= 0) {
        const bucket = distanciasAprobadas.find((range) => distance <= range.hasta);
        if (bucket) bucket.cantidad += 1;
      }
    }
    if (['EN_REVISION', 'RECHAZADA'].includes(v.estado)) {
      const unique = new Set((v.motivos || []).filter((m) => typeof m === 'string' && m.trim()).map((m) => m.trim()));
      for (const motivo of unique) reasons.set(motivo, (reasons.get(motivo) || 0) + 1);
    }
    if (v.revisadoPor && v.fechaRevision && v.createdAt) {
      const hours = (new Date(v.fechaRevision) - new Date(v.createdAt)) / 3600000;
      if (Number.isFinite(hours) && hours >= 0) { reviewHours += hours; reviews += 1; }
    }
  }

  return {
    total: verifications.length,
    porEstado,
    aprobadasAutomaticas,
    porcentajeAutomatico: porEstado.APROBADA ? round(aprobadasAutomaticas / porEstado.APROBADA * 100) : 0,
    tiposCedula,
    motivosFrecuentes: [...reasons].map(([motivo, cantidad]) => ({ motivo, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad || a.motivo.localeCompare(b.motivo, 'es')).slice(0, 5),
    tiempoPromedioRevisionHoras: reviews ? round(reviewHours / reviews) : null,
    distanciasAprobadas,
  };
}

module.exports = { identityMetrics };
