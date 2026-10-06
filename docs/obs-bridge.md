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

En OBS habilita **Ajustes → Salida → Búfer de repetición**, configura la duración (por ejemplo, 20 segundos) y aplica. En la pestaña **Repeticiones** de la web, pulsa **Iniciar captura**. Después de una acción, **Guardar jugada** conserva los últimos segundos en la carpeta de grabaciones de OBS. Los archivos permanecen en la PC y la web muestra hasta 50 clips identificados por evento y hora; no se suben a Vercel ni se eliminan al salir del panel.

**Reproducir** cambia a una escena propia del puente, ajusta el clip al lienzo de OBS y muestra «REPETICIÓN». Conserva el audio original del clip. El puente vuelve a la escena anterior al terminar o al pulsar **Volver al directo**, incluso sin nuevos mensajes de Vercel. Si cambias manualmente a otra escena en OBS, respeta esa elección. No permite guardar mientras reproduce para evitar capturar la misma repetición.

El búfer de OBS graba la salida del programa, incluidos los gráficos y anuncios visibles en ese momento. No es una grabación aislada de BELABOX. La web no sirve una vista previa de los archivos locales; permite elegirlos por evento y hora. Actualiza y reinicia el puente al instalar esta función; conserva su archivo de vinculación.
