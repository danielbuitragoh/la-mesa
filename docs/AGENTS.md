# Contexto de trabajo — Dan y La Mesa

## Quién soy

- Daniel Buitrago (Dan), 18 años, vive en Madrid, España; vínculos con Medellín, Colombia, a través de sus proyectos.
- Estudiante de Ingeniería de Sistemas (UNIMINUTO, Rectoría Virtual), aprox. 5º cuatrimestre. Objetivo concreto: entrar como developer junior en enero de 2027. Evalúa una posible movilidad académica en 2027 (UFV o UPM), todavía en estudio, no decidida.
- Cursa actualmente Arquitectura de Software, Programación Avanzada, Física Mecánica y Constitución Política; tiene carga académica activa que compite por su tiempo, no asumas disponibilidad total.
- Experiencia laboral previa fuera de tecnología (camarero, recepcionista); no es su objetivo definitivo. Está construyendo su primera experiencia profesional en tecnología desde cero: no exageres ni des por hecho conocimientos o experiencia que no tiene.
- Construye en paralelo, además del código: GitHub, CV, LinkedIn, red de contactos. Si una tarea de código puede fortalecer su portafolio (buen README, commits limpios, caso de estudio), es parte del objetivo, no un extra.
- Dispone de 6-10 horas reales a la semana para proyectos técnicos propios. Prioriza lo que da mayor avance verificable en poco tiempo por encima de la solución más elegante en abstracto.
- Cómodo con: JavaScript/TypeScript, React, React Native (Expo), SQL, diseño de esquemas, APIs, Supabase.
- Poco cómodo con: Linux, redes, administración de sistemas. Si una tarea requiere pasos de sysadmin no triviales, explícalos paso a paso.
- Aún no ha llevado nada a producción con clientes de pago.
- También hace diseño gráfico en Canva con guía de marca propia: paleta azul marino #253754 / #3e487b, naranja #ff7c2a, crema #faf4eb; tipografías Bebas Neue, Tan Garland, Poppins. Úsala si alguna tarea toca material de marca personal suyo (no confundir con el design system de La Mesa, que es otro y está cerrado, ver abajo).

## Cómo quiere que trabajes con él

- Respuestas profesionales pero cercanas, con estructura clara.
- Quiere que lo cuestiones. Si ves un riesgo, una alternativa mejor, o que una petición suya contradice una regla de este documento, dilo antes de ejecutar; no le des la razón por defecto.
- Prefiere que aprenda a construir por su cuenta, no que dependa de ti: si algo tiene una explicación no obvia, dale el "por qué", no solo el "cómo". No le ocultes la parte técnica difícil detrás de una simplificación excesiva.
- No inventes contexto que no esté aquí o que él no te haya dado en la tarea actual. Si falta un dato, pregúntalo.
- Prefiere avance real y terminado por encima de perfección sin entregar.

## Proyecto activo: La Mesa (app de restaurante — demo de portafolio)

**Propósito**: mostrar sus habilidades a reclutadores. **No** es un producto comercial. No optimizar para escalar ni monetizar.

**Definición de hecho (el único criterio que importa)**: un desconocido abre una URL desde su móvil, entiende qué es en menos de dos minutos, completa un pedido, y ese pedido aparece en el panel de administración.

### Dentro de alcance

- Menú con datos reales desde Supabase.
- Login básico con usuario demo de credenciales visibles.
- Carrito y pedido hasta confirmación con pago **simulado** (no real).
- Panel admin: CRUD de menú + listado de pedidos con cambio de estado.
- Design system v1.0 aplicado tal cual (ver abajo, no se rediseña).
- Despliegue público de la app y el panel con URL accesible.
- README + caso de estudio.

### Fuera de alcance

No negociable; va al README como «trabajo futuro», nunca al código: pagos reales (Wompi, Nequi, PSE, Bancolombia), domicilio y mensajería externa, cupones/puntos/recompensas, notificaciones push, publicación en App Store o Play Store, pestaña «Momentos», rediseño de la pantalla de inicio.

### Reglas duras

1. El alcance no se amplía bajo ninguna circunstancia. Ideas nuevas van al README, nunca al código.
2. Si un hito se atrasa, se recorta alcance; nunca se amplía el plazo.
3. Una cosa a la vez. No abrir trabajo de un módulo nuevo si el actual no está cerrado.
4. Terminado y con defectos menores vale más que perfecto y sin desplegar.

### Hitos

- Semana 1 (hasta 11 ago): esquema Supabase con RLS + datos demo cargados; la app muestra el menú real desde la base.
- Semana 2 (hasta 18 ago): carrito y pedido hasta confirmación; panel admin mínimo funcionando.
- Semana 3 (hasta 25 ago): desplegado en público con usuario de prueba, README y caso de estudio, prueba del «desconocido» superada.

**Stack acordado**: Expo/React Native (app) · Supabase (backend y datos) · React + Vite (panel admin). Repo local en `C:\Users\USER\Documents\La Mesa`.

### Design system v1.0 — cerrado, no se toca sin permiso explícito

- Colores: naranja mandarina, amarillo mantequilla, marfil, carbón, teal.
- Tipografía: Canela (títulos), Montserrat (cuerpo).
- Sistema de espaciado: base 8px.
- Pendiente consciente para después: rediseño de la pantalla de inicio y función de la pestaña «Momentos»; no tocar ahora.

## Proyecto en paralelo: AI Investment & Engineering Lab

Este es su proyecto de largo plazo para construir patrimonio combinando ingeniería de sistemas e inversión (horizonte 2026-2031). No es un proyecto de código por ahora: es un marco de decisión. Si en algún momento surge de aquí una tarea de ingeniería concreta (una herramienta, un dashboard, una automatización), trátala como cualquier tarea de este documento; si lo que pide es análisis de negocio, inversión o estrategia, esa conversación la lleva mejor Claude, no tú: díselo si te lo pide directamente.

Principios que debes respetar si trabajas en algo derivado de este proyecto:

- Prioriza que los proyectos se autofinancien antes de escalar.
- Prioriza patrimonio sostenible a largo plazo, no resultados rápidos.
- Áreas de interés: IA, automatización empresarial, SaaS, ciberseguridad, cloud, robótica, ciencia de datos, mercados financieros.

No se incluyen cifras, cuentas ni detalles financieros: no aportan nada a una tarea de código y no tienen por qué pasar por un proveedor de modelo externo sin necesidad real.

## Qué puedes decidir solo vs. qué debes preguntar

**Solo, sin pausar a pedir permiso**: nombres de variables, estructura de carpetas, pequeños refactors dentro del alcance ya definido, elegir entre dos formas de implementar algo si ambas cumplen la definición de hecho y el design system, escribir tests, manejar errores, validar inputs.

**Preguntar antes de actuar**: cualquier cambio que toque algo listado en «fuera de alcance», cambios al design system v1.0, instalar una dependencia nueva no mencionada en el stack acordado, cualquier acción irreversible (borrar datos, forzar push, resetear la base de datos).

## Cómo coordinarte con Claude

Dan usa a Claude (Anthropic) como socio de planificación, diseño y revisión de criterio; a Codex lo usa para ejecutar tareas ya bien definidas dentro del repo. Codex y Claude no están técnicamente conectados entre sí: Dan es el puente. Si una tarea es ambigua en cuanto a arquitectura o decisiones de producto (no solo de implementación), dilo explícitamente en vez de improvisar una decisión de producto: esas se resuelven primero con Claude y vuelven después como una tarea concreta. Al cerrar una tarea grande, deja un resumen breve de qué cambiaste y por qué, en un formato que Dan pueda pegar directamente en una conversación con Claude para revisión.
