# Foro UNELLEZ — frontend del prototipo

Foro de discusión para la comunidad de la Universidad Nacional Experimental de los Llanos Occidentales “Ezequiel Zamora” (UNELLEZ). Interfaz estática, semántica y lista para conectar a un backend PHP.

**Pantallas incluidas:** home de hilos, hilo abierto, perfil de usuario, acceso/registro y publicación de un hilo nuevo.

---

## 1. Stack y decisiones

- **HTML5 semántico**, sin frameworks de UI.
- **Tailwind CSS 3.4** compilado a `assets/css/tailwind.css` (preflight + utilidades de layout). El sistema visual específico vive en `assets/css/foro.css`: es un foro denso, no una landing, y necesita componentes propios (rail de voto, árbol de comentarios, composer, tablas de datos).
- **Vanilla JavaScript** en `assets/js/foro.js`, sin dependencias. Cada bloque comprueba que su DOM exista para reutilizar el mismo archivo en las cinco páginas.
- **PHP-friendly:** todos los formularios de escritura usan `POST` + `action="procesar.php"` y campos `name` estables. Los formularios llevan `data-demo` solo para que el prototipo estático no navegue a un 404 al validar. Ver §4.

### Dirección visual

La paleta sale de la marca naranja del logo (`#EE7D16`), no de una plantilla: papel cálido `#F7F4ED`, tinta `#191813`, un solo acento naranja y líneas de 1 px. No hay gradientes, sombras difusas ni radios grandes. Los avatares son fotos reales; las miniaturas, fotografías reales; las cifras y los hilos son datos de demostración.

La tipografía es **IBM Plex** en cuatro registros:

| Registro | Fuente | Uso |
|---|---|---|
| UI | IBM Plex Sans 400/500/600 | navegación, meta, comentarios, formularios |
| Títulos | IBM Plex Sans Condensed 600 | wordmark, `h1`, títulos de hilo |
| Prosa | IBM Plex Serif 400/500 | cuerpo del post inicial |
| Datos | IBM Plex Mono 400/500 | votos, contadores, etiquetas, cifras tabulares |

### Referencias del Reference Pack

| Decisión | Referencia |
|---|---|
| Ritmo de fila, meta en gris y un solo acento estructural | `news-ycombinator-com` |
| Sidebar de comunidades con contador + thumbnails de 56 px | `discuit-net` |
| Columnas numéricas alineadas, prefijos y acciones por post | `forums-macrumors-com` |
| Reglas de la comunidad visibles en el sidebar | `lemmy-ml` |
| Perfil con stats, tabs e historial denso | `mastodon-social` + `stackoverflow-com` |
| Composer abierto con toolbar mínima | `lobsters` + `ifixit-com` |

No se copió el chrome completo de ningún sitio. La fuente de los 26 sitios con `legacy-default-font`/`inter-font` del pack no se usó, como pide `_index/typography.md` §0.

---

## 2. Estructura

```
Foro/
├── index.html              Home: listado denso + sidebar + footer institucional
├── thread.html             Hilo abierto: post, árbol de respuestas y composer
├── profile.html            Perfil: cabecera, stats, tabs e historial
├── login.html              Acceso y registro en pestañas
├── nuevo-hilo.html         Publicación con validación, preview y borrador
├── README.md
├── CREDITOS.md
├── tailwind.config.js
├── assets/
│   ├── css/
│   │   ├── tailwind.css        Compilado de Tailwind (no editar a mano)
│   │   ├── tailwind-input.css  Entrada para regenerar Tailwind
│   │   └── foro.css            Sistema visual y componentes
│   ├── js/
│   │   └── foro.js             Interacciones (votos, drawer, validación, tabs…)
│   ├── img/
│   │   ├── avatares/           Retratos de demostración (randomuser.me)
│   │   ├── campus/             Fotos reales de la UNELLEZ (Wikimedia)
│   │   └── foro/               Miniaturas y foto del Jardín Botánico
│   └── logo/
│       ├── logo.png            Logo original provisto
│       ├── logo-mark.png       Recorte de la marca para el header
│       └── favicon.png
└── …
```

### Cómo verlo

Abrir `index.html` en el navegador, o servirlo para que las rutas se comporten como en producción:

```bash
cd Foro
python3 -m http.server 8000
# http://localhost:8000
```

### Regenerar Tailwind

El CSS compilado está incluido. Si se editan clases de Tailwind en el HTML/JS:

```bash
npm install -D tailwindcss@3.4.17
npx tailwindcss -c tailwind.config.js -i assets/css/tailwind-input.css -o assets/css/tailwind.css --minify
```

`foro.css` se edita aparte y no pasa por Tailwind.

---

## 3. Funcionalidad JavaScript

- **Votos en vivo** en hilos y respuestas: `▲` naranja, `▼` azul, contador con `tabular-nums`; vuelve a neutro al repetir el voto. Persiste en `localStorage` (`foro:unellez:votos:v1`) y sincroniza la misma clave entre home e hilo.
- **Menú de usuario** en el header: abre/cierra con click, `Escape` o click fuera; `aria-expanded` y foco gestionados.
- **Drawer móvil** del sidebar: abre desde el botón hamburguesa, overlay, cierre con `Escape`/botón/overlay, foco atrapado y `visibility:hidden` cuando está cerrado.
- **Orden del feed**: Recientes / Activos / Mejor valorados; reordena en el DOM manteniendo fijados arriba.
- **Filtro por comunidad**: enlaces del sidebar filtran el listado, actualizan el contador y muestran un estado “Mostrando …” con opción de limpiar.
- **Cargar más**: revela 3 hilos adicionales y actualiza el estado.
- **Árbol de comentarios**: colapsar/expandir por rama, “Contraer todo”, orden por más votadas / más recientes.
- **Responder / citar**: el botón de una respuesta rellena `padre_id`, muestra la barra “Respondiendo a…” y enfoca el composer; “Citar” inserta un `> ` con el extracto.
- **Composer**: toolbar de markdown mínimo (negrita, cursiva, cita, código, enlace, lista), contador de palabras, vista previa saneada y validación mínima.
- **Formularios**: validación en vivo al salir del campo, resumen de errores, foco en el primer error, contadores y checklist de contraseña. El formulario de nuevo hilo **no se envía** si el título está vacío.
- **Borrador local** del nuevo hilo con autoguardado, restauración y descarte.
- **Modal de reporte** con `<dialog>`, motivos y foco.
- **Guardar / seguir / compartir** con estado y aviso.
- Atajo `/` para enfocar la búsqueda.

---

## 4. Integración con PHP

### 4.1 Partir el HTML en componentes

Los bloques están delimitados con comentarios:

```
<!-- HEADER — al portar a PHP: includes/header.php -->
<!-- SIDEBAR — al portar a PHP: includes/sidebar-home.php -->
<!-- FOOTER — al portar a PHP: includes/footer.php -->
```

Sugerencia de componentes:

```
includes/
├── header.php              <head>, top rule, navbar, menú de usuario
├── footer.php              sello UNELLEZ, columnas, créditos
├── sidebar-home.php        comunidades + reglas + moderación
├── sidebar-thread.php      comunidad + reglas + datos + relacionados
├── thread-row.php          una fila del listado (recibe $hilo)
├── comment.php             una respuesta (recursiva por $padre_id)
└── vote-rail.php           control de voto reutilizable
```

`index.html`, `thread.html`, `profile.html` y `nuevo-hilo.html` comparten el mismo header y footer; solo cambia el enlace activo (`aria-current="page"`). `login.html` usa un header compacto y un crédito institucional al pie del formulario. Al partirlos, pasar `$paginaActiva` y renderizar la clase `is-active`.

### 4.2 Contrato POST

Todos los formularios de escritura apuntan a `procesar.php` con `method="post"`. Los nombres de campo están normalizados y no dependen del texto visible.

| `accion` | Formulario | Campos |
|---|---|---|
| `login` | `login.html` | `email`, `password`, `recordar`, `redirigir`, `csrf_token` |
| `registro` | `login.html` | `nombre`, `usuario`, `email`, `carrera`, `password`, `password_confirm`, `acepta_normas`, `csrf_token` |
| `crear_hilo` | `nuevo-hilo.html` | `comunidad`, `titulo`, `contenido`, `etiquetas`, `acepta_normas`, `csrf_token` |
| `responder` | `thread.html` | `hilo_id`, `padre_id`, `contenido`, `csrf_token` |
| `reportar` | `thread.html` | `tipo` (`hilo`/`comentario`), `objeto_id`, `motivo`, `detalle`, `csrf_token` |
| `cerrar_sesion` | header | `csrf_token` |

La búsqueda usa `GET buscar.php?q=…` (no es una escritura).

### 4.3 Qué quitar al conectar

- Quitar `data-demo` de cada `<form>`: el listener que intercepta el submit y muestra el toast deja de aplicar y el formulario navega de verdad a `procesar.php`.
- Sustituir el `csrf_token` de demostración por uno real (`hash_equals` en el backend).
- Cambiar los `value` de `hilo_id`, `objeto_id` y `padre_id` por los IDs reales escapados con `htmlspecialchars`.
- Servir `buscar.php`, `procesar.php` y las páginas de éxito/error.
- Mantener las validaciones del cliente **y** repetirlas en PHP: longitud del título, contenido mínimo, pertenencia a la comunidad, permisos para responder y rate limiting.
- Los formularios ya llevan `novalidate`: la validación visible es la de `foro.js`. Si se elimina JS, el backend debe validar y devolver los errores al formulario.

### 4.4 Modelo de datos mínimo sugerido

```
usuarios(id, nombre, usuario, email, password_hash, carrera, nucleo, creado_en, karma)
comunidades(id, slug, nombre, descripcion, orden)
hilos(id, comunidad_id, autor_id, titulo, slug, contenido, estado, fijado, creado_en, actualizado_en)
respuestas(id, hilo_id, autor_id, padre_id, contenido, creado_en, editado_en)
votos(usuario_id, objeto_tipo, objeto_id, valor)  // UNIQUE(usuario_id, objeto_tipo, objeto_id)
reportes(id, reportante_id, objeto_tipo, objeto_id, motivo, detalle, estado, creado_en)
```

`padre_id` es `NULL` para respuestas de primer nivel. El árbol se renderiza recursivamente; limitar la profundidad visual a 6 y colapsar a partir de ahí.

### 4.5 Seguridad mínima del backend

- Escapar toda salida con `htmlspecialchars($valor, ENT_QUOTES, 'UTF-8')`.
- Consultas preparadas (PDO) para todos los `INSERT`/`SELECT`.
- Hash de contraseña con `password_hash` / `password_verify`.
- CSRF por sesión y comprobación de origen en los POST.
- Validar tipo y tamaño de las imágenes antes de moverlas a `uploads/`.
- No confiar en `padre_id`, `hilo_id` ni `comunidad` del cliente sin comprobar que existen y que el usuario puede escribir ahí.

---

## 5. Accesibilidad y responsive

- Un solo `h1` por pantalla; landmarks (`header`, `nav`, `main`, `aside`, `footer`), skip link y `aria-current` en la navegación.
- Controles de voto con `aria-pressed`, contadores con `aria-live` y labels en todos los campos.
- `:focus-visible` visible en todo el sitio; el drawer atrapa el foco y se oculta con `visibility:hidden` al cerrar.
- Breakpoints: 1180, 1024 (el sidebar pasa a drawer), 760 (header en dos filas y filas sin thumbnail). Probado sin overflow horizontal a 320, 375, 768, 1024, 1440 y 1920 px.
- `prefers-reduced-motion` respetado.
- Contraste: tinta `#191813` sobre papel `#F7F4ED` ≈ 16:1; gris `#6B6659` ≈ 5.2:1; naranja de texto `#A64A05` ≈ 5.3:1. El naranja de marca no se usa como color de cuerpo.

---

## 6. Checklist del brief

- [x] Todo el código dentro de `Foro/`.
- [x] Logo real de `assets/logo/` en header y footer; marca recortada para el header y logo completo en el sello del footer.
- [x] Fotografías reales: Wikimedia Commons (UNELLEZ) + Unsplash + retratos de randomuser.me.
- [x] Crédito institucional completo en el footer y en el bloque “Sello institucional”.
- [x] Formularios con `POST`, `procesar.php`, `name` estables y CSRF de demostración.
- [x] Sin Inter/Roboto/Arial/system-ui como fuente principal; sin morado/índigo; sin `rounded-2xl`/`shadow-lg` en la lista.
- [x] Home densa con líneas continuas, voto a la izquierda, sidebar de reglas/comunidades y buscador prominente.
- [x] Hilo con respuestas anidadas, línea vertical, acciones por respuesta y composer.
- [x] Perfil con cabecera, stats, badges de texto y tabs con historial.
- [x] Interacciones: votos, dropdown, drawer, validación, orden, filtro, carga, colapso, cita, preview, reporte.

---

## 7. Notas

- Las cifras, hilos, usuarios, correos y URLs internas (`procesar.php`, `buscar.php`) son de demostración. No hay backend en esta entrega.
- Los datos de demostración están escritos para que se lean como un foro vivo, no como un catálogo de features. Si se conecta a datos reales, reemplazar por consultas y no inventar métricas.
- Las fotos de la UNELLEZ son de Wikimedia Commons y tienen licencia CC BY-SA. Ver [`CREDITOS.md`](CREDITOS.md).
- El logo UNELLEZ se usa como marca institucional de demostración; este prototipo no es un sitio oficial de la universidad, estaba easy este trabajo Jefe pongame algo más difícil...
