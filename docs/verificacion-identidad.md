# Verificación de identidad (eKYC)

Flujo acordado para verificar que quien solicita un crédito o una inversión es el titular de la cédula,
y resultados de la calibración con cédulas reales (fase 0).

## 1. Flujo

La verificación se hace **una sola vez por persona**: se sugiere al terminar el registro, es obligatoria
antes de la primera solicitud y se reutiliza en las siguientes (se repite si la cédula vence).

```text
Consentimiento → Anverso (marco guía) → Reverso (marco guía) → Selfie + prueba de vida → Comparación → Decisión
```

| Resultado | Condición | Qué pasa |
| --- | --- | --- |
| Aprobación automática | MRZ aceptada, NUI igual al registrado, nombre coincidente, mayor de edad, cédula vigente, prueba de vida superada y distancia facial ≤ 0,50 | Identidad verificada sin intervención humana |
| Revisión del asesor | Distancia entre 0,50 y 0,60, nombre con diferencias, MRZ ilegible (cédula antigua) o baja calidad tras 3 intentos | El asesor ve capturas, datos leídos vs. registrados y el motivo |
| Reintentar | Distancia > 0,60 o prueba de vida fallida | Hasta 3 intentos; luego pasa al asesor |
| Rechazo automático | Cédula vencida o menor de edad | Mensaje claro al cliente |

Se aprueba automáticamente **la identidad, no el crédito**. La decisión se calcula **en el servidor**
con las imágenes subidas; el navegador solo guía la captura.

El detalle de cada fase (modelo, endpoints, pantallas, pruebas y estado) está en
[fases-verificacion-identidad.md](fases-verificacion-identidad.md).

## 2. Calibración (fase 0)

### 2.1 Muestra y método

- **3 personas (P1, P2, P3)**, 4 cédulas: 3 electrónicas (2021, 2023 y 2026, esta última con el holograma
  de abril de 2026 sobre la foto) y 1 antigua (2017). Fotos de rostro: selfie frontal (P2), foto tipo
  carnet a color y foto casual con lentes (P3), y un recorte de la propia cédula como control (P1).
- **Impostores:** cruces entre personas distintas de la muestra y los 22 rostros de ejemplo que trae
  `@vladmandic/face-api`.
- **Herramienta:** [`tools/calibracion-identidad`](../tools/calibracion-identidad/README.md), con el
  mismo motor que usará el servidor (face-api con TensorFlow WASM, Tesseract.js y `sharp`). Las fotos se
  leen desde una carpeta fuera del repositorio y el informe solo contiene estadísticas.

### 2.2 Rostro

Distancia euclidiana entre descriptores de 128 dimensiones (menor = más parecidos), a color:

| Par (misma persona) | Distancia |
| --- | --- |
| P1 control: recorte de la foto de su cédula | 0,122 |
| P2 cédula 2017 ↔ cédula 2021 | 0,404 |
| P2 cédula antigua (foto a color de 2017) ↔ selfie frontal | 0,417 |
| P2 cédula electrónica ↔ selfie frontal | 0,436 |
| P3 cédula con holograma sobre la cara ↔ foto casual con lentes | 0,436 |
| P3 cédula con holograma sobre la cara ↔ foto tipo carnet | 0,443 |

| Personas distintas | Resultado |
| --- | --- |
| 192 pares (muestra + rostros de ejemplo) | mínimo 0,593 · 5 % más bajo ≤ 0,626 · mediana 0,753 |
| Pares muy parecidos (rostros de ejemplo entre sí, misma fiesta y maquillaje) | mínimo 0,468 · 3 de 231 ≤ 0,50 |

**Umbrales calibrados:** coincide si *d* ≤ 0,47 (por debajo de todo impostor observado); dudoso si
0,47 < *d* ≤ 0,60; no coincide si *d* > 0,60. Todos los pares cédula↔rostro de la misma persona
(≤ 0,443) quedan en "coincide".

**Umbrales en uso (más generosos, por decisión del equipo):** coincide si *d* ≤ 0,50. Con solo 3
personas en la muestra se priorizó que la aprobación automática funcione con clientes reales (en el
navegador los genuinos llegaron a 0,467); se acepta que el 1,3 % de los pares de personas muy
parecidas quede por debajo de 0,50, riesgo que mitigan los demás controles (MRZ, cédula registrada,
nombre y prueba de vida). Están en `backend/src/config/identity.js` y se pueden ajustar por
variables de entorno. El porcentaje que ve el asesor es 100 / (1 + e^((d − 0,55)/0,04)): ≈ 78 % en
0,50 y ≈ 22 % en 0,60. Es una escala para leer la distancia, no una probabilidad.

Hallazgos:

- **Comparar en escala de grises empeora.** La foto de la cédula electrónica está en grises (impresión
  láser), pero convertir también la selfie subió la distancia de los pares genuinos (0,418 → 0,456 y
  0,437 → 0,471) y bajó la de los impostores (mínimo 0,593 → 0,572). Se compara a color. Igualar contraste (normalización,
  CLAHE) también empeoró.
- **El detector necesita contexto.** En fotos donde la cara llena el cuadro (foto carnet, recortes) no
  encuentra el rostro; con un margen gris alrededor sí. En las cédulas el rostro mide ~100–130 px y la
  confianza de detección es baja (0,33–0,64), por eso se reintenta con confianza 0,2.
- **Lentes y holograma:** no impidieron la coincidencia (0,436 y 0,443).
- **La imagen fantasma** (foto pequeña arriba a la derecha de la cédula electrónica) no se detecta en
  ninguna muestra: se descarta como control.
- **Navegador vs. servidor:** con Chrome sin GPU (WebGL por software) las distancias salieron hasta
  0,03 más altas que en Node. Por eso la decisión se calcula en el servidor, donde se calibró.
- **Orientación EXIF:** las fotos de celular pueden venir rotadas; hay que aplicar la orientación antes
  de analizar (en el navegador al dibujar en un canvas, en el servidor con `sharp().rotate()`).

### 2.3 MRZ (reverso de la cédula electrónica)

Formato TD1 de la OACI: 3 líneas de 30 caracteres.

| Línea | Contenido | Protección |
| --- | --- | --- |
| 1 | `I<ECU` · n.º de documento (9) · dígito · relleno · **NUI** (cédula, 10) | dígito del documento + dígito compuesto + verificador de la cédula |
| 2 | nacimiento AAMMDD · dígito · sexo · vencimiento · dígito · `ECU` · donante · dígito compuesto | fechas con su dígito; el compuesto cubre documento, NUI, fechas y donante |
| 3 | APELLIDOS`<<`NOMBRES (sin tildes, Ñ→N, truncado a 30) | **ninguna** |

El sexo y la nacionalidad tampoco están cubiertos por el dígito compuesto.

| Modelo de OCR | Líneas exactas (9) | Errores de caracteres |
| --- | --- | --- |
| Tesseract `eng` (genérico) | 2–5 | 27–32: confunde las series de `<` con letras |
| `mrz` de [tesseractMRZ](https://github.com/DoubangoTelecom/tesseractMRZ) (BSD-3, 1,4 MB) | 9 | 0 |

- **Lectura:** se prueban recortes, escalas y preprocesos, y se acepta cuando **dos intentos coinciden**
  en los campos protegidos (consenso). Con un solo intento válido, una lectura errónea puede pasar los
  dígitos de control por azar (cada uno es módulo 10): ocurrió 3 veces con desenfoque fuerte.
- **Nitidez mínima:** varianza del Laplaciano ≥ 40 en la zona MRZ con la tarjeta a 800 px. Con ese
  umbral y consenso, 45 de 45 lecturas degradadas fueron correctas y ninguna errónea fue aceptada.
  Una tarjeta nítida se lee desde 380 px de ancho. Una webcam de laptop (enfoque fijo) suele quedar
  por debajo; el celular funciona.
- **Tiempo:** 0,2–0,8 s por lectura. Alcanza para leer "en vivo" y capturar automáticamente cuando la
  MRZ valida.
- **Nombres:** con capturas nítidas, 36 de 37 lecturas de la línea 3 fueron exactas (máximo 2 errores).
  El nombre registrado convertido al formato MRZ coincidió exactamente en las 3 cédulas. Un hermano con
  los mismos apellidos queda a 11 caracteres. Regla: ≤ 2 diferencias coincide; más, revisión del asesor.

### 2.4 Cédula antigua y códigos

- **No tiene MRZ.** Su foto es a color. El número (NUI) del anverso se leyó por OCR con el dígito
  verificador válido e igual al de la cédula electrónica de la misma persona; la fecha no se pudo
  leer. Estas cédulas pasan al asesor; la lectura OCR del NUI se probó en la calibración, pero su
  integración como ayuda en la aplicación queda como trabajo futuro.
- **Código de barras vertical (electrónica):** CODE_128 con el número de documento, que la MRZ ya
  trae. No aporta.
- **QR (electrónica) y código de barras (antigua):** no se pudieron decodificar a la resolución de las
  fotos.

### 2.5 Geometría para el marco guía

Porcentajes del ancho y alto de la tarjeta (proporción medida 1,557–1,568; formato ID-1: 1,586):

| Zona | Horizontal | Vertical |
| --- | --- | --- |
| Rostro de la foto principal (electrónica) | 11–27 % | 30–63 % |
| Rostro de la foto principal (antigua) | 10–23 % | 39–73 % |
| MRZ | 5–96 % | 61–95 % |

## 3. Decisiones para las fases 1 y 2

1. **Comparación facial en el servidor:** `@vladmandic/face-api` con TensorFlow WASM, sin compilación
   nativa en Docker. La imagen se carga con `sharp().rotate()` y se compara a color. La detección
   reintenta con confianza 0,2 y luego con margen. Umbrales en uso 0,50 / 0,60.
2. **MRZ en el servidor:** Tesseract.js con el modelo `mrz` (incluido en la imagen, con su licencia),
   solo con los caracteres `A–Z 0–9 <`. Se exigen dígitos de control y verificador de la cédula, con
   consenso de 2 lecturas o una sola cuyo NUI coincida exactamente con la cédula registrada.
3. **Captura en el navegador:** el reverso se captura con nitidez ≥ 40; la MRZ se lee al subirlo al
   servidor. El anverso se captura cuando hay un rostro y la nitidez es suficiente.
4. **Comparación de datos:** el NUI de la MRZ debe ser igual a la cédula registrada. Las fechas vienen
   protegidas. Se comparan todas las palabras registradas, sin partículas: una letra de tolerancia,
   dos para palabras de 7 o más letras y nombres cortados. El sexo no se usa.
5. **Cédula antigua:** siempre a revisión del asesor.

## 4. Prueba de vida (fase 3)

Dos retos distintos elegidos por el servidor: giro a la izquierda, giro a la derecha o sonrisa. Cada
fotograma debe mostrar un único rostro que corresponda a la selfie (distancia ≤ 0,60). Se compara
con la selfie frontal: cambio de posición horizontal de la nariz / distancia entre ojos ≥ 0,15 en
el sentido pedido, o aumento del ancho de la boca / distancia entre ojos ≥ 8 %. Son umbrales
iniciales configurables (`IDENTITY_YAW_DELTA`, `IDENTITY_SMILE_DELTA`), enviados al navegador para
guiar la captura y comprobados de nuevo en el servidor.

Las pruebas usan puntos sintéticos y rostros simulados; falta calibrar con movimientos reales desde
un celular por HTTPS y confirmar el signo del giro sobre imágenes sin espejo. No se han modificado
los umbrales faciales 0,50 / 0,60 de la fase 0.

## 5. Limitaciones

- **Muestra pequeña:** 4 pares genuinos cédula↔rostro (más un control). Conviene recalibrar con al menos 10 personas y
  con selfies tomadas con la cámara de la app antes de confiar en la aprobación automática.
- **No es un motor biométrico certificado** ni consulta al Registro Civil. La prueba de vida por retos
  (fase 3) es básica: un video grabado podría engañarla.
- **Sin consentimiento no hay verificación biométrica:** se ofrece la revisión presencial o manual con
  el asesor.
