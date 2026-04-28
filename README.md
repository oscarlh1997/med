# Mi Botiquín 💊

Calendario de medicación con avisos por **Telegram**. Sin instalar nada en el móvil — el calendario se ve desde una URL web y los recordatorios llegan al chat de Telegram a la hora exacta de cada toma.

```
┌──────────────────┐         ┌─────────────────┐         ┌────────────┐
│  Web (Vercel)    │         │  Cron + KV      │  ──→    │  Telegram  │
│  Editar tomas    │ ←─API─→ │  Cada minuto    │         │  (gratis)  │
│  Marcar tomadas  │         │  comprueba hora │         │            │
└──────────────────┘         └─────────────────┘         └────────────┘
```

**Todo gratis** con el plan Hobby de Vercel + Telegram Bot API.

---

## 🚀 Despliegue (15 minutos)

### Paso 1 — Crear el bot de Telegram

1. Abre Telegram y busca **@BotFather**.
2. Pulsa "Iniciar" (o envía `/start`).
3. Envía `/newbot`.
4. Te pedirá:
   - **Nombre del bot**: por ejemplo `Mi Botiquín`.
   - **Username**: tiene que terminar en `bot`. Por ejemplo `mibotiquin_aldo_bot`.
5. BotFather te responde con un mensaje que contiene el **token**, algo así:

   ```
   1234567890:AAEhBP0av28JmcfeXoIbGr_eYtzhrR5zGjQ
   ```

   **Cópialo y guárdalo**, lo necesitas en el Paso 3.

> Opcional: en BotFather puedes usar `/setdescription`, `/setuserpic` y `/setcommands` para personalizar el bot.

### Paso 2 — Subir el proyecto a GitHub

Si no tienes Git instalado, descárgalo desde [git-scm.com](https://git-scm.com/download/win).

```powershell
cd botiquin
git init
git add .
git commit -m "Primera versión"
```

Crea un repositorio nuevo (puede ser **privado**) en [github.com/new](https://github.com/new) llamado `botiquin`. GitHub te dará dos comandos para enlazarlo:

```powershell
git remote add origin https://github.com/TU_USUARIO/botiquin.git
git branch -M main
git push -u origin main
```

### Paso 3 — Desplegar en Vercel

1. Entra en [vercel.com](https://vercel.com) e inicia sesión con tu cuenta de GitHub.
2. Pulsa **Add New → Project**.
3. Selecciona el repositorio `botiquin` y pulsa **Import**.
4. **No pulses Deploy todavía**. Antes:
   - Despliega la sección **Environment Variables**.
   - Añade dos variables:

   | Name | Value |
   |---|---|
   | `TELEGRAM_BOT_TOKEN` | el token que te dio BotFather |
   | `CRON_SECRET` | una cadena aleatoria larga (puedes generarla en [random.org/strings](https://www.random.org/strings/) — 50 caracteres alfanuméricos) |

5. Ahora sí, pulsa **Deploy**. Tarda 1-2 minutos.

6. Cuando termine, verás tu URL pública, algo como `https://botiquin.vercel.app`. **Cópiala**, la necesitas en el Paso 5.

### Paso 4 — Conectar el storage (Vercel KV)

Sin esto, los datos se pierden cada vez que el servidor se reinicia.

1. En el dashboard del proyecto en Vercel, ve a la pestaña **Storage**.
2. Pulsa **Create Database** → **KV** (Redis-compatible).
3. Nómbrala como quieras, por ejemplo `botiquin-kv`. Selecciona la región más cercana (Frankfurt para España).
4. Pulsa **Create**.
5. En la pestaña que aparece, pulsa **Connect Project** → selecciona `botiquin` → **Connect**.

Vercel rellena automáticamente las variables `KV_REST_API_URL`, `KV_REST_API_TOKEN`, etc. **No tienes que copiarlas a mano**.

6. Vuelve a la pestaña **Deployments** y pulsa los tres puntos del último deploy → **Redeploy** (para que use las nuevas variables).

### Paso 5 — Conectar Telegram al backend (webhook)

Esto le dice a Telegram dónde tiene que avisar cuando alguien hable con el bot. Solo se hace una vez.

Sustituye `<TOKEN>` por tu token de bot y `<URL>` por tu URL de Vercel y ejecuta este comando en PowerShell:

```powershell
curl.exe "https://api.telegram.org/bot<TOKEN>/setWebhook?url=<URL>/api/telegram"
```

Por ejemplo:

```powershell
curl.exe "https://api.telegram.org/bot1234567890:AAEhBP0av28JmcfeXoIbGr_eYtzhrR5zGjQ/setWebhook?url=https://botiquin.vercel.app/api/telegram"
```

Debe responder `{"ok":true,"result":true,...}`.

### Paso 6 — Suscribirse al bot

1. En Telegram, busca tu bot por su username (`@mibotiquin_aldo_bot` o el que pusiste).
2. Pulsa **Iniciar** o envía `/start`.
3. El bot te confirma que estás suscrito.

A partir de ahora, **a la hora exacta de cada toma** recibirás un mensaje en tu chat. Si una segunda persona también envía `/start`, también lo recibirá.

---

## ✅ Listo

- La web está en `https://botiquin.vercel.app` — desde ahí editas el calendario, añades tomas, marcas las tomadas.
- Las notificaciones llegan automáticamente por Telegram con un botón **✅ Marcar tomada**.
- Cuando alguien pulsa el botón, la marca se sincroniza en la web automáticamente (la web se refresca cada 15 segundos).
- Comparte la URL con quien quieras que pueda editar el calendario.
- Comparte el username del bot con quien quieras que reciba los avisos.

---

## 🔄 Cómo se sincroniza todo

```
┌──────────────────────────────────────────────────────────────────┐
│                         Estado central (Vercel KV)               │
│  reminders · subscribers · dispatch[día][reminderId]             │
└──────────────────────────────────────────────────────────────────┘
       ▲                            ▲                           ▲
       │                            │                           │
       │ marca/desmarca             │ pulsa botón               │ envía mensaje
       │                            │                           │
   ┌───┴────┐                  ┌────┴────┐                ┌─────┴─────┐
   │  Web   │                  │ Telegram│                │   Cron    │
   │ (Next) │ ←─ polling 15s ─ │  (bot)  │                │ (1 min)   │
   └────────┘                  └─────────┘                └───────────┘
```

- **Web → Telegram**: si marcas una toma desde la web y ya se había enviado el mensaje, el bot edita el mensaje original quitando el botón y mostrando "Marcada por la web".
- **Telegram → Web**: si pulsas el botón en Telegram, el estado se guarda y la web lo refleja automáticamente en máximo 15 segundos.

---

## 🌅 Reset diario automático

Los registros del día anterior se purgan automáticamente al cambiar de fecha:

- A las 00:00 (Europe/Madrid) cuando llega el primer cron del nuevo día, el código detecta que no hay registro para hoy y borra los días anteriores.
- Los recordatorios (horarios, medicaciones) se mantienen, **solo se reinician las "tomadas"**.
- Cada toma vuelve a enviarse a su hora con su botón limpio.

---

## 🛠️ Desarrollo local (opcional)

```powershell
npm install
copy .env.example .env.local
# edita .env.local y pon tu TELEGRAM_BOT_TOKEN
npm run dev
```

Abre [localhost:3000](http://localhost:3000). Sin KV configurado, los datos se guardan en memoria y se reinician al reiniciar el server. Está bien para desarrollar.

---

## 📋 Comandos del bot

- `/start` — suscribirse y recibir avisos
- `/hoy` — ver el calendario del día con botones para marcar las pendientes
- `/stop` — dejar de recibir avisos

Cada notificación de toma incluye un botón **✅ Marcar tomada** que actualiza el estado en todos los chats y en la web.

---

## ⚠️ Notas importantes

### Sobre Vercel Cron y el plan gratis
- Vercel Cron Jobs están incluidos en el plan **Hobby (gratis)**.
- El cron se dispara cada minuto. Cada disparo es una invocación serverless. El plan Hobby da 100 GB-hrs/mes de funciones, más que suficiente para este uso.

### Zona horaria
- El servidor de Vercel corre en UTC, pero la app convierte automáticamente a `Europe/Madrid` antes de comparar horas. Está cableado en `lib/types.ts` → `nowInMadrid()`. Si vives en otra zona, cambia el valor de la constante `TIMEZONE`.

### Privacidad
- Los datos están en Vercel KV (Redis cifrado) en su región europea.
- Solo tu bot tiene acceso a ellos.
- Si quieres más control, puedes usar Upstash Redis directamente (también gratis) en lugar de Vercel KV.

### Seguridad
- La URL de tu app es pública: cualquiera que la conozca puede ver y editar el calendario.
- Si quieres añadir contraseña o auth de Google, abre un issue mental y lo añadimos.

### Disclaimer
Mi Botiquín es una herramienta personal de recordatorio. NO es un dispositivo médico, NO diagnostica ni recomienda tratamientos, y NO sustituye al criterio de un profesional sanitario.
