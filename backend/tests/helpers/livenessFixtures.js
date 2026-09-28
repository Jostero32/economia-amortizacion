/** Puntos faciales sintéticos: ojos separados 0,30, nariz centrada y boca de ancho 0,24. */
function landmarksFor(reto) {
  const points = Array.from({ length: 68 }, () => ({ x: 0.5, y: 0.5 }));
  for (let i = 36; i < 42; i += 1) points[i] = { x: 0.35, y: 0.35 };
  for (let i = 42; i < 48; i += 1) points[i] = { x: 0.65, y: 0.35 };
  points[30] = { x: reto === 'GIRO_IZQUIERDA' ? 0.56 : reto === 'GIRO_DERECHA' ? 0.44 : 0.5, y: 0.5 };
  points[48] = { x: reto === 'SONRISA' ? 0.35 : 0.38, y: 0.7 };
  points[54] = { x: reto === 'SONRISA' ? 0.65 : 0.62, y: 0.7 };
  return points;
}

/** Rostro sintético: la distancia de face(a) a face(b) es |a − b|. */
const face = (value = 0, reto) => ({
  descriptor: [value, ...new Array(127).fill(0)], score: 0.9, faces: 1, box: {}, landmarks: landmarksFor(reto),
});

module.exports = { landmarksFor, face };
