# Reporta Ya — Backend

API for **Reporta Ya**, a territorial incident platform. Citizens report problems on roads and the environment (rocks, landslides, blocked traffic, river pollution, dust, waste). Operators resolve those cases, and supervisors configure how the territory works.

This service is the source of truth for the business rules. The mobile app and the admin panel only present them.

## What the platform does

A report is a geolocated incident: category, priority, status, coordinates, optional zone, photo, voice note, and extra fields defined by the territory. Anyone can file one. Logged-in citizens also earn points and later confirm whether the fix actually worked.

Data is isolated by **territory**. Every request runs inside a tenant context taken from the `x-territorio-id` header, then the JWT, then the default territory.

## Roles

| Role | Who they are | What they can do |
| --- | --- | --- |
| **REPORTANTE** | Citizen | Create reports, see their own cases, confirm or reject a solution, appear on the ranking. |
| **RESPONSABLE** | Field operator | Move cases through the workflow, attach resolution evidence, publish announcements, read analytics. |
| **SUPERVISOR** | Administrator | Everything an operator can do, plus catalog, form fields, roles, system settings, and audit. |

Permissions are stored in the database (`can_view_reports`, `can_create_reports`, `can_edit_reports`, `can_manage_users`, `can_manage_config`) and assigned to roles. Guests (no token) can still create and list reports; they do not earn points and are not attached as the reporter.

## Report lifecycle

1. The case is created in **Pendiente** unless a status is sent explicitly.
2. A photo and an optional voice note can be attached. Voice is transcribed and stored as text.
3. If the citizen or the operator later changes the category the classifier suggested, that correction is saved so future suggestions improve.
4. An operator (**RESPONSABLE** or **SUPERVISOR**) of the same territory moves the status. Some statuses require a resolution photo before they can be applied.
5. Marking the case **Solucionado** (or any final status) clears citizen confirmation and asks the reporter to validate the fix.
6. If the citizen **confirms**, the case stays closed and they receive validation points.
7. If the citizen **rejects**, the case returns to **Pendiente** and the history records a citizen reopening.

Default statuses: Pendiente → En Proceso → Solucionado, plus Reabierto. Statuses, colors, order, and whether a photo is required are configurable.

Open cases older than the SLA limit (default **48 hours**, key `SLA_HORAS_LIMITE`) are flagged as breached. Operators and supervisors with a push token are notified once. The check runs every 15 minutes and can also be triggered manually.

## Critical events

When a new report arrives, the API counts other **open** reports in the same **zone** and **category** inside a time window.

- Minimum count: `EVENTO_CRITICO_MIN_REPORTES` (default 2, not counting the new report).
- Window: `EVENTO_CRITICO_VENTANA_HORAS` (default 48).

If the threshold is met, the new report is forced to priority **Urgente**, the history is marked as a critical event, and operators receive a push plus an instant-message alert. A non-critical report whose priority level is 3 or higher still raises an urgent alert.

## Territorial risk index

Each open report gets a risk score used to order the operator queue:

```
risk = (priority level × PESO_GRAVEDAD) + (open similar cases in 7 days × PESO_FRECUENCIA)
```

Defaults are **0.6** for severity and **0.4** for frequency, so a single severe incident outranks a pile of minor repeats. “Similar” means the same zone and category, still not in a final status. The prioritized list returns the highest scores first.

## Citizen points

Only users with role **REPORTANTE** earn points.

| Action | Config key | Default |
| --- | --- | --- |
| Creating a report | `PUNTOS_CREAR_REPORTE` | 5 |
| Confirming that a solution worked | `PUNTOS_VALIDAR_SOLUCION` | 15 |

The ranking sums those points. A score of 0 disables that reward.

## Classification

Category and priority can be suggested from free text before the report is saved.

1. Match keywords taken from the active category catalog.
2. If AI is enabled (`IA_CLASIFICACION_ENABLED`) and the text is long enough, ask the language model, including recent human corrections.
3. If the model is off, times out, or fails, keep the keyword match or the first active category.

Agreement between keywords and the model raises confidence. A citizen who picks a different category than the one suggested, or an operator who recategorizes a case, writes a correction used on later calls.

## Announcements

Operators (**RESPONSABLE**) publish announcements: a message, optional zone, map point, radius in meters, and a restriction duration. Every user with a push token is notified. Supervisors can read announcements; publishing is limited to operators.

## What gets audited

Status changes are stored on the report history (who, from which status, to which status, comment). Sensitive actions (create report, change status, validate a solution, edit configuration) are also written to the action log.

## Configurable rules

Supervisors change these without a deploy. They live in system config and drive the behavior above:

- App name, slogan, primary color
- Risk weights (`PESO_GRAVEDAD`, `PESO_FRECUENCIA`)
- Critical-event threshold and window
- Point values
- SLA hours
- AI classification on/off
- Automatic message templates (new report, critical event, high priority, announcement, citizen validation, SLA breach)

Categories, extra form fields, statuses, and priorities are also data, scoped to a territory.

## Stack

NestJS, PostgreSQL, Prisma, JWT, push notifications, mail, and object storage for photos and audio.
