# Equipos reutilizables

La sección **Equipos** es una biblioteca independiente. Guarda nombre, sigla, colores, logo opcional, ciudad y entrenador. El nombre corto y la sigla pueden generarse al guardar. Sin logo, los gráficos muestran un escudo automático y el nombre del equipo.

Al crear un evento se pueden elegir equipos existentes. En **Configurar evento → Equipos del evento** se agregan o retiran equipos; en **Equipos y partidos** se preparan jugadores y encuentros. Los jugadores pertenecen al equipo y se reutilizan junto a él. Los resultados y partidos siguen perteneciendo al evento.

Los equipos antiguos siguen disponibles con sus mismos identificadores y sus relaciones existentes. Eliminar un evento elimina sus partidos e historial, pero conserva equipos, jugadores, auspiciantes y archivos. No se permite retirar un equipo que tenga partidos en ese evento.

## Actualización de bases existentes

Desde `backend`, ejecutar una vez `node scripts/migrateTeamLibrary.js`. El script reemplaza la restricción antigua de siglas únicas por evento con índices de consulta y agrega el índice de participaciones. No modifica ni elimina registros. Los equipos se identifican por ID: distintos clubes pueden tener la misma sigla.

Las participaciones nuevas se guardan en `SportsTeam.tournaments`. La consulta también reconoce el campo antiguo `tournament`, por lo que no exige migrar los registros existentes.
