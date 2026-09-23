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

## 3. Fórmulas Financieras y Cálculos Rigurosos

### 3.1 Conversión de Tasa Efectiva Anual (TEA) a Periódica Mensual
Las tasas del Banco Central del Ecuador son efectivas anuales. Para cuotas mensuales con año comercial (360 días):
$$i_{\text{mensual}} = (1 + i_{\text{anual}})^{\frac{30}{360}} - 1 = (1 + i_{\text{anual}})^{\frac{1}{12}} - 1$$
*(No se utiliza la división simple $i_{\text{anual}} / 12$).*

### 3.2 Sistema de Amortización Francés
$$C = P \cdot \left[ \frac{i(1+i)^n}{(1+i)^n - 1} \right]$$
- $\text{interés}_k = \text{saldoInicial}_k \cdot i$
- $\text{capital}_k = C - \text{interés}_k$
- **Ajuste en última cuota:** $\text{capital}_n = \text{saldoInicial}_n$ para asegurar matemáticamente que $\sum \text{capital} = P$ y $\text{saldoFinal} = 0.00$.

### 3.3 Sistema de Amortización Alemán
$$\text{amortización} = \frac{P}{n}$$
- Abono a capital constante en cada cuota.
- Intereses decrecientes y cuota total decreciente mes a mes.
- Saldo final garantizado en $0.00$.

### 3.4 Contribución SOLCA (0.50%)
- Retención legal única del **0.50%** sobre el monto de la operación ($P \cdot 0.005$).
- **Estrictamente separada** del interés y del capital, registrada bajo el rubro de cargos adicionales.

### 3.5 Inversiones a Plazo Fijo (Interés Simple Comercial)
$$\text{interés} = \text{capital} \cdot \left( \frac{\text{tasaAnual}}{100} \right) \cdot \left( \frac{\text{días}}{360} \right)$$
$$\text{valorFinal} = \text{capital} + \text{interés}$$

---

## 4. Pruebas Unitarias Automatizadas (Jest)

En la carpeta `backend/`:
```bash
npm test
```
Resultados obtenidos:
- **130 pruebas aprobadas en 13 suites**.
- Se valida la coincidencia de sumatoria de capital con el monto inicial, saldo final en $0.00$, intereses decrecientes, separación de SOLCA y rechazo de tasas que superen el techo legal del BCE.

---

## 5. Usuarios de Demostración (Seed)

| Rol | Correo | Contraseña | Permisos |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `admin@finanecuador.local` | `Admin123!` | Configuración total, tasas, cobros, productos, auditoría. |
| **ASESOR** | `asesor@finanecuador.local` | `Asesor123!` | Revisión de solicitudes, documentos y validación biométrica simulada. |
| **CLIENTE** | `cliente@finanecuador.local` | `Cliente123!` | Solicitud formal de crédito/inversión y subida de expedientes. |

*(La pantalla de Login incluye botones de carga rápida con 1 solo clic).*

---

## 6. Descargo Académico

- Proyecto universitario desarrollado para la materia **Ingeniería Económica**.
- Las tasas son valores referenciales tomados de las resoluciones del **Banco Central del Ecuador a Septiembre de 2026**.
- La validación biométrica es un flujo simulado mediante revisión manual del asesor.
- La plataforma no otorga créditos reales ni capta recursos reales del público.
