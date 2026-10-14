# Casa Cuco · web 3D

Sitio web interactivo en 3D de **Casa Cuco**. Por fuera se ve la casa de la marca (silueta
con ojos y cuerno); al entrar se recorre por dentro, a pie, una casa de cinco salas de piedra
facetada y luz verde. En cada sala hay un **holograma con la sección de la web en vivo**
(HTML real: botones, enlaces y formulario funcionan dentro del 3D).

| Sala | Sección |
| --- | --- |
| 01 | Inicio |
| 02 | Nosotros |
| 03 | Proyectos |
| 04 | Servicios |
| 05 | Contacto |

## Cómo navegar

- **Exterior:** arrastra para girar, rueda para acercar, clic en la puerta iluminada (o "Entrar a la casa").
- **Interior:** `W A S D` / flechas para caminar, `Shift` para correr, arrastra para mirar,
  clic en el piso para ir caminando hasta ese punto, `1`–`5` para viajar a cada sala,
  `F` para abrir la sección a pantalla completa. En celular: joystick + arrastrar.
- El menú superior y el minimapa llevan a cualquier sala con un recorrido animado a través de las puertas.
- Enlaces directos: `index.html#proyectos`, `#contacto`, etc.
- Para salir, cruza la puerta de luz de la primera sala o usa "Salir al exterior".

## Publicar en WordPress (plugin)

El archivo listo para subir es `dist/casa-cuco-3d.zip`.

1. **Plugins → Añadir nuevo → Subir plugin**, elige `casa-cuco-3d.zip`, instala y activa.
2. **Páginas → Añadir nueva**, ponle un título y en **Página → Plantilla** elige
   **Casa Cuco 3D – pantalla completa**. Publica y revísala en computador y celular.
3. Para dejarla como portada: **Ajustes → Lectura → Una página estática** y elígela.
4. En **Ajustes → Casa Cuco 3D** se define el correo que recibe los mensajes del formulario.
5. Si usas LiteSpeed Cache, purga la caché después de instalar o actualizar.

El formulario envía con `wp_mail()`. Si los correos no llegan, instala un plugin SMTP (por ejemplo WP Mail SMTP).
Tiene campo trampa, tiempo mínimo y límite de 5 mensajes cada 10 minutos por IP contra el spam.

Para generar el plugin después de cambiar la web: `python3 tools/build-plugin.py`.
El código PHP del plugin está en `wordpress/casa-cuco-3d/`.

## Ejecutar en local

Usa módulos ES, así que hay que servirlo (no abrir el archivo con doble clic):

```bash
python3 -m http.server 8000
# abrir http://localhost:8000
```

Funciona tal cual en GitHub Pages, Netlify o Vercel (sitio estático).

## Estructura

- `index.html`: interfaz y contenido de cada sección (`<template id="tpl-…">`), tomado de casacuco.cl.
- `css/style.css`: estilos con la paleta oficial (#DAFF02, #D9F026, #070707, #151515) y tipografías Labrada, Inter y Troika.
- `js/main.js`: escena 3D. La casa del exterior es la silueta oficial del logo (vectorizada), con los ojos encendidos,
  la luna y la "boca" triangular como puerta de entrada.
- `assets/brand/`: logo, casa con luna, ilustración de manos y favicon oficiales.
- `assets/proyectos/` y `assets/servicios/`: imágenes oficiales optimizadas.
- `vendor/three/`: Three.js r160 incluido localmente (licencia MIT).

## Pendiente para quedar 100 % igual al sitio

- **Tipografía Troika:** copia `troika.ttf` (está en `wp-content/uploads/2026/08/` del WordPress) en `assets/fonts/`
  y agrega su `url(...)` en el `@font-face` al inicio de `css/style.css`. Mientras tanto se usa Bowlby One SC.
- **Imagen de Nosotros:** en el sitio es un fondo (`Sin-titulo-800-x-1000-px-700-x-1000-px.png`) que no venía en el
  respaldo. Mientras tanto se muestra el logo.
- **Instagram y YouTube:** en el sitio los íconos no tienen enlace, por eso no se incluyeron.

## Formulario de contacto

En WordPress envía por el servidor (ver arriba). Como página suelta, sin servidor, "Enviar" abre el correo del
visitante con el mensaje para `contacto@grupokeipoint.com`.
