# Cambios del backend para el front — Turnerito

Documento de handoff para el agente del frontend. Resume **todo lo nuevo/cambiado** en el backend y qué debe implementar el front. El contrato OpenAPI ya está regenerado en `packages/contract/openapi.json` (90 operaciones) — **regenerá el cliente orval** a partir de él para tener los hooks nuevos.

---

## 0. Convenciones (importante) — **leer: resuelve la duda del /v1**

- **Base URL**: usar la **raíz** del backend, **sin** sufijo de versión → dev `http://localhost:3000`, prod la de Coolify. **NO** poner `/v1` en la base URL.
- **Versionado (RESUELTO en el contrato)**: el backend tiene versionado **mixto**:
  - La mayoría de las rutas se sirven bajo **`/v1`** (ej. `POST /v1/appointments`).
  - Pero hay rutas **version-neutral SIN `/v1`**: todo `/auth/*`, `/health`, `/r/{slug}/*` (página pública) y `/payments/mp/oauth/*`.
  - **El `openapi.json` ahora incluye el prefijo correcto en cada path** (unas con `/v1`, otras sin). Antes el spec salía sin `/v1` porque `@nestjs/swagger` no inyecta el prefijo de versión; ya está corregido (regenerá tu cliente).
  - ⚠️ Por eso **NO** sirve poner `NEXT_PUBLIC_API_URL=.../v1`: rompería el login y la página pública (que son neutrales). La forma correcta es **baseURL = raíz** y dejar que cada path del contrato traiga (o no) su `/v1`. Con eso el cliente orval queda 1:1 con el backend.
  - Verificación rápida: en el spec, `POST /v1/auth/login`/`/v1/appointments`... → en realidad es `/auth/login` (neutral) y `/v1/appointments` (v1). Si tu cliente quedó sin ningún `/v1`, **regenerá desde el `openapi.json` actualizado**.
- **Auth**: JWT Bearer en header `Authorization: Bearer <accessToken>`. El login devuelve `{ accessToken, refreshToken }`.
- **Enums**: viajan como uniones de strings (ej. `SubscriptionStatus = 'trial' | 'active' | ...`).
- **Multi-tenant**: el `professionalId` (tenant) se resuelve del token; el admin puede operar sobre un tenant con el header `x-professional-id`.

---

## 1. Suscripción, prueba gratis y bloqueo (NUEVO — lo más importante)

### Reglas de negocio
- Al **auto-registrarse** un profesional (registro + onboarding) arranca con **15 días de prueba gratis** (`trial`).
- Vencidos los 15 días sin pagar, hay **3 días de gracia** más. Pasada la gracia, se **bloquea la escritura**.
- **Bloqueo de escritura** = el profesional puede **ver** (GET) pero NO puede **crear/editar/borrar** (POST/PATCH/DELETE) turnos, servicios, clientes, horarios, sorteos, etc. Además **los clientes no pueden reservar** en su página pública.
- Se **libera** al pagar la suscripción (por MP el profesional, o el admin marcando efectivo).
- El **platform admin** nunca se bloquea.

### Qué ve el front
- Cuando la suscripción está vencida y el profesional intenta una acción de escritura, el backend responde **`403 Forbidden`** con:
  ```json
  { "statusCode": 403, "error": "Forbidden",
    "message": "Tu periodo de prueba o suscripcion vencio. Aboná la suscripcion para seguir usando el sistema." }
  ```
- En la **página pública** (`/r/:slug`), si el profesional está vencido, reservar devuelve `403` con `"Esta agenda no esta disponible en este momento."`.

### Endpoints
| Método | Ruta | Hook orval | Para qué |
|---|---|---|---|
| GET | `/v1/subscription` | `useGetMine` | Estado de mi suscripción |
| GET | `/v1/subscription/payments` | `usePayments` | Historial de pagos de suscripción |
| POST | `/v1/subscription/checkout` | `useCheckout` | Iniciar pago de la suscripción por MercadoPago → devuelve `{ initPoint }` |

### El objeto `Subscription` (campos clave)
- `status`: `'trial' | 'active' | 'past_due' | 'grace' | 'blocked' | 'cancelled'`
- `trialEndsAt`, `currentPeriodStart`, `currentPeriodEnd`, `graceEndsAt` (fechas ISO)
- `amountCents` (precio mensual en centavos)

### Tareas del front
1. **Banner/estado de suscripción**: mostrar días restantes de prueba / gracia, y avisos según `status` y `currentPeriodEnd`/`graceEndsAt`.
2. **Pantalla "Pagar suscripción"**: botón que llama `POST /v1/subscription/checkout` y redirige a `initPoint` (checkout de MercadoPago). Al volver, MP redirige al front (ver §6).
3. **Manejo global del `403` de suscripción**: interceptar esa respuesta y mostrar un modal/CTA "Tu prueba venció, aboná para seguir" en vez de un error genérico. (Distinguir del 403 de permisos por el `message`.)

---

## 2. Cobro de la suscripción en efectivo (solo ADMIN) — NUEVO

- El profesional que se auto-registra paga **sí o sí por MercadoPago**.
- **Solo el admin** puede registrar que un profesional pagó **en efectivo** ese mes → renueva 30 días.

| Método | Ruta | Hook | Para qué |
|---|---|---|---|
| GET | `/v1/admin/professionals` | `useListProfessionals` | Lista de profesionales con su suscripción `[{ professional, subscription }]` |
| POST | `/v1/admin/subscriptions/{professionalId}/mark-cash-paid` | `useMarkCashPaid` | Marca pago en efectivo → renueva 30 días |

- Requiere cuenta **platform admin**; un profesional normal recibe `403`.
- **Tarea del front**: en el **panel de admin**, listado de profesionales con estado de suscripción y botón "Registré pago en efectivo (este mes)".

---

## 3. Profesional conecta su MercadoPago (cobra señas/turnos) — NUEVO

- El profesional puede **conectar su cuenta de MercadoPago** para que las **señas/turnos** entren **a su cuenta**. Lo define él por servicio (`depositMode`).
- Conexión por **OAuth** ("Conectar con MercadoPago").

| Método | Ruta (sin /v1) | Hook | Para qué |
|---|---|---|---|
| GET | `/payments/mp/oauth/connect` | `useConnect` | Devuelve `{ url }` → redirigir al profesional a MP para autorizar |
| GET | `/payments/mp/oauth/status` | `useStatus` | `{ connected, mpUserId, connectedAt }` |
| DELETE | `/payments/mp/oauth` | `useDisconnect` | Desconectar la cuenta |

- El **callback** (`/payments/mp/oauth/callback`) lo maneja el backend y redirige al front a **`/ajustes/pagos?mp=connected`** (o `?mp=error`).
- **Tareas del front**:
  1. En **Ajustes → Pagos**: mostrar estado (`useStatus`) + botón "Conectar MercadoPago" (llama `connect` y hace `window.location = url`) + botón "Desconectar".
  2. Ruta **`/ajustes/pagos`** que lea el query `?mp=connected|error` para mostrar el resultado de la conexión.

### Cobro de la seña/turno
| Método | Ruta | Hook | Para qué |
|---|---|---|---|
| POST | `/v1/payments/{id}/mp-preference` | `useCreatePreference` | Crea la preferencia MP de un pago pendiente → `{ initPoint }`. Body opcional `{ payerEmail }` |
| POST | `/v1/payments/{id}/mark-paid` | `useMarkPaid` | Marca un pago **en efectivo** como cobrado |
| GET | `/v1/payments` | `useList` (payments) | Lista de pagos del tenant |

- Si el profesional **no conectó** MP, `mp-preference` devuelve `400` con `"El profesional no conecto su cuenta de MercadoPago..."`. El front debe guiarlo a conectarla.
- La reserva con seña ya existente (`POST /v1/appointments/with-deposit` y la pública `POST /r/:slug/book-with-deposit`) devuelve `{ appointment, payment }`. Para pagar online, luego se llama `mp-preference` con `payment.id` y se redirige a `initPoint`.

---

## 4. Login con Google — habilitado

- Flujo: el front manda al usuario a **`GET /auth/google`** (redirige a Google) → tras autorizar, el backend redirige al **front** con los tokens en el query:
  **`<FRONT_URL>/auth/callback?access_token=...&refresh_token=...`**
- **Tareas del front**:
  1. Botón "Iniciar sesión con Google" que apunte a `${API_URL}/auth/google`.
  2. Ruta **`/auth/callback`** que lea `access_token` y `refresh_token` del query, los guarde y redirija al dashboard.
- Config backend: la URL del front sale de **`FRONT_URL`** (`.env`). En Google Cloud Console debe estar autorizada la redirect URI `http://localhost:3000/auth/google/callback` (apunta al **backend**, que luego reenvía al front).

---

## 5. Subida de archivos — habilitada, con límites

- Endpoint: **`POST /v1/files`** (multipart `file`) con query **`ownerType`** y **`ownerId`** (requeridos). Hook `useUpload`.
- **Tipos permitidos**: imágenes **JPEG/PNG/WebP** y **PDF**. El tipo se valida por **contenido real** (no por extensión/Content-Type).
- **Límites**:
  - Imágenes: hasta **10 MB** de entrada; se **comprimen automáticamente** a WebP (máx 2000px, ~1.5 MB final). El front no necesita comprimir, pero conviene avisar al usuario del límite.
  - PDF: hasta **3 MB** (no se comprimen; si superan, se rechazan).
- **Errores**: tipo no permitido o archivo inválido → `400`; archivo demasiado grande → `413` (`"El archivo supera el tamaño máximo permitido"`).
- **Descargar/mostrar**: `GET /v1/files/{id}/url` (`useSignedUrl`) → `{ url }` firmada (válida ~15 min, **solo GET**). Usar esa URL como `src`. Borrar: `DELETE /v1/files/{id}`.
- **Tarea del front**: inputs de carga de fotos (ficha de cliente, logo, etc.) y de PDF, mostrando los límites y manejando `400/413`. Para ver imágenes, pedir la URL firmada (no cachear más de ~15 min).

---

## 6. Notificaciones por email — habilitadas

- El backend ahora **envía emails de verdad** (SMTP). Aplica a recordatorios, avisos de seña, lista de espera, cambios de suscripción, etc.
- **No requiere cambios** en el front salvo que quieras reflejar en la UI "te enviamos un email" donde corresponda (verificación de email, reset de contraseña, etc., que ya existían).

---

## 7. URLs de retorno (coordinar config front ↔ back)

MercadoPago y Google redirigen de vuelta al **front**. Hay **una sola variable** en el `.env` del backend:
- **`FRONT_URL`** (default `http://localhost:5173`): origen del front. La usan **ambos** callbacks:
  - Google → `<FRONT_URL>/auth/callback?access_token=...&refresh_token=...`
  - MercadoPago (conexión) → `<FRONT_URL>/ajustes/pagos?mp=connected|error`
- `MP_FRONT_RETURN_URL` (opcional): sólo si querés una URL distinta para el retorno de MP; si se deja vacío, usa `FRONT_URL`.

**Acción**: confirmá con el backend el puerto/origen real del front para setear **`FRONT_URL`** y **`CORS_ORIGINS`** (el backend usa `credentials: true`, así que CORS debe listar el origen exacto del front, no `*`).

---

## 8. Webhooks (NO son del front)

Los webhooks de MercadoPago (`/v1/payments/mp/webhook` y `/v1/subscription/mp/webhook`) los recibe **el backend** directamente desde MP. El front no los llama. Solo funcionan con **URL pública** (en local MP no llega a localhost; andarán en Coolify).

---

## Checklist de tareas para el front

- [ ] Regenerar cliente orval desde `openapi.json` (90 operaciones).
- [ ] Banner/estado de suscripción (días de prueba/gracia, status).
- [ ] Pantalla "Pagar suscripción" → `checkout` → redirect a `initPoint`.
- [ ] Interceptor global del `403` de suscripción → modal "aboná para seguir".
- [ ] Panel admin: lista de profesionales + botón "pago en efectivo".
- [ ] Ajustes → Pagos: conectar/desconectar MercadoPago + estado, ruta `/ajustes/pagos?mp=`.
- [ ] Flujo de cobro de seña: `mp-preference` → redirect a `initPoint`; manejar el `400` de "MP no conectado".
- [ ] Login con Google: botón → `/auth/google`; ruta `/auth/callback` que capture los tokens.
- [ ] Carga de archivos (imágenes ≤10MB, PDF ≤3MB) + mostrar imágenes vía URL firmada; manejar `400/413`.
- [ ] Confirmar con backend la URL de retorno del front (`FRONT_URL`) y `CORS_ORIGINS`.
