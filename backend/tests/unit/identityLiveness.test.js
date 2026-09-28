const { CHALLENGES, generateChallenges, faceMetrics, checkChallenge, evaluateLiveness } = require('../../src/services/identity/livenessService');
const { landmarksFor, face } = require('../helpers/livenessFixtures');

describe('Unitario: prueba de vida', () => {
  const retos = ['GIRO_IZQUIERDA', 'SONRISA'];
  const evaluate = (overrides = {}) => evaluateLiveness({ retos, selfieFace: face(), frameFaces: retos.map((r) => face(0.1, r)), ...overrides });

  test('el servidor elige dos retos distintos del catálogo', () => {
    for (let i = 0; i < 20; i += 1) {
      const generated = generateChallenges();
      expect(generated).toHaveLength(2);
      expect(new Set(generated).size).toBe(2);
      expect(generated.every((reto) => CHALLENGES.includes(reto))).toBe(true);
    }
  });

  test('mide una cara frontal y mantiene las proporciones al cambiar escala y posición', () => {
    const original = landmarksFor();
    expect(faceMetrics(original).yaw).toBeCloseTo(0);
    expect(faceMetrics(original).mouth).toBeCloseTo(0.8);
    const changed = faceMetrics(original.map((p) => ({ x: p.x * 0.5 + 0.1, y: p.y * 0.5 + 0.1 })));
    expect(changed.yaw).toBeCloseTo(0);
    expect(changed.mouth).toBeCloseTo(0.8);
  });

  test.each(CHALLENGES)('reconoce %s y no acepta la selfie inmóvil', (reto) => {
    const reference = faceMetrics(landmarksFor());
    expect(checkChallenge(reto, reference, faceMetrics(landmarksFor(reto)))).toBe(true);
    expect(checkChallenge(reto, reference, reference)).toBe(false);
  });

  test('no confunde el giro a la izquierda con el giro a la derecha', () => {
    expect(checkChallenge('GIRO_IZQUIERDA', faceMetrics(landmarksFor()), faceMetrics(landmarksFor('GIRO_DERECHA')))).toBe(false);
  });

  test('rechaza puntos inválidos, ojos coincidentes y métricas no finitas', () => {
    expect(faceMetrics([])).toBeNull();
    expect(faceMetrics(Array.from({ length: 68 }, () => ({ x: 0, y: 0 })))).toBeNull();
    const broken = landmarksFor();
    broken[30].x = NaN;
    expect(faceMetrics(broken)).toBeNull();
    expect(checkChallenge('SONRISA', { yaw: 0, mouth: 0 }, { yaw: 0, mouth: 1 })).toBe(false);
    expect(checkChallenge('SONRISA', { yaw: 0, mouth: 1 }, { yaw: 0, mouth: Infinity })).toBe(false);
  });

  test('exige los dos movimientos en su orden, realizados por la misma persona', () => {
    expect(evaluate().superada).toBe(true);
    expect(evaluate({ frameFaces: [...retos].reverse().map((r) => face(0.1, r)) }).superada).toBe(false);
  });

  test('una foto estática o una persona distinta no superan la prueba', () => {
    expect(evaluate({ frameFaces: [face(), face()] }).superada).toBe(false);
    const result = evaluate({ frameFaces: retos.map((r) => face(0.61, r)) });
    expect(result.superada).toBe(false);
    expect(result.resultados[0].detalle).toMatch(/no coincide/);
  });

  test('no aprueba si faltan o sobran fotogramas, falta un rostro o hay varias personas', () => {
    for (const frameFaces of [[], [face()], [face(), face(), face()], [null, face()], [{ ...face(), faces: 2 }, face()]]) {
      expect(evaluate({ frameFaces }).superada).toBe(false);
    }
    expect(evaluate({ selfieFace: null }).superada).toBe(false);
    expect(evaluate({ selfieFace: { ...face(), descriptor: [] } }).superada).toBe(false);
  });

  test.each([[], ['SONRISA', 'SONRISA'], ['SONRISA', 'INVENTADO']])('no aprueba retos ausentes o inválidos: %j', (...invalid) => {
    expect(evaluate({ retos: invalid }).superada).toBe(false);
  });
});
