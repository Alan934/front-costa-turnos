# Cambios backend

## Ventana máxima de reserva por membresía (`maxBookingDays`)

El profesional puede limitar **cuántos días hacia el futuro** se le pueden sacar
turnos en un comercio (p.ej. 7 = una semana, 30 = un mes). `0` = sin límite.
Es el complemento de `minBookingHours` (anticipación mínima).

### Modelo

- `membership.max_booking_days` (int, default `0`). Migración
  `1738500000000-membership-max-booking-days`.

### API

- `PATCH /comercios/:comercioId/membership` (`UpdateMembershipDto`) acepta el
  nuevo campo opcional `maxBookingDays` (int, `0`–`730`). Se devuelve en la
  membresía y se serializa en el resto de respuestas que la incluyen.

### Enforcement

- **Reserva** (`book` y reserva con seña): si el turno empieza a más de
  `maxBookingDays` días de "ahora" → `400 "El turno no puede reservarse con más
  de N días de anticipación"`.
- **Reprogramación** (`/me`): misma validación → `400 "El turno no puede
  reprogramarse con más de N días de anticipación"`.
- **Disponibilidad** (slots y resumen por día): los slots cuyo inicio cae más
  allá de la ventana ya no se devuelven como libres.

## Descansos (`break`) dirigidos a servicios

Hasta ahora una regla `kind: break` bloqueaba el rango horario para **todos** los
servicios. Ahora el front permite, igual que en las franjas de trabajo, elegir a
qué servicios afecta el descanso.

### API

- `POST`/`PATCH /comercios/:comercioId/availability/schedule` ya aceptan
  `serviceIds` (DTO compartido). El front ahora lo envía también para reglas
  `break`:
  - `serviceIds` vacío/omitido = **descanso total** (bloquea todos los servicios).
  - `serviceIds` con ids = **descanso parcial** (bloquea solo esos servicios; el
    resto sigue reservable en ese rango).

### Enforcement (disponibilidad / slots)

- Al calcular los slots libres de un día, un `break` con `serviceIds` debe
  descartar el rango **solo para los servicios listados**. Para los demás
  servicios ese rango sigue disponible (si lo cubre una franja `work`).
- Un `break` sin `serviceIds` mantiene el comportamiento actual: bloquea el rango
  para cualquier servicio.

## Flujo de invitación a comercio (landing inteligente)

Cuando un comercio invita a un profesional por email, el front ahora usa una landing
(`/comercios/invitacion?token=...`) que, antes de pedir login, **decide solo** si el
profesional debe registrarse o ingresar, según si su email ya tiene cuenta. Para eso
el front necesita lo siguiente del backend.

### A. Endpoint público de preview de la invitación — **NUEVO**

`GET /comercios/invitations/preview?token=...` (sin auth):

- Valida el token. Token inexistente / expirado / cancelado → `404` o `410`.
- Devuelve **solo** lo necesario para renderizar la landing (no exponer datos
  sensibles del comercio ni del usuario):

  ```json
  {
    "comercioName": "Studio 34",
    "email": "pro@email.com",
    "status": "pending",
    "expiresAt": "2026-06-30T12:00:00.000Z",
    "accountExists": true,
    "isProfessional": false
  }
  ```

  - `accountExists`: si ya existe una cuenta (`account`/`user`) con ese email →
    el front guía a **ingresar**; si `false` → guía a **registrarse como
    profesional**. En ambos casos pre-carga el email invitado.
  - `isProfessional`: si esa cuenta ya tiene perfil de profesional (informativo;
    útil para mensajes futuros).

> El front trata el preview como **enriquecimiento**, no como filtro de validez:
> si el endpoint falla o aún no está desplegado, degrada a ofrecer ambas opciones
> (ingresar / registrarse). El filtro real de validez sigue siendo `accept`.

### B. Link del email de invitación

El botón del correo debe apuntar a `{FRONTEND_URL}/comercios/invitacion?token=...`
(la landing), **no** a `/ingresar`. Si hoy apunta al login, cambiarlo.

### C. Aceptación de la invitación (`POST /comercios/invitations/accept`)

- Debe funcionar para un profesional **recién registrado** con el email invitado
  (cuenta + profesional creados por el alta self-service `register-professional`).
- Validar que el email de la cuenta autenticada coincide con el email de la
  invitación; si no coincide → `409`/`403` con mensaje claro. El front ya
  contempla este caso: muestra un aviso ("la invitación es para X") y ofrece
  cerrar sesión para entrar con la cuenta correcta.
- Idempotente / tolerante si ya está aceptada. Sin cambios en el contrato de
  respuesta: el front solo necesita éxito/422 claros.
