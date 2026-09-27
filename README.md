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
│   ├── docker-compose.yml   # Contiene: frontend SPA React/Vite (puerto 5173)
│   ├── .env.example
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
└── README.md
```

---

## 2. Cómo Ejecutar con Docker

Desde el directorio principal:

```bash
docker compose up --build
```

Esto levantará:
- `db`: PostgreSQL 16 (con `healthcheck` y volumen persistente `postgres_data`).
- `backend`: Node.js Express en el puerto `8080` (con volumen persistente `uploads_data`).
- `frontend`: SPA React/Vite en el puerto `5173`.
- Se crearán las tablas faltantes, se ejecutarán migraciones aditivas seguras y se cargará la semilla inicial.

Verificación de salud: [http://localhost:8080/api/health](http://localhost:8080/api/health)
Abrir en el navegador: [http://localhost:5173](http://localhost:5173)

---

## 3. Fórmulas Financieras y Práctica Bancaria

### 3.1 Tasa nominal y Tasa Efectiva Anual (TEA)
Instructivo de Tasas de Interés del BCE, Anexo 1. Con `i` = tasa nominal anual y `n` = días del período de pago (30 si es mensual):
$$TEA = \left[1 + i \cdot \frac{n}{360}\right]^{\frac{360}{n}} - 1$$
Los productos se configuran con su TEA (la que se compara con la tasa efectiva máxima del BCE del segmento). La tasa periódica mensual es:
$$i_{\text{mensual}} = (1 + TEA)^{\frac{30}{360}} - 1$$
y la tasa nominal que se informa al cliente es $12 \cdot i_{\text{mensual}}$ (por ejemplo, TEA 16,77 % ⇔ nominal 15,60 %). La tasa siempre se interpreta como porcentaje (0,9 es 0,9 %, no 90 %).

### 3.2 Sistema de Amortización Francés (cuota fija)
$$C = P \cdot \left[ \frac{i(1+i)^n}{(1+i)^n - 1} \right]$$
- La cuota publicada es $C$ redondeada a centavos; $\text{capital}_k = C - \text{interés}_k$, con $\text{interés}_k = \text{saldo}_k \cdot i$.
- La última cuota absorbe la diferencia de centavos para que $\sum \text{capital} = P$ y el saldo final sea $0.00$.

### 3.3 Sistema de Amortización Alemán (cuota decreciente)
$$\text{amortización} = \frac{P}{n}$$
Capital constante, intereses y cuota decrecientes. La última cuota absorbe la diferencia de redondeo del capital.

### 3.4 Fechas de pago
Cada cuota vence el mismo día del mes de la fecha de desembolso; si el mes es más corto se usa su último día (31-ene → 28-feb → 31-mar). Las fechas se calculan en la zona horaria de Ecuador (America/Guayaquil). La fecha de desembolso o apertura puede ir de hoy hasta 90 días.

### 3.5 Redondeo
Todos los montos se redondean a centavos con criterio *half-up* en un solo módulo (`backend/src/utils/money.js`), desplazando el punto decimal en notación exponencial para evitar errores de representación binaria (10000,005 → 10000,01).

### 3.6 Cargos asociados al crédito
La ley prohíbe cobrar comisiones por conceder el crédito o por prepago; el costo del crédito es la TEA más los impuestos de ley. Los cargos se clasifican en impuesto de ley, seguro de desgravamen, otro seguro o gasto a terceros:
- **Contribución SOLCA (0,5 %)**: impuesto de ley **retenido al desembolso** (el cliente recibe $P - \text{SOLCA}$). Si el plazo es menor a un año se anualiza: $P \cdot 0{,}5\,\% \cdot \frac{\text{días}}{360}$; si es de un año o más se cobra una sola vez: $P \cdot 0{,}5\,\%$.
- **Seguro de desgravamen**: prima mensual sobre el saldo de capital (0,05 % mensual, valor demostrativo). Obligatorio en créditos de vivienda (Inmobiliario, VIS, VIP); en los demás el cliente decide si lo incluye.
- Cargos de pago único (UNA_VEZ) se descuentan al desembolso; los periódicos se suman a cada cuota.

### 3.7 Costo efectivo anual (informativo)
TIR mensual de los flujos reales del cliente (valor recibido al desembolso y pago total de cada cuota, con seguros), expresada como $(1 + TIR)^{12} - 1$. Sin cargos coincide con la TEA; con SOLCA y desgravamen es mayor (por ejemplo, 16,77 % → 18,06 %).

### 3.8 Inversiones a Plazo Fijo (interés simple comercial)
$$\text{interés} = \text{capital} \cdot \left( \frac{\text{tasa}}{100} \right) \cdot \left( \frac{\text{días}}{360} \right)$$
- La tasa depende del tramo de días del producto.
- **Retención del Impuesto a la Renta**: 3 % de los intereses (desde el 1-mar-2026, Res. SRI NAC-DGERCGC26-00000009) cuando el plazo es menor a 180 días; desde 180 días está exento.
- $\text{valor a recibir} = \text{capital} + \text{interés} - \text{retención}$.
- Pago de intereses **al vencimiento** o **mensual** (cada 30 días, con el capital al final). La TEA usa $n$ = plazo si se paga al vencimiento y $n = 30$ si se paga mensualmente.

---

## 4. Reglas de la Solicitud y Permisos

### 4.1 Solicitud de crédito
- Se formaliza a partir de una simulación del mismo cliente, con los mismos datos, de hasta 30 días de antigüedad y con la tasa vigente; una simulación admite una sola solicitud.
- Capacidad de pago: la cuota más alta (con seguros) no puede superar ingresos − gastos; se informa la relación cuota/ingreso (referencia: 40 %).
- Edad: mayor de edad y máximo 80 años al terminar el crédito.
- Cédula ecuatoriana con dígito verificador, teléfono celular o fijo válido y autorización de consulta al buró de crédito. En inversiones se exige la declaración de licitud de fondos.
- Estados: Recibida → En revisión → (Documentos pendientes) → Aprobada / No aprobada. Solo se aprueba desde En revisión, con los 4 documentos validados y la biometría (simulada) aprobada. Rechazar la solicitud o un documento exige indicar el motivo al cliente. Una solicitud resuelta no admite cambios ni documentos.

### 4.2 Matriz de permisos

| Acción | Público | Cliente | Asesor | Admin |
| :--- | :---: | :---: | :---: | :---: |
| Simular y descargar el PDF de una simulación | ✓ | ✓ | ✓ | ✓ |
| Crear solicitudes y subir documentos | – | Propias | – | – |
| Ver solicitudes, documentos y PDF de solicitudes | – | Propias | Todas | Todas |
| Cambiar estado de solicitudes y validar documentos | – | – | ✓ | ✓ |
| Productos, tasas, cobros, institución, usuarios y auditoría | – | – | – | ✓ |

Los documentos de las solicitudes se guardan en `uploads/documentos`, que no se publica como archivo estático; solo se entregan por `/api/documents/:id` con este control de acceso.

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

Cobertura: motor de amortización (francés y alemán), fechas de fin de mes, redondeo, conversión nominal/TEA, cargos (SOLCA anualizada, desgravamen, opcionales), costo efectivo, inversiones (retención, tramos, pago mensual), cédula ecuatoriana, validaciones con mensajes por campo, reglas de la solicitud, flujo de estados, permisos por rol, protección de documentos y generación de PDF.

---

## 6. Usuarios de Demostración (Seed)

| Rol | Correo | Contraseña | Permisos |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `admin@finanecuador.local` | `Admin123!` | Configuración total, tasas, cobros, productos, auditoría. |
| **ASESOR** | `asesor@finanecuador.local` | `Asesor123!` | Revisión de solicitudes, documentos y validación biométrica simulada. |
| **CLIENTE** | `cliente@finanecuador.local` | `Cliente123!` | Solicitud formal de crédito/inversión y subida de expedientes. |

*(La pantalla de Login incluye botones de carga rápida con 1 solo clic).*

---

## 7. Descargo Académico

- Proyecto universitario desarrollado para la materia **Ingeniería Económica**.
- Las tasas son valores referenciales tomados de las resoluciones del **Banco Central del Ecuador a Septiembre de 2026**. Los productos marcados como *valores demostrativos* (montos, plazos y la prima del desgravamen) son ilustrativos.
- La validación biométrica es un flujo simulado mediante revisión manual del asesor.
- La plataforma no otorga créditos reales ni capta recursos reales del público.
