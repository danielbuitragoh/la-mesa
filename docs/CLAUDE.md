# La Mesa — notas para trabajar en este repo

Proyecto personal de portafolio de Daniel Buitrago (Dan). App de pedidos para un
restaurante ficticio en Medellín. **No es un producto comercial**: existe para
demostrar capacidad técnica a quien lo abra, así que "desplegado y funcionando"
vale más que "elegante pero sin subir".

Habla en español. El código, los comentarios y los nombres van en español —
es una decisión de marca, no un descuido.

## Estructura

```
app-movil/     Expo + React Native + Expo Router. El código fuente de la app.
app-web/       El build web YA CONSTRUIDO. Es lo que sirve GitHub Pages.
panel/         Panel de cocina. HTML+JS a pelo, sin framework, a propósito.
prototipo/     Recorrido visual sin backend.
supabase/      Migraciones y funciones.
docs/          Notas internas (BRIEF.md, SUBIR.md, AGENTS.md).
```

## Trampas de este repo — leer antes de tocar el despliegue

Estas cinco han roto el sitio en producción al menos una vez cada una. No son
teóricas.

### 1. El workflow NO reconstruye la app

`.github/workflows/desplegar-paginas.yml` sube `app-web/` **tal cual está
commiteado**. No corre ningún build. Consecuencia: **arreglar el código fuente
no cambia nada de lo que se ve en la web.**

Para que un cambio llegue al sitio hay que:

```bash
cd app-movil
npx expo export --platform web      # deja la salida en dist/
# reemplazar el contenido de ../app-web/ con el de dist/
cd ..
git add -f app-web
```

### 2. El `.gitignore` se come los assets en silencio

Tiene `node_modules/` **sin barra inicial**, lo que excluye esa carpeta a
cualquier profundidad — incluida `app-web/assets/node_modules/`, donde viven las
fuentes y los iconos del build.

Los archivos existen en disco, `git add app-web` no protesta, y el sitio se
publica con las fuentes en 404. Por eso **siempre `git add -f app-web`**, con
`-f`. Comprobar con `git check-ignore -v <ruta>` si hay dudas.

### 3. GitHub Pages y las rutas

- El Source en Settings → Pages debe ser **GitHub Actions**, no "Deploy from a
  branch". Con la otra opción, el pipeline de Jekyll compite con el workflow
  propio y sobrescribe el sitio.
- Jekyll ignora las carpetas que empiezan por `_`, incluida `_expo/`. Por eso
  existe `.nojekyll` en la raíz. No borrarlo.
- `404.html` en la raíz es el fallback para las rutas internas de Expo Router:
  si la ruta empieza por `/la-mesa/app-web/`, trae por fetch el `index.html`
  real de la app. Sin él, refrescar en `/app-web/carrito` da 404 de verdad.
- `app.json` lleva `experiments.baseUrl = "/la-mesa/app-web"`. Si cambia la URL
  del sitio, cambia también ahí.

### 4. Supabase Auth y las URLs

Los fallos de login **no suelen estar en el código**. Están en el panel de
Supabase, Authentication → URL Configuration:

- **Site URL** es a donde te devuelve el proveedor cuando el `redirectTo` no
  está en la lista de permitidos. Si apunta a `localhost` y estás en
  producción, el login parece roto sin que ningún error aparezca en consola.
- **Redirect URLs** tiene que incluir la URL real, con comodín:
  `https://danielbuitragoh.github.io/**`.

Antes de buscar el fallo en el código, mirar esos dos campos.

### 5. `app-web/404.html` no es un 404 genérico, es un fallback SPA

Es una copia de `app-web/index.html` (mismo contenido, solo cambia el hash del
bundle JS en el `<script>`) que GitHub Pages sirve cuando una ruta interna de
Expo Router no existe como archivo — por ejemplo `/app-web/carrito` al
refrescar. No lo genera `expo export`; hay que copiarlo a mano cada vez que se
reconstruye el build (paso 3 de la trampa 1):

```bash
cp app-web/index.html app-web/404.html
```

Si se olvida, no hay ningún error visible: el sitio carga, pero las rutas
internas sirven un bundle viejo en vez del que se acaba de publicar. Es
distinto del `404.html` de la raíz del repo (trampa 3), que es el fallback de
todo el sitio, no el de `app-web/` en concreto.

## Antes de dar nada por hecho

El criterio de "terminado" de este proyecto es una prueba concreta, no que
compile: **un desconocido abre la URL desde su móvil, entiende qué es en menos
de dos minutos, completa un pedido, y ese pedido aparece en el panel.**

Comprobar en la URL pública, en incógnito. Que el build pase no es evidencia de
que el sitio funcione — las cuatro trampas de arriba pasan todas el build.

## Convenciones

- **El design system v1.0 está cerrado.** Colores, tipografías y espaciados
  salen de `app-movil/src/tema/tokens.ts` y no se escriben a mano en ningún
  otro sitio. No se rediseña.
- **La raíz del repo lleva README, LICENSE y código.** Las notas internas van a
  `docs/`. Es una decisión deliberada: es un repo que van a mirar reclutadores.
- **El alcance no se amplía.** Toda idea nueva va al README como trabajo
  futuro, nunca al código. Pagos reales, domicilios, notificaciones push y
  publicación en tiendas están fuera a propósito y así se declara.
- **El README no promete nada que la app no haga.** El pago es simulado y se
  dice que es simulado.

## Entorno

Windows, PowerShell. Configurar el editor de git antes de nada, o `git commit`
sin `-m` abre Vim:

```powershell
git config --global core.editor notepad
```

Preferir siempre `git commit -m`.
