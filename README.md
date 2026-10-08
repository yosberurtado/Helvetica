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

## Ejecutar en local

Usa módulos ES, así que hay que servirlo (no abrir el archivo con doble clic):

```bash
python3 -m http.server 8000
# abrir http://localhost:8000
```

Funciona tal cual en GitHub Pages, Netlify o Vercel (sitio estático).

## Estructura

- `index.html`: interfaz y el contenido de cada sección (`<template id="tpl-…">`). Edita los textos ahí.
- `css/style.css`: estilos de la interfaz y de los hologramas.
- `js/main.js`: escena 3D (exterior, salas, luces, piso reflectante, bloom), caminata, colisiones y navegación.
- `vendor/three/`: Three.js r160 incluido localmente (licencia MIT).
- `assets/`: fotos reales de proyectos y servicios (ver `assets/README.md`).

## Formulario de contacto

No hay servidor, así que "Enviar" prepara el mensaje y abre el correo
(`contacto@grupokeipoint.com`) o WhatsApp (+56 9 3393 8347). Para recibirlo directo,
conecta el formulario a un servicio como Formspree en `js/main.js` (busca `contact-form`).
