# Verificación de identidad: plan de fases

Este documento describe, fase por fase, cómo se construye la verificación de identidad (eKYC) de
FinanEcuador: qué se hace, qué archivos y endpoints se agregan, qué reglas se aplican y cómo se
comprueba que funciona. Los resultados de la calibración y el porqué de cada umbral están en
[verificacion-identidad.md](verificacion-identidad.md).

## Resumen

| Fase | Objetivo | Resultado para el cliente |
| --- | --- | --- |
| 0 | Calibrar rostro y MRZ con cédulas reales | Umbrales medidos, no supuestos |
| 1 | Flujo completo con consentimiento, capturas y comparación facial en el servidor; cola del asesor | Verifica su identidad una vez; un asesor la revisa |
| 2 | Lectura de la MRZ, comparación de datos y aprobación automática | Si todo coincide, queda verificado al instante |
| 3 | Prueba de vida con retos | Una foto impresa o de pantalla ya no basta |
| 4 | Métricas, documentación y cierre | El administrador ve cómo funciona la verificación |

## Principios que aplican a todas las fases

1. **Una verificación por persona.** Se hace una vez y se reutiliza en todas las solicitudes. Se
   repite si la cédula vence o si el asesor la rechaza.
2. **El servidor decide.** El navegador solo guía la captura (marco, nitidez, rostro visible). Todo lo
   que decide (comparar rostros, leer la MRZ, aplicar reglas) se recalcula en el servidor con las
   imágenes recibidas, porque lo que calcula el navegador del cliente se puede falsificar.
3. **Se aprueba la identidad, no el crédito.** El crédito o la inversión los sigue aprobando un asesor.
4. **Datos sensibles (LOPDP).** La biometría requiere consentimiento expreso y versionado. Las
   imágenes se guardan en la carpeta privada, se entregan solo al titular y al asesor y nunca se
   publican como archivos estáticos.
5. **Falla segura.** Ante la duda, el caso pasa al asesor; no se rechaza de forma automática salvo
   una cédula vencida o una persona menor de edad.

## Arquitectura

```text
Navegador (cliente)                           Servidor (Express)                       Base de datos
────────────────────                           ──────────────────                       ─────────────
Consentimiento ─────── POST /identity ───────▶ crea verificación EN_CURSO ────────────▶ identity_verifications
Anverso (marco) ────── POST /identity/:id/anverso ▶ normaliza, recorta, detecta rostro   (estado, puntajes,
Reverso (marco) ────── POST /identity/:id/reverso ▶ lee MRZ (fase 2)                      datos leídos,
Selfie (+retos) ────── POST /identity/:id/selfie ──▶ compara rostros, prueba de vida,     motivos, revisión)
                                                    reglas → APROBADA / EN_REVISION /
                                                    reintentar / RECHAZADA
Asesor ─────────────── /admin/identity-verifications ▶ cola, detalle y decisión
```

Servicios del servidor (`backend/src/services/identity/`):

| Módulo | Responsabilidad | Fase |
| --- | --- | --- |
| `imageService.js` | Orientación EXIF, tamaño máximo, recorte de la tarjeta, nitidez | 1 |
| `faceService.js` | face-api con TensorFlow WASM: rostro principal, descriptor, distancia | 1 |
| `identityStorage.js` | Archivos en `uploads/documentos/identidad/<id>/`, con acceso controlado | 1 |
| `decisionEngine.js` | Reglas puras: controles → estado y motivos | 1 (crece en 2 y 3) |
| `mrzService.js` | Tesseract.js con el modelo `mrz`, lectura con consenso, fechas | 2 |
| `nameMatch.js` | Nombre registrado vs. nombre de la MRZ | 2 |
| `livenessService.js` | Verificación de los retos de la prueba de vida | 3 |

Los umbrales viven en `backend/src/config/identity.js` y pueden ajustarse por variables de entorno.

## Modelo de datos: `identity_verifications`

| Campo | Tipo | Uso |
| --- | --- | --- |
| `id`, `userId` | UUID | Verificación y titular |
| `estado` | `EN_CURSO` · `EN_REVISION` · `APROBADA` · `RECHAZADA` | Ciclo de vida |
| `aprobacionAutomatica` | booleano | Aprobada por las reglas, sin asesor |
| `intentos` | entero | Evaluaciones realizadas (máximo 3) |
| `consentimientoVersion`, `consentimientoFecha`, `consentimientoIp` | texto, fecha | Evidencia del consentimiento |
| `anversoRuta`, `reversoRuta`, `selfieRuta`, `vidaRutas` | texto, JSON | Capturas en la carpeta privada |
| `tipoCedula` | `ELECTRONICA` · `ANTIGUA` | Según haya o no MRZ (fase 2) |
| `rostroDistancia`, `rostroNivel`, `rostroResultado` | decimal, texto | Comparación facial |
| `datosMrz` | JSON | NUI, documento, nombres, fechas y sexo leídos (fase 2) |
| `vida` | JSON | Retos pedidos y resultado (fase 3) |
| `controles`, `motivos` | JSON | Cada control con su resultado y los motivos de la decisión |
| `fechaVerificacion`, `vigenteHasta` | fecha | Aprobación y vencimiento de la cédula |
| `revisadoPor`, `fechaRevision`, `comentarioRevision` | UUID, fecha, texto | Decisión del asesor |

Reglas del ciclo de vida:

- Si el cliente ya tiene una verificación `EN_CURSO`, se reutiliza.
- No se puede iniciar otra con una `APROBADA` vigente o una `EN_REVISION`.
- Después de `RECHAZADA`, el cliente puede iniciar una nueva.

## Endpoints

| Método y ruta | Quién | Qué hace | Fase |
| --- | --- | --- | --- |
| `GET /api/identity/me` | Cliente | Estado de su verificación más reciente | 1 |
| `POST /api/identity` | Cliente | Acepta el consentimiento e inicia (o reanuda) la verificación | 1 |
| `POST /api/identity/:id/anverso` | Cliente | Sube el anverso; responde si se encontró la foto del titular | 1 |
| `POST /api/identity/:id/reverso` | Cliente | Sube el reverso; desde la fase 2 lee la MRZ y responde si es legible | 1 |
| `POST /api/identity/:id/selfie` | Cliente | Sube la selfie (y los retos, fase 3); evalúa y decide | 1 |
| `GET /api/identity/:id/archivos/:tipo` | Titular o asesor | Imagen de la verificación | 1 |
| `GET /api/admin/identity-verifications` | Asesor | Cola, filtrable por estado | 1 |
| `GET /api/admin/identity-verifications/:id` | Asesor | Detalle con capturas, controles y motivos | 1 |
| `PATCH /api/admin/identity-verifications/:id/decision` | Asesor | Aprobar o rechazar con comentario | 1 |
| `GET /api/admin/identity-verifications/metrics` | Asesor | Métricas de la verificación | 4 |

Auditoría: `CONSENTIMIENTO_BIOMETRICO`, `CAPTURA_IDENTIDAD`, `VERIFICACION_IDENTIDAD` (decisión
automática) y `REVISION_IDENTIDAD` (decisión del asesor).

## Umbrales (generosos por decisión del equipo)

Con solo 3 personas en la calibración, el equipo decidió priorizar que la aprobación automática
funcione para los clientes reales, a costa de aceptar más riesgo con personas muy parecidas.

| Control | Valor | Justificación |
| --- | --- | --- |
| Rostro: coincide | distancia ≤ 0,50 | Genuinos medidos: 0,40–0,44 en el servidor y hasta 0,47 en el navegador |
| Rostro: dudoso (asesor) | 0,50 < distancia ≤ 0,60 | Personas distintas en general: desde 0,59 |
| Rostro: no coincide (reintentar) | distancia > 0,60 | Mediana de impostores: 0,75 |
| MRZ aceptada | Dos lecturas coincidentes, o una sola cuyo NUI es exactamente la cédula registrada | Una lectura errónea no puede producir justo la cédula del cliente |
| Nitidez del reverso (captura) | ≥ 40 | Con ≥ 40 se leyó bien el 100 % de la muestra |
| Nombre | Todas las palabras registradas (sin partículas; mínimo 2 salvo nombre de una palabra); tolera 1 letra distinta, 2 en palabras de 7 o más letras, y nombres cortados | La MRZ quita tildes, cambia Ñ por N y corta a 30 caracteres |
| Intentos | 3 | Luego pasa al asesor |

Riesgo aceptado: entre rostros de personas muy parecidas (misma edad, maquillaje y luz), el 1,3 % de
los pares medidos quedó por debajo de 0,50. Lo mitigan los demás controles, que también deben
cumplirse: MRZ, cédula registrada, nombre y prueba de vida.

## Fase 0: calibración (hecha)

- **Objetivo:** medir, con cédulas reales, la distancia facial entre la cédula y la selfie, la lectura
  de la MRZ y la robustez ante fotos de baja calidad.
- **Entregables:** [`tools/calibracion-identidad`](../tools/calibracion-identidad/README.md), umbrales
  en `frontend/src/utils/faceMatch.js` y resultados en
  [verificacion-identidad.md](verificacion-identidad.md).
- **Criterio de aceptación:** genuinos e impostores separados en la muestra, y ninguna lectura de MRZ
  errónea aceptada con los controles elegidos. Cumplido.

## Fase 1: flujo completo y cola del asesor

**Objetivo:** que el cliente pueda verificar su identidad de principio a fin y que un asesor la
apruebe o rechace. Todavía no hay aprobación automática.

### Backend

1. **Modelo** `IdentityVerification` y asociación con `User`, que tiene muchas verificaciones.
2. **Servicios:**
   - `imageService`:
     - normaliza cada imagen: aplica la orientación EXIF, limita a 1600 px y guarda en JPEG 90;
     - recorta la tarjeta cuando la foto trae fondo.
   - `faceService`:
     - carga face-api con WASM una sola vez, con precarga al iniciar el servidor;
     - devuelve el rostro principal con reintentos (confianza 0,2 y margen) y la distancia entre dos rostros.
   - `identityStorage`: guarda las capturas en la carpeta privada.
   - `decisionEngine`: en esta fase, rostro no coincide → reintentar; cualquier otro caso → asesor.
3. **Endpoints del cliente:**
   - Consentimiento: texto versionado; se guardan la fecha y la IP.
   - Anverso: si no hay rostro, responde con un mensaje para repetir la foto.
   - Reverso: en esta fase solo se guarda.
   - Selfie: detecta el rostro, compara con el anverso y aplica las reglas.
4. **Endpoints del asesor:** cola por estado, detalle y decisión con comentario obligatorio al rechazar.
5. **Integración con las solicitudes:**
   - Crear una solicitud exige una verificación `APROBADA` vigente o `EN_REVISION`. Si no, responde
     403 con un mensaje que lleva al cliente a verificarse.
   - Aprobar una solicitud exige identidad `APROBADA`. Las solicitudes antiguas que ya tenían la
     biometría validada siguen aprobándose.
   - La cédula y la selfie dejan de ser documentos de cada solicitud: se piden la planilla de
     domicilio, los ingresos y, si aplica, la póliza.
   - Se retira la comparación por solicitud que se hizo antes de la fase 0 (columnas biométricas de
     las solicitudes y `PATCH /admin/applications/:id/biometric`).
6. **Semilla:** el cliente de demostración queda con identidad verificada (marcada como semilla), para
   poder probar solicitudes sin hacer la verificación.

### Frontend

1. **`/cliente/verificacion`**, un asistente de 5 pasos:
   1. **Consentimiento:** explica qué datos se usan, para qué y por cuánto tiempo.
   2. **Anverso** con marco guía:
      - cámara trasera en el celular, máscara semitransparente con la proporción de la cédula y la
        zona de la foto marcada;
      - captura automática cuando la imagen es nítida y hay un rostro;
      - botón manual y opción de subir una foto.
   3. **Reverso** con marco guía y la franja MRZ marcada; captura con nitidez ≥ 40.
   4. **Selfie** con óvalo guía: rostro centrado y de tamaño suficiente.
   5. **Resultado:**
      - aprobada: vuelve a la solicitud;
      - en revisión: se muestra el aviso;
      - reintentar: muestra los motivos y los intentos restantes;
      - rechazada: muestra el motivo del asesor.
2. **Estado de identidad en toda la app:**
   - aviso en el resumen del cliente y en su perfil;
   - al terminar el registro se lleva al cliente a verificarse, con la opción "más tarde";
   - si intenta solicitar sin estar verificado, se le envía al asistente y luego vuelve a su solicitud.
3. **Asesor:**
   - menú **Verificaciones** con la cola;
   - detalle con las capturas, la comparación facial, los controles, los motivos y los botones de decisión;
   - en cada solicitud, el panel muestra el estado de identidad del cliente en lugar de la casilla de
     biometría.

### Pruebas y criterio de aceptación

- **Unitarias:** reglas de decisión e imágenes (orientación, recorte, nitidez).
- **De integración de los endpoints:** con el servicio de rostro simulado, para que la suite sea rápida:
  - consentimiento y estados;
  - acceso a las imágenes solo del titular y del asesor;
  - exigencia de identidad al solicitar y al aprobar;
  - decisión del asesor.
- **Una prueba del servicio de rostro real** con las imágenes de ejemplo de face-api, para que la
  cadena WASM quede cubierta.
- **Prueba de punta a punta en el navegador:** el cliente se registra, se verifica con cámara simulada
  y el asesor aprueba. Luego el cliente puede solicitar.

## Fase 2: MRZ, datos y aprobación automática

**Objetivo:** leer los datos de la cédula, compararlos con los registrados y aprobar sin asesor cuando
todo coincide.

### Backend

1. **`mrzService`:**
   - Tesseract.js con el modelo `mrz` de tesseractMRZ (BSD-3), incluido en `backend/assets/ocr`
     junto con su licencia;
   - solo los caracteres `A–Z 0–9 <`;
   - intentos con distintos recortes, escalas y preprocesos;
   - lectura aceptada según la tabla de umbrales;
   - `mrz` fijo en **4.2.1**, compatible con CommonJS, Jest y Node 20; una lectura basta si el NUI coincide exactamente con la cédula registrada;
   - las fechas AAMMDD se convierten a fecha completa (nacimiento en el siglo que corresponda,
     vencimiento en el 2000).
2. **Reverso:** al subirlo se lee la MRZ y se responde de inmediato:
   - legible → guarda los datos y continúa;
   - ilegible → pide repetir la foto, o permite continuar como "cédula del modelo anterior", que va
     al asesor.
3. **`nameMatch`:** convierte el nombre registrado al formato MRZ (sin tildes, Ñ→N, mayúsculas) y
   compara por palabras según la tabla de umbrales.
4. **Reglas completas** en `decisionEngine`:
   - **Rechazo automático:** cédula vencida o menor de edad.
   - **Aprobación automática:** se cumple todo lo siguiente:
     - rostro ≤ 0,50;
     - MRZ aceptada;
     - NUI igual a la cédula registrada. Si el cliente no registró cédula, se adopta la leída
       siempre que ninguna otra cuenta la tenga;
     - nombre coincidente;
     - mayor de edad y cédula vigente.
   - **Reintentar:** rostro > 0,60 o sin rostro detectable.
   - **Asesor:** todo lo demás, con el motivo concreto:
     - rostro dudoso;
     - NUI distinto al registrado;
     - nombre que no coincide;
     - cédula antigua;
     - cédula ya usada en otra cuenta;
     - intentos agotados.
5. **Vigencia:** `vigenteHasta` = vencimiento de la cédula. Si la verificación aprobada tiene la cédula
   vencida, deja de contar como vigente.

### Frontend

1. **Reverso:** muestra de inmediato si la franja se leyó ("Leímos tu cédula terminada en ••52") o
   pide repetir la foto. Ofrece "Mi cédula es del modelo anterior".
2. **Formularios de solicitud:** con la identidad verificada, la cédula y la fecha de nacimiento se
   llenan con los datos leídos y quedan bloqueadas; el servidor impone esos mismos datos.
3. **Asesor:** tabla "dato leído vs. registrado" con ✓/✗ y el tipo de cédula.

### Pruebas y criterio de aceptación

- **Unitarias:**
  - interpretación de la MRZ con cadenas sintéticas: válidas, con dígito alterado y con fechas límite;
  - comparación de nombres: tildes, Ñ, orden, nombres omitidos o cortados, personas distintas;
  - reglas de decisión: una prueba por cada fila de la tabla.
- **Una prueba del lector de MRZ real** sobre una tarjeta sintética conservada en las fixtures, sin datos
  personales.
- **Integración:** aprobación automática, rechazo por vencimiento y paso al asesor por cada motivo.
- **Punta a punta:** con las cédulas reales de la calibración (fuera del repositorio), una
  verificación debe quedar **aprobada automáticamente al menos una vez**.

## Fase 3: prueba de vida

**Objetivo:** comprobar que frente a la cámara hay una persona real que se mueve, no una foto.

1. **Retos elegidos por el servidor y guiados en el navegador:**
   - 2 retos distintos al azar entre "gira la cabeza a la izquierda", "gira a la derecha" y "sonríe",
     renovados al iniciar o reanudar la verificación;
   - con los puntos faciales de face-api se estima el giro (posición de la nariz respecto a los
     ojos) y la sonrisa (ancho de la boca respecto a la distancia entre los ojos);
   - se captura un fotograma de cada reto cumplido y uno de frente;
   - dos detecciones consecutivas antes de capturar, 15 segundos por reto y opción de repetir;
   - vista en espejo para la persona, capturas sin espejo; un archivo subido omite los retos y va al asesor.
2. **Verificación en el servidor** (`livenessService`):
   - cada fotograma debe tener un rostro de la misma persona que la selfie (distancia ≤ 0,60);
   - el desplazamiento horizontal de la nariz respecto al centro de los ojos, dividido por la distancia
     entre ojos, debe cambiar al menos 0,15 en el sentido pedido respecto de la selfie frontal;
   - la sonrisa debe ensanchar la boca al menos un 8 %.
3. **Reglas:** la aprobación automática exige la prueba de vida superada. Si falla, se reintenta. Si
   no se pudo hacer (sin cámara, por ejemplo al subir fotos), el caso va al asesor.

**Pruebas:**

- **Unitarias:** estimación de giro y sonrisa con puntos faciales sintéticos; reglas.
- **Integración:** sin fotogramas → asesor; foto inmóvil u otra persona → reintentar; tres fallos → asesor;
  capturas ordenadas, almacenadas y accesibles solo al titular y al personal.
- **Navegador:** detección simulada para probar los dos giros, sonrisa, tiempo agotado, repetición y
  envío ordenado de archivos. Este recorrido prueba la interfaz, no la eficacia biométrica.
- **Pendiente:** prueba con una persona real desde un celular por HTTPS. Confirmar el signo del giro
  (izquierda de la persona → mayor desplazamiento horizontal de la nariz en la imagen sin espejo).
  Los umbrales de movimiento son iniciales y todavía no se han calibrado con videos reales.

## Fase 4: métricas y cierre

1. **Métricas para el asesor y el administrador:**
   - verificaciones por estado;
   - porcentaje aprobado automáticamente;
   - motivos más frecuentes de revisión;
   - tiempo promedio de revisión;
   - distribución de las distancias faciales de las aprobadas.
2. **Documentación:** actualizar este plan con el estado final, el README y los límites conocidos.
3. **Limpieza:** revisar los textos, los permisos y la auditoría de extremo a extremo.

Implementación: `GET /api/admin/identity-verifications/metrics`, protegido para asesor y administrador
y registrado antes de la ruta `/:id`. Devuelve datos agregados; no devuelve titulares ni rutas de
capturas. Cuenta registros de verificación, incluida la semilla; los tipos todavía desconocidos no
entran en los totales por tipo. El porcentaje usa aprobadas como denominador (0 si no hay).

El promedio solo incluye registros con revisor y fecha de revisión, desde `createdAt`; sin revisiones
devuelve `null`. Los motivos se cuentan una vez por verificación pendiente o rechazada y se muestran
los cinco más frecuentes. El histograma usa [0; 0,30], (0,30; 0,40], (0,40; 0,45], (0,45; 0,50],
(0,50; 0,55] y (0,55; 0,60]; omite distancias ausentes y fuera del rango.

El panel carga estas métricas de forma independiente, con aviso y reintento si falla la consulta.
El menú lateral se pliega en celular, tanto para el cliente como para el asesor, para que el asistente
y las métricas dispongan del ancho de la pantalla.
La imagen `finanecuador-backend` se construyó sobre `node:20-alpine` y pasó
`scripts/check-identity-runtime.js`: sharp, rostro real de ejemplo con TensorFlow WASM y OCR con
consenso de la MRZ sintética montada en solo lectura. Se comprobó que la imagen no contiene tests
ni capturas de usuarios. Los comandos reproducibles están en el README.

## Límites conocidos

- No es un motor biométrico certificado ni consulta al Registro Civil.
- La prueba de vida por retos es básica: un video grabado podría engañarla.
- Los umbrales salen de una muestra de 3 personas. Conviene recalibrar con más personas usando la
  herramienta de la fase 0.
- Una webcam de laptop (enfoque fijo) suele dar un reverso poco nítido. El celular funciona mejor.

Trabajo futuro opcional: limitar intentos por minuto, implementar la eliminación de capturas a
pedido del titular, leer el NUI de cédulas antiguas por OCR y ofrecer continuación en el celular por QR.
La validación presencial de la fase 3 sigue pendiente: no se reemplaza por la prueba de interfaz ni
por los puntos faciales sintéticos.

## Estado

Validación final (28/09/2026): **320 pruebas en 25 suites**, build del frontend e imagen Docker
correctos. Panel probado en escritorio y a 390 px sin desborde, incluyendo recuperación visible ante
fallo de la consulta de métricas. La auditoría cubre consentimiento, capturas, evaluación y decisión;
las pruebas verifican que un cliente no puede consultar ni modificar verificaciones ajenas. No hay
referencias a los componentes retirados `BiometricCheck`, `SelfieCamera` ni al campo `biometriaResultado`
en el código de la aplicación.

Validación de la fase 3: **313 pruebas en 24 suites** y build del frontend correctos. La prueba de
cámara denegada en Chrome envió una selfie real sin fotogramas y obtuvo `EN_REVISION`, con `VIDA`
pendiente. Esto verifica la alternativa de revisión manual, no una prueba de vida real.

Validación de la fase 2 (28/09/2026): **296 pruebas en 23 suites** y build del frontend correctos.
En Chrome, P2 y P3 quedaron aprobadas automáticamente (distancias 0,4419 y 0,4718); P3 usó el
botón de captura de selfie porque la cámara simulada no activó la captura automática. La cédula
antigua devolvió 422, permitió continuar como modelo anterior y terminó en revisión. Se revisaron
las pantallas del cliente y del asesor. Las imágenes y la base de estas pruebas son temporales y
externas al repositorio.

| Fase | Estado | Commit |
| --- | --- | --- |
| 0 | Hecha | `751e914` |
| 1 | Hecha | `cdbbb3e` |
| 2 | Hecha | `6dc3abe` |
| 3 | Implementada y probada automáticamente; validación presencial pendiente | `7b78429` |
| 4 | Hecha | Commit «Mostrar métricas de identidad y verificar el entorno Docker (fase 4)» |
