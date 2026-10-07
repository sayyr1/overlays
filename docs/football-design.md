# Paquete deportivo de fútbol

Se revisaron referencias de la [identidad televisiva de Premier League / DixonBaxi](https://designmuseum.org/exhibitions/beazley-designs-of-the-year/digital-20x/premier-league-on-air-branding), el [proyecto publicado por DixonBaxi](https://vimeo.com/178508705) y la [identidad de UEFA Champions League de 2024](https://www.uefa.com/news-media/news/0290-1badd36e73b2-c3e5755b7fae-1000--uefa-unveils-new-uefa-champions-league-brand-identity/).

Estas referencias muestran sistemas coherentes de información, identidad y movimiento entre marcador, placas, alineaciones y piezas de transmisión. La aplicación adopta un diseño propio: conserva los colores y logos del evento, reduce la altura del marcador y distingue los equipos con sus colores. Las placas tienen una jerarquía compartida de competición, equipos, resultado y contexto. Las jugadas usan rótulos breves con códigos de color; las estadísticas incorporan barras proporcionales a los valores reales.

La salida sigue siendo transparente a 1920 × 1080. Los cambios visuales se limitan a `.tv-sports`, sin modificar las plantillas generales ni la publicidad. Las entradas duran entre 220 y 300 ms y respetan la preferencia de movimiento reducido. No se animan los cambios de reloj ni se añaden sonidos.

Cada compilación genera `/football-preview.html` a partir de los componentes y estilos reales. La galería usa datos ficticios y permite cambiar el fondo y navegar por las plantillas desde el celular. No consulta el backend ni controla OBS.
