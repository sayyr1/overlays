# Control de BELABOX desde fuera de casa

La app y su API se publican en Vercel. Un proceso pequeño se ejecuta en la computadora de casa y conecta el audio de la fuente `BELABOX_SRT` con la app.

```text
Celular → app en Vercel → órdenes guardadas en MongoDB
                            ↑
                  puente en la PC de casa → OBS local
```

El puente consulta las órdenes por HTTPS cada 1,5 segundos, además del tiempo de respuesta. No necesita abrir puertos del router. La contraseña del WebSocket de OBS se lee localmente en Windows y no se envía a Vercel. El archivo de vinculación contiene una clave que permite consultar órdenes de audio y repeticiones y reportar su estado, sin acceso de administrador.

## Preparar una vez

1. Publica esta versión de la app y API en Vercel, con las variables existentes de MongoDB y autenticación. El modo puente se selecciona automáticamente cuando `VERCEL` está definido. Para probarlo localmente usa `OBS_CONTROL_MODE=bridge` en el backend.
2. En OBS de casa, abre **Herramientas → Ajustes del servidor WebSocket**, activa el servidor y conserva la autenticación.
3. En la app publicada, abre **Control en vivo → Publicidad → Audio del campo → Conectar computadora de casa** y pulsa **Descargar vinculación**.
4. Guarda `obs-bridge.json` en la computadora de casa. El puente requiere Node.js 20 o posterior y las dependencias del backend:

   ```powershell
   npm --prefix backend install --legacy-peer-deps
   npm --prefix backend run obs-bridge -- --config "C:\Users\TU_USUARIO\Downloads\obs-bridge.json"
   ```

   O inícialo en segundo plano desde la carpeta del proyecto:

   ```powershell
   powershell -ExecutionPolicy Bypass -File backend\scripts\Start-ObsBridge.ps1 -ConfigPath "C:\Users\TU_USUARIO\Downloads\obs-bridge.json"
   ```

5. Comprueba **OBS conectado**, selecciona la fuente `BELABOX_SRT` y activa **Bajar ambiente durante anuncios** en el evento que transmitirás. El valor inicial es 15 %; se puede ajustar.

El puente y OBS deben estar funcionando cuando salgas. La aplicación del celular puede cerrarse sin detenerlos. El script de segundo plano escribe sus mensajes en `backend/obs-bridge.log` y `backend/obs-bridge.error.log`; no registra la clave de vinculación ni la contraseña de OBS. Si reinicias Windows, vuelve a iniciar el puente.

## Comportamiento del audio

- **Silenciar campo** afecta al audio de BELABOX, sin cortar la imagen SRT ni silenciar el anuncio.
- **Volumen habitual** ajusta el nivel al que se vuelve después del anuncio.
- Durante un video configurado con audio, el puente reduce el campo al nivel elegido. Nunca aumenta un ambiente que ya estuviera más bajo.
- Logos y videos configurados sin audio conservan el ambiente.
- Al terminar, detener publicidad o desactivar la reducción automática, restaura el volumen. No cambia el mute manual.
- La programación del anuncio y el volumen previo se conservan en la PC. Si se pierde Internet, el puente puede restaurar el nivel al llegar al final previsto del anuncio. Una orden remota de detener no puede llegar durante una desconexión.
- Si OBS se desconecta, se conserva el volumen pendiente de restaurar y se reintenta al reconectar.
- El panel muestra la confirmación que devuelve la PC. Las órdenes manuales vencen a los 20 segundos y no se aceptan con el puente desconectado.

Solo debe ejecutarse una instancia del puente. Una vinculación nueva invalida el archivo anterior. Descarga el nuevo archivo y reinicia el proceso para reemplazarlo. El estado de recuperación queda en `backend/.obs-bridge-state.json`; está excluido de Git, al igual que los archivos `.obs-bridge*.json` de esa carpeta.

En otras plataformas, o si OBS usa una configuración portable, define `OBS_WEBSOCKET_URL` y `OBS_WEBSOCKET_PASSWORD` **en la computadora del puente**, no en el frontend.

## Repeticiones

En cada jugada, el menú **⋯** permite **Renombrar** (hasta 80 caracteres) o **Eliminar** con confirmación. Los nombres se conservan en el estado local del puente y se sincronizan con la web. Eliminar retira la entrada de la biblioteca del evento y conserva el archivo original de OBS. No se puede eliminar la jugada que esté en aire. Estas órdenes necesitan el puente conectado y vencen a los 20 segundos, igual que los controles de reproducción.

En **Configuración del evento → Repeticiones** puedes subir un PNG/WebP/JPG o un WebM/MP4, reutilizar archivos de la biblioteca y guardar la identidad de ese evento. **Entrada** reproduce una animación de hasta 10 segundos antes de la jugada. **Gráfico sobre toda la repetición** usa el lienzo completo y repite el video durante el clip; exporta WebM con canal alfa para dejar visible la jugada. **Logo en la esquina** ajusta el recurso a 300 × 160 sin deformarlo, centrado sobre una placa oscura con un r?tulo amarillo de 48 px. Las medidas se adaptan al lienzo de OBS. Desactiva el rótulo adicional de OBS si tu animación ya incluye “REPETICIÓN”. Los gráficos personalizados van silenciados, conservando el audio de la jugada.

El puente descarga el gráfico de Cloudinary a `backend/.obs-replay-assets/` la primera vez que se utiliza y luego lo reproduce desde la PC. Una descarga fallida deja la escena de directo en aire y muestra el error en la web. Los cambios guardados se aplican en la siguiente reproducción; no modifican una repetición que ya esté en aire.

En OBS habilita **Ajustes → Salida → Búfer de repetición**, configura la duración (por ejemplo, 20 segundos) y aplica. En la pestaña **Repeticiones** de la web, pulsa **Iniciar captura**. Después de una acción, **Guardar jugada** conserva los últimos segundos en la carpeta de grabaciones de OBS. Los archivos permanecen en la PC y la web muestra hasta 50 clips identificados por evento y hora; no se suben a Vercel ni se eliminan al salir del panel.

**Reproducir** cambia a una escena propia del puente, ajusta el clip al lienzo de OBS y muestra «REPETICIÓN». Conserva el audio original del clip. El puente vuelve a la escena anterior al terminar o al pulsar **Volver al directo**, incluso sin nuevos mensajes de Vercel. Si cambias manualmente a otra escena en OBS, respeta esa elección. No permite guardar mientras reproduce para evitar capturar la misma repetición.

El búfer de OBS graba la salida del programa, incluidos los gráficos y anuncios visibles en ese momento. No es una grabación aislada de BELABOX. La web no sirve una vista previa de los archivos locales; permite elegirlos por evento y hora. Actualiza y reinicia el puente al instalar esta función; conserva su archivo de vinculación.

## Enlace permanente y control móvil

En **Configuración del evento → Salida OBS**, copia el **enlace permanente** y pégalo una sola vez en la fuente de navegador de OBS (1920 × 1080). La misma dirección sirve para todos los eventos. Copiarla, recargar la aplicación o crear otro campeonato no la cambia. Los enlaces anteriores de cada evento siguen funcionando; la actualización inicial de la fuente a la salida permanente se hace una sola vez.

En **Control en vivo**, el estado superior indica el evento asignado a esa salida. **Enviar este evento a OBS** selecciona explícitamente la producción; cambiar el evento que estás configurando no modifica la salida. Si ya hay un evento asignado, se pide confirmar el cambio. Esta selección también mueve el control de ambiente del puente al nuevo evento, conservando su fuente y sus ajustes de audio.

La fuente de navegador informa qué evento y revisión recibió. **Overlay confirmado** aparece solo con una señal reciente que reconoce la versión vigente. Un cambio aún no reconocido se muestra como **actualizando**. La conexión del puente WebSocket y la señal del overlay se muestran por separado. Un enlace abierto fuera de OBS también puede informar su recepción; el estado no confirma que una transmisión esté iniciada ni que haya espectadores.

En el celular, **Inicio → Editar teclas** permite elegir hasta ocho acciones favoritas. Se conservan en ese dispositivo para ese evento. **Audio** da acceso al mute y al volumen; **Más** contiene Gráficos, vista de salida y configuración. Las órdenes de audio y repeticiones distinguen el envío de la confirmación de casa. Si falla la conexión con la web, las teclas de operación se bloquean mientras se recupera, sin reenviar automáticamente las pulsaciones.

**Reemplazar enlace** está dentro de ajustes avanzados y exige escribir `REEMPLAZAR ENLACE OBS`. Revoca la dirección permanente anterior y requiere volver a pegar la nueva en OBS. No se usa para el cambio habitual de eventos. La clave de visualización se recupera únicamente mediante la sesión de administrador y se excluye de las consultas ordinarias del modelo; las rutas públicas validan su hash y no dan acceso al control.
