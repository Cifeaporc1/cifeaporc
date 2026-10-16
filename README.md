# CIFEAPORC

App web instalable para gestionar la explotación porcina de ciclo cerrado (chato murciano) del centro, con una granja para 1.º y otra para 2.º sobre el mismo censo de animales.

- **Datos:** Supabase (`sql/01_esquema.sql`). La app no guarda datos personales de los alumnos: cada uno entra con un alias y un PIN.
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
| `.github/workflows/mantener-activa.yml` | Evita que Supabase pause el proyecto en vacaciones |

## Valores de referencia

Están en `js/logica.js` (`REF`): ecografía desde el día 19 (ideal 21), entrada en paridera IA + 99, parto IA + 114, lactación 30 días, intervalo destete-cubrición 4–6 días, 7–9 destetados por camada, dosis con aviso el día 4 y caducadas tras el día 5 (extracción = día 0).

## Fases

1. **Hecha:** censo, fichas de cerda, ciclos reproductivos, avisos, dos granjas, accesos y gestión del profesor.
2. Extracciones y dosis, lotes de transición y cebo, sanidad y catálogo de productos.
3. Plano de la granja, índices, comparación entre granjas y exportación a Excel.
