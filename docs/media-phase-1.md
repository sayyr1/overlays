# Media y motion graphics · Fase 1

En **Control en vivo** o **Auspiciantes**, abre **Media y motion graphics**. Se conserva el panel, la URL de OBS y el motor de gráficos existente.

La biblioteca incluye un frame editorial y un lower third SVG con centro transparente, listos para combinar con tus textos. Seleccionarlos aplica su distribuci?n inicial.

1. Sube un PNG, JPG, WebP, SVG, MP4 o WebM. Elige una categoría y un nombre. Las imágenes admiten 10 MB y los videos 100 MB, sujeto también a los límites de la cuenta de Cloudinary.
2. Selecciona el recurso y una de las 16 capas. Usa una distribución inicial: pantalla completa, fondo/frame, lower third o logo.
3. Ajusta posición, dimensiones, opacidad y orden. El lienzo es de 1920 × 1080; los gráficos HTML existentes están en el orden 10. Un recurso con orden 1 queda debajo; con orden 20 queda encima.
4. Pulsa **Mostrar / PLAY**. Cada capa tiene **PLAY**, **STOP**, **RESTART** y **HIDE**. PLAY y RESTART emiten desde el inicio; STOP detiene en el primer cuadro; HIDE retira la capa. La duración 0 mantiene la imagen o el video en bucle hasta retirarlo. Un video sin bucle sigue la política de final configurada.
5. Puedes añadir título y subtítulo HTML sobre el recurso, retrasar su entrada y elegir qué ocurre al terminar el video: ocultar todo, conservar el último cuadro con el texto o conservar solo el texto. Una duración explícita retira la capa completa, incluido el texto.
6. Guarda la configuración como preset para reutilizarla en deportes, presentaciones/podcast, IRL o eventos. Cargar un preset prepara el editor; **Mostrar** lo pone al aire. Los cambios del editor no afectan a la salida hasta emitirlos.

La biblioteca y los presets son globales para el administrador y persisten en MongoDB. Cada transmisión conserva sus propias capas. Quitar un recurso de la biblioteca no borra el archivo de Cloudinary ni interrumpe una capa que ya lo utiliza. Los presets que apuntan a un recurso retirado quedan deshabilitados.

## Auspiciantes

Crea o edita el auspiciante en el módulo existente. En el compositor, selecciónalo y asigna recursos de la biblioteca como LOGO, ANIMACIÓN o VIDEO. El logo que ya tenía el auspiciante se puede emitir directamente sin subirlo otra vez. Las animaciones usan WebM.

Selecciona 5, 10, 15 segundos o Manual y pulsa el formato que deseas emitir. La capa 16 está reservada por convención para emisión directa: un nuevo auspiciante reemplaza al anterior. **HIDE SPONSOR** retira esa capa. La rotación de auspiciantes existente mantiene su control independiente.

## OBS y transparencia

La fuente sigue siendo `/overlay/torneo/:slug?token=…`, a 1920 × 1080. No se requieren escenas adicionales. **Limpiar salida / Ocultar todo** retira también las capas de media; se conserva su configuración para volver a emitirlas.

Exporta motion graphics como WebM con canal alfa compatible con Chromium/OBS. La app sirve el archivo original y no pinta un fondo detrás del video. Un archivo que contiene un fondo negro opaco no se vuelve transparente automáticamente. La vista previa siempre está silenciada; el audio de la salida se controla por capa. Verifica codecs, audio y transparencia con tus archivos en la versión de OBS que uses antes de salir al aire.

La activación y caducidad se guardan con hora del servidor. Al cargar o reconectar, los videos buscan el punto correspondiente de reproducción; los clips vencidos no reaparecen. Mantén sincronizada la hora del equipo de OBS. STOP no cancela una duración explícita ya programada.

## Implementación

- `MediaAsset` y `MediaPreset`: biblioteca y configuraciones compartidas.
- `OverlayState.mediaLayers`: hasta 16 slots independientes. Las actualizaciones usan rutas por slot para no sobrescribir capas concurrentes.
- `/api/sports/media/sign`: firma autenticada para subida directa a Cloudinary. El secreto permanece en el servidor. `/media` verifica los metadatos contra Cloudinary antes de registrar el recurso.
- `/api/sports/tournaments/:id/media/control`: comandos administrativos. Los enlaces públicos de OBS conservan acceso de lectura; el control remoto anterior no incorpora edición de media.
- La vista previa y OBS usan `MediaComposition` dentro de `OverlayComposition`. Los snapshots grandes generan una notificación Pusher de invalidación y el cliente recupera el estado por la API; el sondeo existente sigue siendo la recuperación de respaldo.
- No se incorporan replay, control de OBS, SRT ni automatizaciones.

Referencia de la subida firmada: [Cloudinary: subida desde el navegador con Node.js](https://cloudinary.com/documentation/node_image_and_video_upload#direct_uploading_from_the_browser).

## Verificación

`npm --prefix backend test`, `npm --prefix frontend test -- --watchAll=false --runInBand` y `npm run build`.

Las pruebas cubren validación de comandos, independencia de capas, caducidad, políticas al finalizar, salida sin partido y emisión de logos existentes. Las pruebas locales no sustituyen una comprobación con MongoDB, Cloudinary, Pusher y OBS configurados. La revisión visual interactiva no pudo realizarse en esta sesión porque no había un navegador conectado.
