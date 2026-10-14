=== Casa Cuco 3D ===
Contributors: grupokeipoint
Requires at least: 6.0
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later

Experiencia 3D de Casa Cuco: el exterior de la casa y cinco salas (Inicio, Nosotros, Proyectos, Servicios y Contacto) con cada sección del sitio proyectada como holograma.

== Instalación ==

1. Plugins → Añadir nuevo → Subir plugin → elige casa-cuco-3d.zip → Instalar ahora → Activar.
2. Páginas → Añadir nueva. Ponle un título y, en Página → Plantilla, elige «Casa Cuco 3D – pantalla completa». Publica.
3. Abre la página y revísala en computador y celular.
4. Para usarla como portada: Ajustes → Lectura → Una página estática → Portada: la página del paso 2.
5. En Ajustes → Casa Cuco 3D puedes cambiar el correo que recibe los mensajes (por defecto contacto@grupokeipoint.com).

Para volver al sitio anterior basta con devolver la portada a la página que tenías en Ajustes → Lectura.

== Notas ==

* La página no usa el encabezado ni el pie del tema ni de Elementor; la escena trae su propio menú.
* El formulario envía por wp_mail(). Si los correos no llegan, configura un plugin SMTP (por ejemplo WP Mail SMTP).
* Si usas LiteSpeed Cache, purga la caché después de activar o actualizar el plugin.
* Tipografía Troika: copia troika.ttf en la carpeta assets/fonts/ del plugin y agrega su url() en el @font-face al inicio de css/style.css.

== Changelog ==

= 1.0.0 =
* Primera versión.
