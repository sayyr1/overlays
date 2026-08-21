# Imbabura en Vivo · Centro de gráficos

Aplicación MERN interna de CODEBRIQ Media para operar gráficos de fútbol y emitirlos por OBS. MongoDB es la fuente de verdad; Pusher Channels solo distribuye las actualizaciones posteriores a cada guardado.

## Arquitectura

- `frontend/`: panel React y overlay transparente de 1920 × 1080.
- `backend/`: Express, autenticación de administrador, API, MongoDB, Cloudinary y Pusher.
- `api/index.mjs`: entrada serverless de Vercel.
- La URL `/overlay/torneo/:slug?token=…` es de solo lectura y se conserva al cambiar el partido activo.

El overlay consulta el estado al abrir y cada 15 segundos como recuperación; también escucha un canal privado de Pusher. Cada estado tiene una `revision`, por lo que los eventos antiguos se descartan.

## Instalación

1. Copia `.env.example` como `.env` y rellena las variables.
2. Instala dependencias: `npm install`, `npm --prefix backend install --legacy-peer-deps` y `npm --prefix frontend install --legacy-peer-deps`.
3. Crea el único administrador: `npm --prefix backend run create-admin`.
4. Inicia la API: `npm --prefix backend start`.
5. En otra terminal inicia el cliente: `npm --prefix frontend start`.

Para datos completamente ficticios de demostración ejecuta `npm --prefix backend run seed-demo`. El script crea una copa, cuatro equipos, jugadores, dos partidos, un patrocinador y selecciona un partido activo. Es seguro ejecutar otra vez, pero para una demostración nueva elimina esos datos desde MongoDB.

## Variables de entorno

`MONGODB_URI`, `JWT_SECRET`, `ADMIN_EMAIL` y `ADMIN_PASSWORD` son obligatorias. Cloudinary requiere `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` y `CLOUDINARY_API_SECRET`. Pusher requiere `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET` y `PUSHER_CLUSTER` en el backend, y únicamente `REACT_APP_PUSHER_KEY` y `REACT_APP_PUSHER_CLUSTER` en el build del frontend. Nunca expongas `PUSHER_SECRET`, `JWT_SECRET`, la URI de MongoDB ni las claves de Cloudinary.

En MongoDB Atlas crea una base de datos y permite temporalmente la IP de desarrollo. En Cloudinary usa una cuenta con una carpeta dedicada `imbabura-en-vivo`. En Pusher crea una app de **Channels**, habilita clientes web y copia sus credenciales a las variables indicadas.

## Operación

1. Inicia sesión con el administrador creado por el script.
2. Crea un torneo. El primer resultado devuelve una URL de OBS con un token secreto; guárdala de inmediato.
3. Crea equipos, luego jugadores, y agenda partidos.
4. Pulsa **Activar** para seleccionar el partido activo. La URL de OBS no cambia.
5. El panel permite controlar marcador, cronómetro, periodo, gráficos temporales e historial. `Z` deshace la última acción reversible.
6. **Regenerar y copiar URL OBS** invalida el token anterior; actualiza la fuente de OBS con la nueva URL.

Atajos: `Espacio` iniciar, `H` gol local, `V` gol visitante, `M` mostrar/ocultar marcador, `Esc` ocultar gráfico temporal y `Z` deshacer. No se activan mientras se escribe en un campo.

### Control en vivo tipo Stream Deck

La pantalla **Control en vivo** está separada de **Configuración previa**. Allí se preparan torneo, equipos, jugadores y partido una sola vez; en transmisión, los botones reutilizan esas referencias y no solicitan volver a escribir información. Hay capas permanentes, una pantalla principal exclusiva, un evento temporal y un rótulo inferior. El estado rojo **EN AIRE** indica la capa seleccionada; pulsar el mismo botón retira esa capa. Las escenas Inicio, Partido en juego, Medio tiempo, Segundo tiempo y Final se guardan como una sola actualización consistente. La vista previa renderiza el mismo componente que el overlay de OBS.

## Cloudinary

La API `POST /api/sports/upload` valida imágenes de máximo 5 MB y sube PNG, JPG, JPEG, WebP o SVG a carpetas lógicas. El backend entrega `publicId`, URL segura, dimensiones y formato; guarda ese objeto en el recurso correspondiente. No hay secretos de Cloudinary en el navegador.

## OBS

Agrega una **Fuente de navegador** con la URL segura que entrega el torneo:

- Ancho: `1920`
- Alto: `1080`
- FPS: `60`
- Fondo: transparente (el overlay no pinta fondo)
- Ocultar cursor e interacción: la fuente es solo lectura y no tiene controles

Se recomienda **no** cerrar la fuente cuando no sea visible para mantener la conexión Pusher. Si se activa “Actualizar navegador cuando se active la escena”, funciona igualmente: al abrir recupera el estado canónico de MongoDB y no reaparece un gráfico que ya expiró.

## Pruebas y build

Ejecuta las pruebas unitarias del cronómetro con `npm --prefix backend test`. El build de producción es `npm run build`; compila React y copia el resultado a `public/` para Vercel. El proyecto se despliega en Vercel sin almacenamiento local: configura las mismas variables en Project Settings → Environment Variables y despliega desde la raíz. `vercel.json` sirve `/api/*` como función y el resto como SPA.

## Seguridad y límites

La sesión usa una cookie `httpOnly`, segura en producción y con SameSite apropiado. El login limita intentos en memoria. Las mutaciones son administrativas; el token largo del overlay solo permite lectura y autorización del canal Pusher privado. El rate limiter se reinicia entre invocaciones serverless, por lo que para producción con alta exposición conviene añadir una capa de límite distribuida (por ejemplo, Vercel Firewall o Redis).
