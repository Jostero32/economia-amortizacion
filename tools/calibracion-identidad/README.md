# Calibración de la verificación de identidad

Mide, con cédulas reales, qué tan bien funcionan la comparación facial y la lectura de la MRZ, para
fijar los umbrales de la verificación de identidad. Resultados y decisiones en
[docs/verificacion-identidad.md](../../docs/verificacion-identidad.md).

Usa el mismo motor que el servidor: `@vladmandic/face-api` con TensorFlow WASM, Tesseract.js con el
modelo `mrz` de [tesseractMRZ](https://github.com/DoubangoTelecom/tesseractMRZ) (BSD-3, se descarga
en la primera ejecución y se verifica su hash) y `sharp`.

## Privacidad

- La carpeta con las fotos **debe estar fuera del repositorio**; si no, la herramienta se niega a leerla.
- El informe muestra solo estadísticas (distancias, validaciones, tiempos), nunca nombres ni números.
- Pide permiso a cada titular: la cédula y el rostro son datos personales (la biometría es un dato
  sensible según la LOPDP).

## Uso

```bash
cd tools/calibracion-identidad
npm install
npm run calibrar -- "C:\Users\...\cedulas-calibracion"
# Si la cédula antigua y la nueva son de la misma persona pero tienen otro nombre de archivo:
npm run calibrar -- "C:\Users\...\cedulas-calibracion" --persona antigua=electronica2
```

Nombres de archivo: `<documento>-<anverso|reverso|selfie>[-variante].<jpg|jpeg|png|webp>`, por ejemplo
`p1-anverso.jpg`, `p1-reverso.jpg`, `p1-selfie.jpg`, `p1-selfie-lentes.jpg`. La persona es lo que va
antes de `_` en el documento (`p2_antigua-anverso.jpg` es de `p2`). Usa nombres neutros, no el nombre
real de la persona. Las imágenes repetidas se omiten.

Fotos recomendadas: anverso y reverso con el celular, como lo haría un cliente, y una selfie frontal
de cada titular (sin ella no se puede medir la distancia cédula↔rostro de la misma persona).

## Qué informa

1. **Rostros:** la estrategia de detección de cada imagen, la distancia de cada par de la misma
   persona con su banda (coincide ≤ 0,47, dudoso ≤ 0,60) y la distribución de las distancias entre
   personas distintas. Los rostros de ejemplo de face-api se usan como impostores adicionales. Si los
   grupos se solapan, lo avisa.
2. **MRZ:** si el reverso se lee con consenso, en cuántos intentos y con qué nitidez. Luego, una matriz
   de robustez (ancho de la tarjeta × desenfoque), la cantidad de lecturas aceptadas pero erróneas en
   campos protegidos (debe ser 0) y la tasa de acierto según la nitidez mínima exigida.

Los umbrales de la herramienta deben coincidir con los de `frontend/src/utils/faceMatch.js`.
