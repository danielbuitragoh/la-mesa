# Cómo subirlo a GitHub

El repositorio ya está inicializado y con el primer commit hecho. Solo faltan tres pasos.

## 1 · Crear el repositorio y subirlo

En GitHub, crea un repositorio nuevo llamado `la-mesa`, **público** y **vacío** (sin README, sin licencia, sin .gitignore — ya están aquí). Después, desde esta carpeta:

```bash
git remote add origin https://github.com/Daniel-debug-java/la-mesa.git
git push -u origin main
```

## 2 · Encender la demo en vivo

En el repositorio: **Settings → Pages → Source: Deploy from a branch → main / (root) → Save**.

En un par de minutos quedan disponibles:

- `https://daniel-debug-java.github.io/la-mesa/` — la portada
- `https://daniel-debug-java.github.io/la-mesa/prototipo/la-mesa-app.html` — la app
- `https://daniel-debug-java.github.io/la-mesa/panel/panel-admin.html` — el panel de cocina

Esto es lo que más va a pesar cuando alguien mire tu perfil: la mayoría de proyectos de portafolio piden que te los imagines, el tuyo se puede tocar.

## 3 · Reemplazar `TU-USUARIO`

Aparece en tres archivos: `README.md`, `index.html` y este mismo. De un tirón:

```bash
grep -rl 'TU-USUARIO' . --exclude-dir=node_modules --exclude-dir=.git \
  | xargs sed -i '' 's/TU-USUARIO/tu-usuario-real/g'    # macOS
```

En Linux es igual pero sin las comillas vacías después de `-i`.

Luego:

```bash
git commit -am "Enlaces de la demo" && git push
```

---

## Lo que se activa solo

**La verificación en cada push.** El flujo de `.github/workflows/verificar.yml` corre TypeScript, compila el bundle de Android, comprueba que los catorce pares de color pasen WCAG AA, ejecuta las once pruebas de firma de pago y valida que cada tabla y columna que el código le pide a la base exista. Cuando pase, aparece el visto verde junto al commit.

Si quieres el distintivo en el README, pega esto debajo del título:

```markdown
[![Verificar](https://github.com/Daniel-debug-java/la-mesa/actions/workflows/verificar.yml/badge.svg)](https://github.com/Daniel-debug-java/la-mesa/actions/workflows/verificar.yml)
```

## Cosas que ayudan y cuestan dos minutos

En la portada del repositorio, arriba a la derecha, hay un engranaje junto a "About". Ahí pon la descripción y la URL de la demo, y las etiquetas: `react-native`, `expo`, `typescript`, `supabase`, `postgresql`, `design-system`, `accessibility`, `restaurant-app`. Eso es lo que hace que el repositorio aparezca en búsquedas.

Y fija el repositorio en tu perfil: **tu perfil → Customize your pins**.

## Antes de publicar, comprueba

Que no subiste ningún `.env` — el `.gitignore` ya lo cubre, pero míralo:

```bash
git ls-files | grep -i env
```

Debe devolver solo `app-movil/.env.example`, que lleva valores de ejemplo a propósito.

Y que todo pasa en tu máquina antes de que lo intente el servidor:

```bash
python3 docs/contraste.py
node supabase/functions/_pruebas/firma.prueba.mjs
node docs/revisar-esquema.mjs
cd app-movil && npm install && npx tsc --noEmit
```
