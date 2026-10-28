<?php
/**
 * Plantilla «Casa Cuco 3D – pantalla completa».
 * Página propia, sin encabezado ni pie del tema: la escena ocupa toda la pantalla.
 */
defined( 'ABSPATH' ) || exit;

$ccu3d_body = file_get_contents( CCU3D_DIR . 'templates/body.html' ); // generado desde index.html al construir el plugin
$ccu3d_body = str_replace( array( 'src="assets/', 'href="assets/' ), array( 'src="' . esc_url( CCU3D_URL ) . 'assets/', 'href="' . esc_url( CCU3D_URL ) . 'assets/' ), $ccu3d_body );

$ccu3d_has_seo = ccu3d_has_seo_plugin();

// Si el tema no imprime <title> (temas clásicos antiguos), lo imprime la plantilla; así nunca sale duplicado.
$ccu3d_print_title = ! current_theme_supports( 'title-tag' ) && ! has_action( 'wp_head', '_block_template_render_title_tag' );
?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo( 'charset' ); ?>">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#070707">
<?php if ( ! $ccu3d_has_seo ) : ?>
<meta name="description" content="Creamos historias, personajes y universos narrativos para marcas e instituciones. Desarrollo creativo, storytelling y creatividad sin miedo.">
<?php endif; ?>
<?php if ( $ccu3d_print_title ) : ?>
<title><?php echo esc_html( wp_get_document_title() ); ?></title>
<?php endif; ?>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="modulepreload" href="<?php echo esc_url( CCU3D_URL . 'vendor/three/three.module.min.js' ); ?>">
<?php wp_head(); ?>
</head>
<body <?php body_class( 'casa-cuco-3d' ); ?>>
<?php wp_body_open(); ?>
<?php echo $ccu3d_body; // phpcs:ignore WordPress.Security.EscapeOutput -- HTML propio del plugin ?>
<noscript>
	<div style="position:fixed;inset:0;z-index:40;display:grid;place-content:center;gap:12px;padding:24px;background:#070707;color:#fff;font:16px/1.5 Inter,Arial,sans-serif;text-align:center">
		<p><strong>Casa Cuco</strong></p>
		<p>Estudio de desarrollo creativo</p>
		<p>Esta experiencia interactiva necesita un navegador compatible con contenido 3D. Puedes escribirnos a <a href="mailto:contacto@grupokeipoint.com" style="color:#daff02">contacto@grupokeipoint.com</a>.</p>
	</div>
</noscript>
<script id="casa-cuco-3d-config">window.CASA_CUCO = <?php echo wp_json_encode( array( 'contactUrl' => esc_url_raw( rest_url( 'casa-cuco/v1/contacto' ) ) ) ); ?>;</script>
<script type="module" id="casa-cuco-3d-main" src="<?php echo esc_url( ccu3d_asset( 'js/main.js' ) ); ?>" data-no-optimize="1" data-no-defer="1" data-cfasync="false"></script>
<?php wp_footer(); ?>
</body>
</html>
