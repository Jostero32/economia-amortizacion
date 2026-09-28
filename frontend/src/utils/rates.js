// Conversiones de tasa con base comercial de 360 días (mismas fórmulas que el backend,
// Instructivo de Tasas de Interés del BCE, Anexo 1). Las tasas van en porcentaje.

/**
 * Tasa efectiva del período a partir de la TEA: (1 + TEA)^(días/360) - 1
 */
export function effectiveToPeriodicRate(tea, days = 30) {
  return (Math.pow(1 + Number(tea) / 100, days / 360) - 1) * 100;
}

/**
 * Tasa nominal anual equivalente a una TEA con pagos cada `days` días
 */
export function effectiveToNominalRate(tea, days = 30) {
  return (360 / days) * effectiveToPeriodicRate(tea, days);
}
