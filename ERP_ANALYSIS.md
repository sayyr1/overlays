# Análisis del sistema

## 1. Resumen ejecutivo

La aplicación es un monolito web de comercio electrónico con backoffice administrativo. Combina:

- Tienda pública con catálogo, filtros, detalle de producto, carrito y generación de pedidos.
- Panel administrativo para productos, inventario, categorías, menú de navegación, pedidos y métricas.
- Gestión de precios por nivel de cliente (`STANDARD`, `GOLD`, `PREMIUM`, `PLATINUM`).
- Flujo de pedido manual basado en transferencia/depósito y confirmación operativa por parte del administrador.

### Qué hace actualmente

- Publica productos con imágenes, tallas, colores, stock y precios por membresía.
- Permite a visitantes o usuarios autenticados generar pedidos.
- Reserva stock por 24 horas al crear un pedido.
- Permite a un administrador confirmar pago, cancelar pedidos y mover estados logísticos.
- Muestra un dashboard simple con ventas, top productos y clientes.

### Qué negocio parece gestionar

Parece una tienda minorista de moda/calzado/accesorios con venta directa al consumidor, catálogo por colección/género/tipo y operación manual de cobranza.

### Qué usuarios parecen usarla

- Visitante: navega catálogo, agrega al carrito y genera pedido.
- Cliente registrado: además puede ver sus pedidos y recibir precios por membresía.
- Administrador: opera productos, inventario, pedidos, categorías, menú y dashboard.

### Flujo principal de la app

1. Cliente navega catálogo.
2. Agrega productos al carrito.
3. Genera pedido con datos de contacto.
4. El sistema reserva stock por 24 horas.
5. Cliente deposita y envía comprobante por WhatsApp.
6. Administrador confirma pago.
7. Administrador avanza estados: `PAGADO -> EN_PREPARACION -> ENVIADO -> ENTREGADO`.

## 2. Clasificación: ERP, CRM o sistema administrativo

### Evaluación ERP

Tiene rasgos parciales de ERP:

- Inventario básico por talla/color.
- Pedidos.
- Ventas simples.
- Dashboard interno.
- Gestión de usuarios/clientes con membresía.

No tiene rasgos clave de ERP completo:

- Compras.
- Proveedores.
- Facturación fiscal.
- Cuentas por cobrar/pagar.
- Caja y bancos.
- Contabilidad.
- Auditoría.
- Multiempresa.
- Multialmacén.
- Costos.
- Kardex/movimientos de inventario.
- Integración formal entre módulos administrativos.

### Evaluación CRM

Tiene muy poco de CRM:

- Lista de usuarios/clientes.
- Membresías.

No tiene:

- Prospectos.
- Pipeline comercial.
- Seguimiento de oportunidades.
- Historial de contacto.
- Campañas.
- Cotizaciones.

### Evaluación sistema administrativo

Sí encaja como sistema administrativo comercial:

- Catálogo.
- Inventario simple.
- Pedidos.
- Operación manual de ventas.
- Configuración funcional de categorías y menú.

### Evaluación dashboard

Tiene dashboard, pero no es solamente dashboard porque sí ejecuta operación real sobre inventario y pedidos.

### Conclusión clara

**Esta app actualmente parece ser: un sistema administrativo comercial híbrido con e-commerce operativo y rasgos parciales de ERP.**

No parece CRM. Tampoco parece ERP real todavía, porque le faltan módulos troncales de finanzas, compras, proveedores, facturación, auditoría y una capa de procesos más integrada.

## 3. Módulos actuales detectados

| Módulo encontrado | Archivos o rutas relacionadas | Función actual | Madurez | Problemas detectados | Mejoras recomendadas |
| --- | --- | --- | --- | --- | --- |
| Autenticación y sesión | `backend/routes/users.js`, `backend/middleware/authMiddleware.js`, `backend/frontend/src/context/AuthContext.js` | Login, registro, logout, verificación de token, rol admin básico | Media | Sin rate limiting, sin recuperación de contraseña, sin permisos granulares, sin CSRF, rutas UI mal protegidas | Permisos por rol/acción, refresh/session strategy, rate limit, recuperación de cuenta, CSRF |
| Usuarios / clientes | `backend/models/User.js`, `backend/frontend/src/pages/admin/AdminDashboard.js` | Usuarios con nombre, email, contraseña, membresía y flag admin | Baja | No hay perfil comercial, direcciones persistentes, historial de cliente ni segmentación real | Modelo de cliente, direcciones, historial de compras, notas internas, estado comercial |
| Catálogo de productos | `backend/models/Product.js`, `backend/routes/products.js`, `backend/frontend/src/pages/admin/CreateProductPage.js`, `EditProductPage.js`, `ProductListPage.js` | CRUD de productos, imágenes, atributos, precios diferenciados | Media | CRUD sin protección backend, validación débil, lógica excesiva en una sola ruta | Proteger APIs, validar payloads, separar servicio de productos, versionar cambios |
| Inventario | `Product.stockBySize`, `stockByColorSize`, `reservedBy*`, `soldBy*`, `backend/frontend/src/pages/usuario/ProductPage.js` | Stock por variante, reserva, venta y confirmación manual | Media | No hay kardex, no hay transacciones, riesgo de race conditions, duplicación de datos agregados | Movimientos de inventario, transacciones Mongo, ajuste manual auditado, multi-bodega |
| Carrito | `backend/models/Cart.js`, `backend/controllers/cartController.js`, `backend/frontend/src/context/CartContext.js` | Carrito persistente para usuarios y localStorage para invitados | Media | Invitado no tiene seguimiento posterior real, validaciones parciales | Unificar checkout invitado/registrado, persistencia temporal de invitado, validación de stock al actualizar |
| Pedidos | `backend/models/Order.js`, `backend/controllers/orderController.js`, `backend/routes/orders.js`, `backend/frontend/src/pages/admin/PedidosPage.js`, `OrdersPage.js` | Creación de pedidos, reserva, confirmación, cancelación y estados | Media | Flujo manual, sin pagos reales, sin evidencia documental, sin facturación, sin SLA | Adjuntos de comprobante, pagos, envíos, notas internas, reglas de negocio y auditoría |
| Ventas / reportes | `backend/routes/products.js` (`summary/sales`, `analytics/overview`, `reset-sales`), `ResumenVentasPage.js`, `AdminDashboard.js` | Resumen de ventas y métricas simples | Baja | Reportes salen del producto agregado y no de una tabla financiera; se pueden resetear; sin cierres | Reportes basados en pedidos/pagos, cierres, exportación, KPIs confiables |
| Categorías / taxonomía | `backend/models/Category.js`, `backend/routes/categories.js`, `CategoryManagerPage.js` | Claves dinámicas y valores para filtros | Media | Modelo singleton poco normalizado, endpoints sin protección, acoplamiento con UI | Normalizar catálogo maestro, proteger gestión, validar dependencias antes de borrar |
| Navegación / menú | `backend/models/NavigationMenu.js`, `backend/routes/navigation.js`, `MenuBuilderPage.js` | Configuración del menú principal y mega menú | Media | Es útil para storefront, pero no es parte ERP; complejidad UI alta | Mantenerlo como CMS ligero separado del dominio operativo |
| Marcas | `backend/models/Brand.js`, `backend/routes/brands.js` | CRUD simple de marcas | Baja | Poco uso real, duplicado con `Product.brand`, sin protección | Unificar contra catálogo maestro o eliminar redundancia |
| Dashboard administrativo | `backend/frontend/src/pages/admin/AdminDashboard.js` | KPIs, top productos, usuarios, pedidos recientes | Media | KPIs limitados, base de cálculo débil, sin filtros temporales robustos | Dashboard por ventas confirmadas, clientes, stock crítico, rentabilidad |
| Tienda pública / UX comercial | `backend/frontend/src/components/usuario/*`, `ProductIndividual.js`, `NavbarTop.js` | Navegación pública, detalle, filtros, home | Media | UX inconsistente entre pantallas, mensajes/manualidades, dependencias viejas | Consistencia visual, feedback de errores, estados vacíos/carga, accesibilidad |

## 4. Mapa de rutas y pantallas

### Frontend

| Ruta | Acceso esperado | Pantalla | Observaciones |
| --- | --- | --- | --- |
| `/` | Público | Home | Storefront principal |
| `/productos` | Público | Listado de productos | Filtros por querystring |
| `/product/:id` | Público | Detalle público de producto | Puede agregar al carrito |
| `/cart` | Público | Carrito / checkout manual | Checkout por depósito/WhatsApp |
| `/mis-pedidos` | Usuario autenticado | Seguimiento de pedidos | Invitados no pueden revisar luego |
| `/dashboard` | Debería ser admin | Inventario / operaciones | Actualmente solo usa `ProtectedRoute`, no `AdminRoute` |
| `/admin-dashboard` | Admin | Dashboard | Correctamente protegido en frontend |
| `/crear-producto` | Admin | Alta de producto | Frontend protegido; backend no |
| `/editar-producto/:id` | Admin | Edición de producto | Frontend protegido; backend no |
| `/gestionar-categorias` | Admin | Gestión de categorías | Frontend protegido; backend no |
| `/menu-builder` | Admin | Constructor de menú | PUT protegido en backend |
| `/pedidos` | Admin | Gestión de pedidos | Flujo operativo principal |
| `/ventas/resumen` | Admin | Resumen de ventas | Backend no protegido |
| `/login` | Público | Login | Simple |
| `/register` | Público | Registro | Simple |

### Observaciones clave de rutas

- El panel `/dashboard` expone operación administrativa a cualquier usuario autenticado.
- Hay mezcla semántica entre rutas públicas y administrativas.
- El nombre de algunos archivos no coincide con su responsabilidad, por ejemplo `pages/admin/CategoriesPage.js` se usa como ruta pública.

## 5. Mapa de APIs

| Método y ruta | Propósito | Auth actual | Riesgo / nota |
| --- | --- | --- | --- |
| `POST /api/users/register` | Registro | Pública | Sin controles anti abuso |
| `POST /api/users/login` | Login | Pública | Sin rate limit |
| `POST /api/users/logout` | Logout | Pública con cookie | Aceptable |
| `GET /api/users/verify-token` | Sesión actual | Token/cookie | Aceptable |
| `GET /api/users` | Lista usuarios | Admin | Correcto |
| `PUT /api/users/:id/membership` | Cambiar membresía | Admin | Correcto |
| `GET /api/products` | Catálogo completo | Público | Correcto |
| `GET /api/products/:id` | Detalle producto | Público | Correcto |
| `POST /api/products` | Crear producto | **Público** | Crítico |
| `PUT /api/products/:id` | Editar producto | **Público** | Crítico |
| `DELETE /api/products/:id` | Eliminar producto | **Público** | Crítico |
| `POST /api/products/upload-image` | Subir imágenes | **Público** | Crítico |
| `POST /api/products/order/:id` | Reservar stock desde producto | **Público** | Crítico; duplica dominio de pedidos |
| `POST /api/products/sell/:id` | Registrar venta directa | **Público** | Crítico |
| `POST /api/products/confirm/:id` | Confirmar venta/reserva | **Público** | Crítico |
| `GET /api/products/summary/sales` | Reporte ventas | **Público** | Crítico |
| `POST /api/products/reset-sales` | Reiniciar historial ventas | **Público** | Crítico |
| `GET /api/products/analytics/overview` | Métricas | **Público** | Exposición interna |
| `GET /api/categories` | Categorías | Público | Aceptable |
| `POST /api/categories` | Crear valor categoría | **Público** | Crítico operativo |
| `DELETE /api/categories` | Borrar valor categoría | **Público** | Crítico operativo |
| `POST /api/categories/key` | Crear clave dinámica | **Público** | Crítico operativo |
| `DELETE /api/categories/key` | Borrar clave dinámica | **Público** | Crítico operativo |
| `GET /api/brands` | Marcas | Público | Aceptable |
| `POST /api/brands` | Crear marca | **Público** | Crítico operativo |
| `DELETE /api/brands/:id` | Borrar marca | **Público** | Crítico operativo |
| `GET /api/navigation` | Menú público | Público | Aceptable |
| `PUT /api/navigation` | Editar menú | Admin | Correcto |
| `GET /api/cart` | Ver carrito usuario | Usuario | Correcto |
| `POST /api/cart/add` | Agregar a carrito | Usuario | Correcto |
| `PATCH /api/cart/item/:productId` | Editar ítem carrito | Usuario | Correcto |
| `DELETE /api/cart/item/:productId` | Quitar ítem | Usuario | Correcto |
| `DELETE /api/cart` | Vaciar carrito | Usuario | Correcto |
| `POST /api/cart/merge` | Merge carrito invitado | Usuario | Correcto |
| `POST /api/orders` | Crear pedido | Pública opcional | Funcional, pero invitado no tiene seguimiento persistente |
| `GET /api/orders` | Listar pedidos | Admin | Correcto |
| `GET /api/orders/mine` | Mis pedidos | Usuario | Correcto |
| `POST /api/orders/:id/confirm` | Confirmar pago | Admin | Correcto |
| `POST /api/orders/:id/cancel` | Cancelar pedido | Admin | Correcto |
| `PATCH /api/orders/:id/status` | Avanzar estado | Admin | Correcto |
| `DELETE /api/orders` | Borrar historial | Admin | Peligroso pero protegido |

## 6. Modelos de datos detectados

### Modelos existentes

- `User`
- `Product`
- `Order`
- `Cart`
- `Category`
- `Brand`
- `NavigationMenu`
- `Counter`

### Entidades principales

| Entidad | Campos clave detectados | Comentario |
| --- | --- | --- |
| `User` | `name`, `email`, `password`, `isAdmin`, `membershipLevel` | Muy básico para cliente/admin |
| `Product` | `name`, `code`, `price`, `brand`, `type`, `collection`, `gender`, `attributes`, `colors`, stocks y reservas | Núcleo del sistema |
| `Order` | `orderNumber`, `user`, `items`, `subtotal`, `total`, `status`, `contact*`, `expiresAt`, `paymentReference`, `statusHistory` | El pedido está mejor modelado que el resto |
| `Cart` | `user`, `items` | Solo para usuarios autenticados |
| `Category` | `valuesByKey` | Documento singleton de taxonomía |
| `Brand` | `name` | Poco integrado |
| `NavigationMenu` | `rows`, `items`, `settings`, `megaMenu` | Configuración de storefront |
| `Counter` | `name`, `seq` | Correlativo de pedidos |

### Relaciones detectadas

- `Order.user -> User`
- `Order.items.product -> Product`
- `Cart.user -> User`
- `Cart.items.product -> Product`
- `Order.confirmedBy / cancelledBy -> User`

### Problemas de estructura

- Inventario y ventas se guardan agregado dentro de `Product`, lo que complica trazabilidad.
- Se duplica información entre `Order` y `Product.soldBy*` / `reservedBy*`.
- `Category` como singleton con `Map<string, string[]>` escala mal para reglas más complejas.
- `Brand` existe como colección, pero el producto guarda marca como string sin referencia.
- No hay entidades de `Supplier`, `PurchaseOrder`, `InventoryMovement`, `Payment`, `Invoice`, `Company`, `Role`, `Permission`, `AuditLog`, `Warehouse`.

### Datos faltantes para que sea un ERP real

- Proveedores.
- Compras y recepciones.
- Movimientos de inventario auditables.
- Documentos fiscales.
- Pagos y conciliación.
- Caja/bancos.
- Gastos.
- Configuración de empresa/impuestos.
- Roles y permisos granulares.
- Auditoría de acciones.
- Multi sucursal / bodega.

## 7. Problemas técnicos

### Arquitectura

- Monolito Express + React CRA embebido en `backend/frontend`.
- Hay separación física entre frontend y backend, pero muy acoplada al despliegue.
- `backend/routes/products.js` concentra demasiada lógica de dominio, inventario, reportes y uploads.

### Organización y mantenibilidad

- Mezcla de responsabilidades: rutas hacen validación, transformación, negocio y reporting.
- Hay archivos auxiliares sensibles fuera del flujo normal, por ejemplo `backend/fixMaps.js`.
- Existen artefactos de build y blobs en el repositorio de trabajo (`backend/frontend/build`, `backend/uploads`).
- `App.test.js` sigue siendo el test por defecto de CRA y no cubre el sistema real.

### Calidad de código

- Manejo de errores inconsistente.
- Uso intensivo de `window.alert`, `window.prompt` y `window.confirm` en lugar de componentes UX.
- Errores de codificación de caracteres en varios archivos.
- Mensajes y nombres inconsistentes (`filtrar` y `filter`, `Banco Pichicha` vs `Banco Pichincha`).
- Búsqueda UI menciona `SKU`, pero el modelo `Product` no tiene `sku`.

### Variables de entorno y configuración

Variables detectadas:

- Backend: `PORT`, `MONGO_URI`, `JWT_SECRET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- Frontend: `REACT_APP_API_URL`
- Consumidas en UI pero no definidas en `.env` revisada: `REACT_APP_BANK_NAME`, `REACT_APP_BANK_ACCOUNT`, `REACT_APP_BANK_OWNER`, `REACT_APP_BANK_ID`, `REACT_APP_DEPOSIT_PHONE`

Problemas:

- Hay archivos `.env` presentes en el proyecto con valores reales, lo cual es una mala práctica de seguridad.
- `.gitignore` no está alineado con la estructura real (`backend/frontend/.env` no coincide con `frontend/.env`).
- `backend/fixMaps.js` contiene una conexión hardcodeada fuera de variables de entorno.

### Producción y despliegue

- El backend sirve el build estático del frontend, útil para Render/Railway, pero poco natural para Vercel.
- `BrowserRouter` depende de fallback del servidor; en hosting estático puro fallaría sin reescrituras.
- Scripts de build no son portables:
  - Backend usa `Copy-Item` de PowerShell.
  - Frontend usa `cp`, típico de Unix.
- No hay `vercel.json`, Dockerfile, CI, healthcheck ni estrategia de observabilidad.

## 8. Problemas funcionales

- No existe módulo de proveedores/compras.
- No existe facturación ni pagos reales.
- El cliente invitado puede comprar, pero luego no tiene una vista persistente de seguimiento.
- El resumen de ventas no sale del flujo de pedidos como fuente única, sino de contadores en producto.
- No hay gestión de devoluciones, reembolsos, notas de crédito ni incidencias.
- No hay auditoría de cambios de stock, precios o pedidos.
- No hay configuración de empresa, impuestos o moneda.
- La “membresía” funciona solo como precio diferenciado; no hay CRM real detrás.

## 9. Problemas de seguridad

### Hallazgos críticos

1. **Endpoints administrativos sin protección backend**
   - Productos, uploads, ventas, reportes, categorías y marcas tienen rutas mutables públicas.
   - Esto permite alterar inventario, catálogo y reportes sin ser administrador.

2. **Pantalla administrativa accesible a cualquier usuario autenticado**
   - La ruta `/dashboard` usa `ProtectedRoute` y no `AdminRoute`.
   - Un usuario normal puede entrar al panel de inventario desde URL directa.

3. **Exposición de secretos**
   - Hay `.env` con valores reales en el proyecto.
   - Hay un script con URI de MongoDB hardcodeada.

4. **Sin defensa contra abuso**
   - No hay rate limit ni lockout para login/registro.
   - No hay control de intentos fallidos.

5. **Carga de archivos débil**
   - `multer` no configura tamaño máximo.
   - El endpoint de upload es público.

### Riesgos importantes

- Sin CSRF pese a uso de cookies.
- Sin validación robusta de payloads en backend.
- Sin transacciones para reservas/ventas; riesgo de sobreventa por concurrencia.
- Dependencias vulnerables detectadas por `npm audit`.

### Dependencias con alertas relevantes

#### Backend

`npm audit` reporta:

- 10 vulnerabilidades totales.
- 8 altas.
- 2 moderadas.

Paquetes relevantes:

- `cloudinary`
- `express`
- `mongoose`
- `multer`

#### Frontend

`npm audit` reporta:

- 55 vulnerabilidades totales.
- 2 críticas.
- 25 altas.
- 16 moderadas.
- 12 bajas.

Paquetes relevantes:

- `swiper`
- `axios`
- `react-scripts`
- `react-router-dom`

## 10. Problemas de UX/UI

### Lo que está bien

- Hay intención clara de diferenciar storefront y panel admin.
- El dashboard y el módulo de pedidos ya muestran una UX más madura que el resto.
- El detalle de producto maneja variantes, imágenes y zoom razonablemente bien.

### Problemas detectados

- Flujos administrativos dependen de `alert/prompt/confirm`, poco profesionales y poco escalables.
- `ProtectedRoute` y `AdminRoute` devuelven `null` mientras cargan; el usuario ve pantalla vacía.
- Inconsistencia de diseño entre pantallas nuevas y pantallas antiguas.
- Mensajes de error poco accionables.
- Configuración bancaria inconsistente entre carrito y mis pedidos.
- Algunas pantallas tienen textos rotos por encoding.
- No hay paginación, filtros administrativos robustos, ni exportaciones.
- No hay feedback visual uniforme para operaciones exitosas/fallidas.

## 11. Qué falta para convertirlo en ERP real

### Indispensable

- Clientes con perfil completo.
- Proveedores.
- Compras.
- Recepción de mercadería.
- Movimientos de inventario / kardex.
- Ventas como documento formal.
- Pagos.
- Caja / bancos.
- Facturación.
- Roles y permisos granulares.
- Auditoría de acciones.
- Reportes operativos y financieros confiables.

### Puede esperar

- Notificaciones automáticas.
- Integraciones externas.
- Exportación PDF/Excel.
- CRM básico.
- Automatizaciones de remarketing.
- Multiempresa / multibodega avanzada.

## 12. Roadmap recomendado por fases

### Fase 1: correcciones críticas

- Cerrar todas las APIs administrativas con `protect + adminOnly`.
- Cambiar `/dashboard` a `AdminRoute`.
- Sacar secretos de repositorio y rotarlos.
- Eliminar conexión hardcodeada de scripts auxiliares.
- Agregar validación backend con esquema formal.
- Agregar rate limit a login, registro y endpoints sensibles.
- Definir límites de upload y validación MIME/tamaño.
- Actualizar dependencias críticas.
- Unificar `.gitignore` con la estructura real.

### Fase 2: mejoras funcionales

- Separar catálogo, inventario, pedidos y reportes en servicios claros.
- Reemplazar `alert/prompt/confirm` por modales/toasts.
- Agregar adjunto de comprobantes y evidencia de pago.
- Mejorar perfil de cliente y direcciones.
- Normalizar marcas/categorías.
- Implementar historial real de cambios de stock.
- Mejorar reportes de pedidos, ventas y stock crítico.

### Fase 3: ERP real

- Módulo de proveedores y compras.
- Recepción y ajustes de inventario con auditoría.
- Caja/bancos y conciliación.
- Facturación y documentos.
- Reportes financieros.
- Permisos por módulo/acción.
- Exportaciones.
- Automatizaciones operativas.
- Preparación para escalabilidad y observabilidad.

## 13. Lista priorizada de tareas para implementar

### Prioridad P0

1. Proteger `POST/PUT/DELETE` de productos, categorías, marcas, uploads, ventas y reportes.
2. Proteger `/dashboard` con `AdminRoute`.
3. Retirar secretos del repo, rotar credenciales y reconfigurar por entorno.
4. Eliminar `fixMaps.js` o moverlo a script seguro sin credenciales embebidas.
5. Actualizar dependencias críticas (`swiper`, `axios`, `cloudinary`, `multer`, `mongoose`, `express`).

### Prioridad P1

1. Introducir validación backend de payloads y sanitización.
2. Crear capa de servicios para inventario y pedidos.
3. Agregar transacciones/sesiones Mongo para reserva, confirmación y cancelación.
4. Rehacer reportes para que salgan de pedidos/pagos y no de contadores en producto.
5. Implementar auditoría mínima de stock, pedidos y cambios de precio.

### Prioridad P2

1. Rediseñar UX administrativa de acciones críticas.
2. Crear perfil de cliente más completo.
3. Agregar gestión de comprobantes y estados operativos más ricos.
4. Normalizar catálogos maestros (`Brand`, `Category`, atributos).
5. Agregar exportación CSV/Excel/PDF.

### Prioridad P3

1. Implementar compras y proveedores.
2. Implementar caja, pagos y conciliación.
3. Implementar facturación.
4. Evaluar separación real frontend/backend y estrategia de despliegue moderna.

## 14. Recomendaciones finales

- No lo presentaría hoy como ERP completo.
- Sí puede presentarse como **plataforma de e-commerce con backoffice operativo** o **sistema administrativo comercial para tienda minorista**.
- El mayor riesgo actual no es funcional sino de seguridad y gobierno del sistema.
- Antes de agregar módulos nuevos, conviene cerrar accesos, limpiar secretos, endurecer validaciones y redefinir el modelo de inventario/reportes.
- Si el objetivo es evolucionarlo a ERP, la siguiente frontera natural no es “más dashboard”, sino:
  - inventario auditable,
  - compras/proveedores,
  - pagos/facturación,
  - permisos,
  - reporting confiable.
