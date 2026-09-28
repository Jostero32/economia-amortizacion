# FinanEcuador Demo • Sistema Web Académico de Simulación de Créditos e Inversiones

> **Materia:** Ingeniería Económica  
> **Carrera:** Ingeniería de Software / Computación  
> **Contexto:** Simulación financiera basada en normativas y tasas del Banco Central del Ecuador (BCE) a Septiembre de 2026.  
> **Arquitectura:** Backend y Frontend desacoplados, con un `docker-compose.yml` principal para ejecutar todo el sistema y archivos Compose individuales para desarrollo aislado.

---

## 1. Estructura del Proyecto

El proyecto está organizado en dos carpetas totalmente autónomas preparadas para ser versionadas en repositorios de Git separados:

```text
/
├── docker-compose.yml       # Orquestación conjunta: PostgreSQL + Backend + Frontend
├── backend/                  # Repositorio 1: API REST, ORM Sequelize, PostgreSQL, Cálculos y PDF
│   ├── src/
│   │   ├── config/          # Conexión Sequelize y variables de entorno
│   │   ├── models/          # 14 modelos Model-First y asociaciones
│   │   ├── services/        # Lógica financiera pura (Francés, Alemán, Plazo Fijo, PDFKit)
│   │   ├── controllers/     # Controladores HTTP
│   │   ├── middleware/      # Auth JWT en cookies, RBAC, Multer, Errores
│   │   ├── validators/      # Reglas express-validator
│   │   ├── seed/            # Semilla oficial con datos BCE y usuarios demo
│   │   ├── utils/           # Respuestas estándar y AuditLogger
│   │   ├── app.js
│   │   └── server.js
│   ├── tests/               # Pruebas unitarias y de integración en Jest
│   ├── uploads/             # Volumen de archivos persistidos
│   ├── .gitignore           # Ignora node_modules, .env, uploads/*, logs, coverage
│   ├── Dockerfile
│   ├── docker-compose.yml   # Contiene: postgres (con healthcheck) + backend API
│   ├── .env.example
│   └── package.json
│
├── frontend/                 # Repositorio 2: SPA React 18, Vite, Tailwind CSS
│   ├── src/
│   │   ├── components/      # Navbar, Footer, Sidebar, Card, Table, Modal, FormInput, etc.
│   │   ├── layouts/         # PublicLayout, ClientLayout, AdminLayout
│   │   ├── pages/           # Vistas públicas (sin login), portal cliente y portal asesor/admin
│   │   ├── routes/          # AppRouter, ProtectedRoute, PublicRoute
│   │   ├── services/        # Cliente api.js con Axios y withCredentials
│   │   ├── context/         # AuthContext
│   │   └── index.css        # Tailwind directives
│   ├── .gitignore           # Ignora node_modules, dist, .env, logs
│   ├── Dockerfile
│   ├── docker-compose.yml   # Desarrollo aislado: Nginx 80 publicado en localhost:5173
│   ├── .env.example
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
└── README.md
```

---

## 2. Cómo desplegar con Docker y Dokploy

El `docker-compose.yml` de la raíz usa puertos internos (`expose`), sin publicar puertos en el host.
Varias aplicaciones pueden usar los mismos puertos internos sin ocupar los puertos del servidor.
Nginx atiende la SPA y reenvía `/api/` a Express dentro de la red de Compose.

| Servicio | Puerto interno | Acceso |
| --- | --- | --- |
| `frontend` | **80** | Dominio HTTPS de Dokploy |
| `backend` | **8080** | Nginx → `backend:8080` |
| `db` | **5432** | Backend → `db:5432` |

En Dokploy, despliega el Compose de la raíz y dirige el dominio al servicio **`frontend`, puerto 80**.
Si usas un prefijo público, configura la misma ruta en `VITE_BASE_PATH` (por ejemplo,
`/economia/simulador/`). Nginx admite que el proxy conserve o quite ese prefijo. El navegador pide
la API bajo ese mismo dominio y prefijo; no hace falta publicar otro puerto para el backend.

Variables de entorno del despliegue:

| Variable | Valor |
| --- | --- |
| `POSTGRES_PASSWORD` | Obligatoria: contraseña de PostgreSQL |
| `JWT_SECRET` | Obligatoria: secreto propio para firmar las sesiones |
| `FRONTEND_URL` | Obligatoria: origen público, por ejemplo `https://finanzas.example.com` |
| `POSTGRES_DB` / `POSTGRES_USER` | Por defecto `finanecuador` / `postgres`; conserva los valores de la base existente |
| `NODE_ENV` | Por defecto `production` (sesiones con cookie segura; requiere HTTPS) |
| `VITE_BASE_PATH` | `/` por defecto, o el prefijo público del sitio |
| `VITE_API_URL` | Vacía por defecto: API del mismo dominio y prefijo. Configúrala solo si usas una API pública separada |

`BACKEND_PORT` y `FRONTEND_PORT` ya no se utilizan. El puerto interno de Nginx es **80**, no 8088
ni 5173. `VITE_*` se incorpora al compilar: cambiar esas variables requiere reconstruir el frontend.
Nginx admite hasta 50 MB por petición para las capturas; el backend conserva su límite de 8 MB por
imagen. Si el proxy externo aplica un límite menor, ajústalo para admitir esas peticiones.

El backend espera a PostgreSQL; Nginx espera al estado saludable del backend. Los volúmenes
`postgres_data` y `uploads_data` persisten la base y las capturas. Al iniciar se crean las tablas
faltantes, se aplican migraciones aditivas y se carga la semilla.

Con las variables configuradas, `docker compose up -d --build` levanta los servicios internos.
La salud se consulta en `https://TU_DOMINIO/api/health` (o bajo el prefijo público).
Para desarrollo aislado, los Compose de `backend/` y `frontend/` sí publican puertos locales;
el frontend aislado sirve Nginx en `http://localhost:5173` y usa la API local en el puerto 8080.

---

## 3. Fórmulas Financieras y Práctica Bancaria

### 3.1 Tasa nominal y Tasa Efectiva Anual (TEA)
Instructivo de Tasas de Interés del BCE, Anexo 1. Con `i` = tasa nominal anual y `n` = días del período de pago (30 si es mensual):
$$TEA = \left[1 + i \cdot \frac{n}{360}\right]^{\frac{360}{n}} - 1$$
Los productos se configuran con su TEA (la que se compara con la tasa efectiva máxima del BCE del segmento). La tasa de cada período de pago de $n$ días es:
$$i_{\text{periódica}} = (1 + TEA)^{\frac{n}{360}} - 1$$
y la tasa nominal que se informa al cliente es $\frac{360}{n} \cdot i_{\text{periódica}}$ (por ejemplo, con pagos mensuales TEA 16,77 % ⇔ nominal 15,60 %). La TEA no cambia con la frecuencia; la nominal del contrato sí. La tasa siempre se interpreta como porcentaje (0,9 es 0,9 %, no 90 %).

### 3.1.1 Frecuencia de pago
| Frecuencia | Meses por cuota | $n$ (días) |
| :--- | :---: | :---: |
| Mensual | 1 | 30 |
| Bimestral | 2 | 60 |
| Trimestral | 3 | 90 |
| Semestral | 6 | 180 |

Cada producto define qué frecuencias admite (por defecto solo mensual; en microcrédito y productivo también bimestral, trimestral y semestral, porque el flujo del negocio suele ser estacional). El plazo debe ser múltiplo de los meses por cuota: 24 meses trimestrales son 8 cuotas. En las fórmulas de las secciones 3.2 y 3.3, $i$ es la tasa periódica y $n$ el número de cuotas.

### 3.2 Sistema de Amortización Francés (cuota fija)
$$C = P \cdot \left[ \frac{i(1+i)^n}{(1+i)^n - 1} \right]$$
- La cuota publicada es $C$ redondeada a centavos; $\text{capital}_k = C - \text{interés}_k$, con $\text{interés}_k = \text{saldo}_k \cdot i$.
- La última cuota absorbe la diferencia de centavos para que $\sum \text{capital} = P$ y el saldo final sea $0.00$.

### 3.3 Sistema de Amortización Alemán (cuota decreciente)
$$\text{amortización} = \frac{P}{n}$$
Capital constante, intereses y cuota decrecientes. La última cuota absorbe la diferencia de redondeo del capital.

### 3.4 Fechas de pago
Cada cuota vence el mismo día del mes de la fecha de desembolso (cada 1, 2, 3 o 6 meses según la frecuencia); si el mes es más corto se usa su último día (31-ene → 28-feb → 31-mar). Las fechas se calculan en la zona horaria de Ecuador (America/Guayaquil). La fecha de desembolso o apertura puede ir de hoy hasta 90 días.

### 3.5 Redondeo
Todos los montos se redondean a centavos con criterio *half-up* en un solo módulo (`backend/src/utils/money.js`), desplazando el punto decimal en notación exponencial para evitar errores de representación binaria (10000,005 → 10000,01).

### 3.6 Cargos asociados al crédito
La ley prohíbe cobrar comisiones por conceder el crédito o por prepago; el costo del crédito es la TEA más los impuestos de ley. Los cargos se clasifican en impuesto de ley, seguro de desgravamen, otro seguro o gasto a terceros:
- **Contribución SOLCA (0,5 %)**: impuesto de ley **retenido al desembolso** (el cliente recibe $P - \text{SOLCA}$). Si el plazo es menor a un año se anualiza: $P \cdot 0{,}5\,\% \cdot \frac{\text{días}}{360}$; si es de un año o más se cobra una sola vez: $P \cdot 0{,}5\,\%$.
- **Seguro de desgravamen**: prima mensual sobre el saldo de capital (0,05 % mensual, valor demostrativo). Obligatorio en créditos de vivienda (Inmobiliario, VIS, VIP); en los demás el cliente decide si lo incluye.
- **Póliza de desgravamen propia**: en vivienda el cliente puede endosar a la entidad una póliza contratada por su cuenta (Circular SB-IG-2024-0034-C). Entonces no se cobra el desgravamen de la entidad en la cuota, y la solicitud solo se aprueba con el documento de la póliza validado.
- Cargos de pago único (UNA_VEZ) se descuentan al desembolso. Los periódicos se suman a cada cuota; los mensuales se multiplican por los meses que cubre la cuota (por ejemplo, 3 en trimestral).

### 3.7 Costo efectivo anual (informativo)
TIR por período de los flujos reales del cliente (valor recibido al desembolso y pago total de cada cuota, con seguros), anualizada como $(1 + TIR)^{m} - 1$, con $m$ = cuotas por año (12 mensual, 4 trimestral…). Sin cargos coincide con la TEA; con SOLCA y desgravamen es mayor (por ejemplo, 16,77 % → 18,06 %).

### 3.8 Inversiones a Plazo Fijo (interés simple comercial)
$$\text{interés} = \text{capital} \cdot \left( \frac{\text{tasa}}{100} \right) \cdot \left( \frac{\text{días}}{360} \right)$$
- La tasa depende del tramo de días del producto.
- **Retención del Impuesto a la Renta**: 3 % de los intereses (desde el 1-mar-2026, Res. SRI NAC-DGERCGC26-00000009) cuando el plazo es menor a 180 días; desde 180 días está exento.
- $\text{valor a recibir} = \text{capital} + \text{interés} - \text{retención}$.
- Pago de intereses **al vencimiento** o **mensual** (cada 30 días, con el capital al final). La TEA usa $n$ = plazo si se paga al vencimiento y $n = 30$ si se paga mensualmente.

### 3.9 Abono extraordinario (prepago parcial)
Sobre una simulación guardada, el cliente elige después de qué cuota abona y cuánto (hasta el saldo de capital en ese momento). No hay penalidad, porque la ley la prohíbe. El abono se resta del saldo y el resto del crédito se recalcula con la misma tasa periódica:
- **Reducir el plazo**: se mantiene la cuota pura (francés) o la amortización constante (alemán), y el crédito termina antes.
- **Reducir la cuota**: se mantiene el número de cuotas restantes y se recalcula la cuota sobre el nuevo saldo.

Se informa el ahorro en intereses y seguros frente a la tabla original, y la nueva tabla de amortización.

### 3.10 Ahorro programado
El cliente aporta una cuota fija $A$ al inicio de cada mes y el saldo se capitaliza mensualmente con $j = \frac{\text{tasa}}{12}$ (anualidad anticipada):
$$VF = A \cdot \frac{(1 + j)^{k} - 1}{j} \cdot (1 + j)$$
con $k$ = meses. El sistema lo calcula mes a mes, redondeando a centavos, y muestra el cronograma de aportes. La TEA informada es $(1 + j)^{12} - 1$. Los montos mínimo y máximo del producto se refieren al aporte mensual. Para la retención se aplica la misma regla del depósito a plazo (3 % si el plazo es menor a 180 días); es un supuesto académico, porque cada entidad define el tratamiento de su producto.

---

## 4. Reglas de la Solicitud y Permisos

### 4.1 Solicitud de crédito
- Se formaliza a partir de una simulación del mismo cliente, con los mismos datos, de hasta 30 días de antigüedad y con la tasa vigente; una simulación admite una sola solicitud.
- Capacidad de pago: la cuota más alta (con seguros), llevada a su equivalente mensual si la frecuencia no es mensual, no puede superar ingresos − gastos. Se informa la relación cuota/ingreso (referencia: 40 %).
- La frecuencia de pago y la póliza de desgravamen propia deben coincidir con la simulación; con póliza propia se exige además el documento de la póliza.
- Edad: mayor de edad y máximo 80 años al terminar el crédito.
- Cédula ecuatoriana con dígito verificador, teléfono celular o fijo válido y autorización de consulta al buró de crédito. En inversiones se exige la declaración de licitud de fondos.
- Estados: Recibida → En revisión → (Documentos pendientes) → Aprobada / No aprobada. Solo se aprueba desde En revisión, con los documentos validados (domicilio, ingresos y, si aplica, la póliza) y la identidad del cliente verificada (ver 4.1.1). Rechazar la solicitud o un documento exige indicar el motivo al cliente. Una solicitud resuelta no admite cambios ni documentos.

### 4.1.1 Verificación de identidad (eKYC)
- Se hace **una vez por persona**: se ofrece al terminar el registro y es obligatoria antes de la primera solicitud (con la verificación en revisión ya se puede solicitar, pero el crédito o la inversión solo se aprueban con la identidad verificada). Se repite si la cédula vence o si el asesor la rechaza.
- Pasos en `/cliente/verificacion`:
  1. **Autorización** del tratamiento de datos personales y biométricos (LOPDP), versionada y guardada con la fecha y la IP.
  2. **Anverso** y **reverso** de la cédula con un marco guía que se toma solo cuando la imagen está nítida (también se puede subir una foto).
  3. **Selfie y dos movimientos cortos** (giros o sonrisa), elegidos por el servidor, con óvalo guía y captura automática. Cada movimiento tiene 15 segundos y se puede repetir.
- El **servidor** decide: normaliza las fotos (orientación EXIF, recorte de la tarjeta), compara el rostro de la cédula con la selfie (`@vladmandic/face-api` con TensorFlow WASM) y aplica las reglas (`backend/src/services/identity/decisionEngine.js`). Lo que calcula el navegador solo guía la captura.
- Resultado según la distancia *d* entre descriptores faciales: **Coincide** si *d* ≤ 0,50; **Dudoso** si *d* ≤ 0,60 (revisión del asesor); **No coincide** si *d* > 0,60 (reintentar, hasta 3 intentos). Umbrales en `backend/src/config/identity.js`, calibrados con cédulas reales ([docs/verificacion-identidad.md](docs/verificacion-identidad.md)).
- El reverso se lee con Tesseract y el modelo MRZ: se exigen dos lecturas coincidentes o una cuyo NUI sea exactamente la cédula registrada. Si rostro, número de cédula, nombre, mayoría de edad, vigencia y unicidad coinciden, la identidad se aprueba automáticamente. Solo una cédula vencida o una persona menor de edad producen rechazo automático.
- La cédula del modelo anterior, sin MRZ, pasa al asesor. Si la franja no se lee, se ofrece repetir la foto o continuar como modelo anterior.
- La aprobación automática también exige **prueba de vida**: el servidor comprueba el movimiento y que cada fotograma corresponda a la persona de la selfie. Sin cámara, subir una foto envía el caso al asesor. Un movimiento fallido permite reintentar; al tercer fallo pasa a revisión. Los fotogramas quedan visibles para el asesor junto con sus resultados.
- Con la identidad aprobada, las solicitudes toman la cédula y la fecha de nacimiento verificadas; el formulario las muestra bloqueadas y el servidor las aplica aunque se envíen otros valores.
- Los casos que no se resuelven solos pasan a la cola del asesor (**Verificaciones**), con las capturas, los controles y los motivos; aprobar o rechazar queda auditado.
- El panel del asesor y del administrador muestra verificaciones por estado, porcentaje de aprobación automática sobre las aprobadas, tipos de cédula, cinco motivos frecuentes, tiempo promedio hasta la decisión del asesor y distancias faciales de las aprobadas. Las métricas cuentan verificaciones, incluidos reintentos en registros nuevos y la cuenta de demostración.
- Plan completo por fases: [docs/fases-verificacion-identidad.md](docs/fases-verificacion-identidad.md). La calibración se repite con [tools/calibracion-identidad](tools/calibracion-identidad/README.md).

### 4.2 Matriz de permisos

| Acción | Público | Cliente | Asesor | Admin |
| :--- | :---: | :---: | :---: | :---: |
| Simular y descargar el PDF de una simulación | ✓ | ✓ | ✓ | ✓ |
| Verificar su identidad (cédula y selfie) | – | Propia | – | – |
| Crear solicitudes y subir documentos | – | Propias | – | – |
| Ver solicitudes, documentos y PDF de solicitudes | – | Propias | Todas | Todas |
| Cambiar estado de solicitudes y validar documentos | – | – | ✓ | ✓ |
| Revisar y resolver verificaciones de identidad | – | – | ✓ | ✓ |
| Productos, tasas, cobros, institución, usuarios y auditoría | – | – | – | ✓ |

Los documentos de las solicitudes se guardan en `uploads/documentos`, que no se publica como archivo estático; solo se entregan por `/api/documents/:id` con este control de acceso. Las capturas de la verificación de identidad van en `uploads/documentos/identidad` y solo se entregan al titular y al personal por `/api/identity/:id/archivos/:tipo`.

---

## 5. Pruebas Automatizadas (Jest)

Las pruebas de integración recrean las tablas (`sync({ force: true })`), así que **deben apuntar a una base de datos exclusiva para pruebas**. Por ejemplo, con un PostgreSQL temporal:

```bash
docker run -d --rm --name finanecuador-test-db -e POSTGRES_PASSWORD=postgres -p 5433:5432 postgres:16-alpine

cd backend
NODE_ENV=test DB_HOST=localhost DB_PORT=5433 DB_NAME=finanecuador_test \
DB_USER=postgres DB_PASSWORD=postgres npm test
```

Las variables definidas en la línea de comandos tienen prioridad sobre las de `backend/.env`.

Cobertura: motor de amortización (francés y alemán), frecuencias de pago, abono extraordinario, fechas de fin de mes, redondeo, conversión nominal/TEA, cargos (SOLCA anualizada, desgravamen, póliza propia, opcionales), costo efectivo, inversiones (retención, tramos, pago mensual, ahorro programado), cédula ecuatoriana, validaciones con mensajes por campo, reglas de la solicitud, flujo de estados, permisos por rol, protección de documentos y generación de PDF.

Identidad: consentimiento, capturas privadas, comparación facial real con WASM, lectura OCR de una MRZ sintética, comparación de nombres y datos, aprobación automática, revisión del asesor e integración con solicitudes. Las fotos de calibración reales se mantienen fuera del repositorio.

Prueba de vida: geometría con puntos sintéticos, identidad y orden de los fotogramas, ausencia de cámara, falta de movimiento, otra persona, intentos agotados y permisos de acceso. La validación de movimientos con una persona frente a un celular por HTTPS sigue pendiente; los recorridos automatizados no la sustituyen.

Validación al cierre de las fases 2–4: **320 pruebas en 25 suites**, build del frontend y recorridos de navegador correctos. Las métricas incluyen pruebas de permisos, estados, porcentajes, promedios, motivos y límites de los intervalos.

Comprobación de dependencias de identidad en Docker (desde la raíz del repositorio, con una fixture sintética montada en solo lectura):

```bash
docker build -t finanecuador-backend ./backend
docker run --rm \
  --mount "type=bind,source=$(pwd)/backend/tests/fixtures/mrz-sintetica.jpg,target=/fixtures/mrz-sintetica.jpg,readonly" \
  finanecuador-backend node scripts/check-identity-runtime.js /fixtures/mrz-sintetica.jpg
```

En PowerShell, usa `${PWD}` en lugar de `$(pwd)` para la ruta del montaje. La comprobación detecta un rostro de ejemplo del paquete y lee la MRZ sintética con consenso en `node:20-alpine`. `.dockerignore` excluye las capturas de `uploads`, los tests y los reportes de la imagen.

---

## 6. Usuarios de Demostración (Seed)

| Rol | Correo | Contraseña | Permisos |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `admin@finanecuador.local` | `Admin123!` | Configuración total, tasas, cobros, productos, auditoría. |
| **ASESOR** | `asesor@finanecuador.local` | `Asesor123!` | Revisión de solicitudes, documentos y verificaciones de identidad. |
| **CLIENTE** | `cliente@finanecuador.local` | `Cliente123!` | Solicitud formal de crédito/inversión y subida de expedientes. |

*(La pantalla de Login incluye botones de carga rápida con 1 solo clic).*

---

## 7. Descargo Académico

- Proyecto universitario desarrollado para la materia **Ingeniería Económica**.
- Las tasas son valores referenciales tomados de las resoluciones del **Banco Central del Ecuador a Septiembre de 2026**. Los productos marcados como *valores demostrativos* (montos, plazos y la prima del desgravamen) son ilustrativos.
- La verificación de identidad usa reconocimiento facial y lectura de la cédula en el propio servidor; no es un servicio biométrico certificado ni consulta al Registro Civil. El cliente de demostración ya tiene la identidad verificada (semilla) para probar solicitudes; para probar la verificación, registra un cliente nuevo.
- La plataforma no otorga créditos reales ni capta recursos reales del público.
