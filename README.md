# CIFEAPORC

App web instalable para gestionar la explotación porcina de ciclo cerrado (chato murciano) del centro, con una granja para 1.º y otra para 2.º sobre el mismo censo de animales.

- **Datos:** Supabase (`sql/01_esquema.sql`). Cada alumno entra con un alias y un PIN. Opcionalmente, el profesor puede añadir su nombre (nombre e inicial), visible solo para su curso y el profesor, y que se borra al cerrar el curso.
- **Publicación:** GitHub Pages, desde la rama `main`, carpeta raíz.
- **Sin compilación:** HTML, CSS y JavaScript sin dependencias aparte de `supabase-js`.

## Archivos

| Archivo | Qué contiene |
| --- | --- |
| `index.html` | Página de la app |
| `js/config.js` | Dirección y clave pública de Supabase |
| `js/logica.js` | Ciclo reproductivo, avisos, comprobaciones y valores de referencia |
| `js/app.js` | Pantallas y conexión con la base de datos |
| `css/estilos.css` | Estilos |
| `sw.js`, `manifest.webmanifest` | Instalación en el móvil |
| `sql/01_esquema.sql` | Tablas y reglas de acceso (ejecutar una vez) |
| `sql/02_profesor.sql` | Dar rol de profesor a una cuenta |
| `sql/03_importar_historial.sql` | Historial de 14 cerdas importado de las fichas anteriores (repetible) |
| `sql/04_nombres_alumnos.sql` | Nombre opcional de los alumnos, visible solo en su curso; se borra al cerrar el curso |
| `sql/06_recuentos.sql` | Recuentos de animales en lechoneras y cebadero, para el plano (repetible) |
| `sql/07_censo_alumnos.sql` | Altas y bajas por los alumnos (con firma e historial) y entradas, traslados, muertes y ventas en lechoneras y cebadero (repetible) |
| `sql/05_sanidad_verracos.sql` | Sanidad (previstos y realizados), catálogo de medicamentos y extracciones de los verracos (repetible) |
| `.github/workflows/mantener-activa.yml` | Evita que Supabase pause el proyecto en vacaciones |

## Copia de seguridad

El plan gratuito de Supabase no hace copias automáticas. En la app, **Gestión → Granja → Copia de seguridad** descarga un Excel (para consultar) y un `.json` (para restaurar). Recomendado: cada mes y cada trimestre.

## Valores de referencia

Están en `js/logica.js` (`REF`): ecografía desde el día 19 (ideal 21), entrada en paridera IA + 109, parto IA + 114, lactación 30 días, intervalo destete-cubrición 4–6 días, 7–9 destetados por camada, dosis con aviso el día 4 y caducadas tras el día 5 (extracción = día 0).

## Fases

1. **Hecha:** censo, fichas de cerda, ciclos reproductivos, avisos, dos granjas, accesos y gestión del profesor.
2. **Hecha (0.4.0):** sanidad con calendario, registro y catálogo de medicamentos; ficha del verraco con extracciones y dosis; adopciones en los dos sentidos; causas de baja.
3. Lotes de transición y cebo.
4. **Hecho (0.5.0):** plano de la granja con cada animal en su sitio y recuentos de lechoneras y cebadero.
5. Índices, comparación entre granjas y exportación a Excel.
