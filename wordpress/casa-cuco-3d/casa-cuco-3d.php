<?php
/**
 * Plugin Name:       Casa Cuco 3D
 * Description:       Experiencia 3D de Casa Cuco: exterior de la casa y cinco salas con las secciones del sitio como hologramas. Agrega la plantilla de página «Casa Cuco 3D – pantalla completa» y envía el formulario de contacto por correo desde WordPress.
 * Version:           2.0.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Grupo Keipoint
 * Author URI:        https://grupokeipoint.com/
 * License:           GPL-2.0-or-later
 * Text Domain:       casa-cuco-3d
 */

defined( 'ABSPATH' ) || exit;

define( 'CCU3D_VERSION', '2.0.0' );
define( 'CCU3D_FILE', __FILE__ );
define( 'CCU3D_DIR', plugin_dir_path( __FILE__ ) );
define( 'CCU3D_URL', plugin_dir_url( __FILE__ ) );
define( 'CCU3D_TEMPLATE', 'casa-cuco-3d-pantalla-completa' );
define( 'CCU3D_DEFAULT_EMAIL', 'contacto@grupokeipoint.com' );

/* -------------------------------------------------------------------------
 * Plantilla de página
 * ---------------------------------------------------------------------- */

add_filter( 'theme_page_templates', function ( $templates ) {
	$templates[ CCU3D_TEMPLATE ] = 'Casa Cuco 3D – pantalla completa';
	return $templates;
} );

/** ¿La página actual usa la plantilla del plugin? */
function ccu3d_is_active() {
	return is_singular( 'page' ) && get_page_template_slug( get_queried_object_id() ) === CCU3D_TEMPLATE;
}

add_filter( 'template_include', function ( $template ) {
	return ccu3d_is_active() ? CCU3D_DIR . 'templates/page.php' : $template;
}, 99 );

// La barra de administración empujaría la escena hacia abajo: se oculta solo en esta página.
add_filter( 'show_admin_bar', function ( $show ) {
	return ccu3d_is_active() ? false : $show;
} );

/** URL de un archivo del plugin con versión basada en su fecha de cambio (evita cachés viejas). */
function ccu3d_asset( $path ) {
	$file = CCU3D_DIR . $path;
	$ver  = file_exists( $file ) ? CCU3D_VERSION . '.' . filemtime( $file ) : CCU3D_VERSION;
	return add_query_arg( 'ver', $ver, CCU3D_URL . $path );
}

add_action( 'wp_enqueue_scripts', function () {
	if ( ! ccu3d_is_active() ) {
		return;
	}
	wp_enqueue_style( 'ccu3d-fonts', 'https://fonts.googleapis.com/css2?family=Bowlby+One+SC&family=Inter:wght@400;500;600;700&family=Labrada:wght@400;600;700&display=swap', array(), null );
	wp_enqueue_style( 'ccu3d', CCU3D_URL . 'css/style.css', array( 'ccu3d-fonts' ), CCU3D_VERSION . '.' . filemtime( CCU3D_DIR . 'css/style.css' ) );
}, 20 );

/**
 * La escena ocupa toda la pantalla y trae su propio diseño: se quitan los estilos y scripts
 * del tema y de otros plugins en esta página para que no se mezclen.
 */
function ccu3d_strip_queue( $deps, array $keep ) {
	if ( ! $deps instanceof WP_Dependencies ) {
		return;
	}
	foreach ( (array) $deps->queue as $handle ) {
		if ( ! in_array( $handle, $keep, true ) ) {
			$deps->dequeue( $handle );
		}
	}
}
foreach ( array( 'wp_print_styles', 'wp_print_footer_scripts' ) as $hook ) {
	add_action( $hook, function () {
		if ( ccu3d_is_active() ) {
			ccu3d_strip_queue( wp_styles(), array( 'ccu3d-fonts', 'ccu3d' ) );
		}
	}, 0 );
}
foreach ( array( 'wp_print_scripts', 'wp_print_footer_scripts' ) as $hook ) {
	add_action( $hook, function () {
		if ( ccu3d_is_active() ) {
			ccu3d_strip_queue( wp_scripts(), array() );
		}
	}, 0 );
}

// Evita que LiteSpeed Cache u otros optimizadores combinen o retrasen los módulos de la escena.
add_filter( 'litespeed_optimize_js_excludes', function ( $excludes ) {
	$excludes   = (array) $excludes;
	$excludes[] = 'casa-cuco-3d';
	return $excludes;
} );

// Título del documento (si un plugin SEO está activo, manda el título configurado en él).
function ccu3d_has_seo_plugin() {
	return defined( 'WPSEO_VERSION' ) || class_exists( 'RankMath' ) || defined( 'AIOSEO_VERSION' ) || defined( 'SEOPRESS_VERSION' );
}
add_filter( 'pre_get_document_title', function ( $title ) {
	return ccu3d_is_active() && ! ccu3d_has_seo_plugin() ? 'Casa Cuco | Estudio de desarrollo creativo en Chile' : $title;
}, 20 );

/* -------------------------------------------------------------------------
 * Formulario de contacto (REST)
 * ---------------------------------------------------------------------- */

add_action( 'rest_api_init', function () {
	register_rest_route( 'casa-cuco/v1', '/contacto', array(
		'methods'             => 'POST',
		'callback'            => 'ccu3d_handle_contact',
		'permission_callback' => '__return_true', // formulario público; se protege con trampa, tiempo mínimo y límite por IP.
	) );
} );

function ccu3d_client_ip() {
	$ip = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '';
	return filter_var( $ip, FILTER_VALIDATE_IP ) ? $ip : 'desconocida';
}

function ccu3d_handle_contact( WP_REST_Request $request ) {
	$params = $request->get_json_params();
	if ( ! is_array( $params ) ) {
		$params = $request->get_body_params();
	}

	// Trampa para bots: campo oculto con contenido, o envío en menos de 3 segundos. Se responde como éxito.
	$elapsed = isset( $params['elapsed'] ) ? (int) $params['elapsed'] : 0;
	if ( ! empty( $params['sitio_web'] ) || ( $elapsed > 0 && $elapsed < 3000 ) ) {
		return new WP_REST_Response( array( 'ok' => true ), 200 );
	}

	$name    = isset( $params['name'] ) ? sanitize_text_field( $params['name'] ) : '';
	$raw     = isset( $params['email'] ) ? trim( (string) $params['email'] ) : '';
	$email   = sanitize_email( $raw );
	$company = isset( $params['company'] ) ? sanitize_text_field( $params['company'] ) : '';
	$message = isset( $params['message'] ) ? sanitize_textarea_field( $params['message'] ) : '';

	if ( '' === $name || '' === $message || '' === $raw ) {
		return new WP_Error( 'ccu3d_invalid', 'Completa los campos obligatorios para continuar.', array( 'status' => 400 ) );
	}
	if ( ! is_email( $email ) ) {
		return new WP_Error( 'ccu3d_email', 'Ingresa un correo electrónico válido.', array( 'status' => 400 ) );
	}
	if ( mb_strlen( $name ) > 120 || mb_strlen( $company ) > 160 || mb_strlen( $message ) > 5000 ) {
		return new WP_Error( 'ccu3d_too_long', 'Tu mensaje es demasiado largo. Acórtalo e inténtalo nuevamente.', array( 'status' => 400 ) );
	}

	// Máximo 5 mensajes cada 10 minutos por IP.
	$key   = 'ccu3d_rl_' . md5( ccu3d_client_ip() );
	$count = (int) get_transient( $key );
	if ( $count >= 5 ) {
		return new WP_Error( 'ccu3d_rate', 'Recibimos varios mensajes seguidos. Espera unos minutos e inténtalo nuevamente.', array( 'status' => 429 ) );
	}
	set_transient( $key, $count + 1, 10 * MINUTE_IN_SECONDS );

	$to      = get_option( 'ccu3d_email', CCU3D_DEFAULT_EMAIL );
	$subject = sprintf( 'Nuevo mensaje desde Casa Cuco · %s', $name );
	$body    = "Nombre: {$name}\nCorreo: {$email}\nEmpresa u organización: " . ( '' !== $company ? $company : '—' ) . "\n\n{$message}\n\n—\nEnviado desde " . home_url( '/' );
	$headers = array(
		'Content-Type: text/plain; charset=UTF-8',
		sprintf( 'Reply-To: %s <%s>', str_replace( array( '<', '>', '"' ), '', $name ), $email ),
	);

	if ( ! wp_mail( $to, $subject, $body, $headers ) ) {
		return new WP_Error( 'ccu3d_mail', 'No pudimos enviar tu mensaje. Inténtalo nuevamente o escríbenos a ' . CCU3D_DEFAULT_EMAIL . '.', array( 'status' => 500 ) );
	}
	return new WP_REST_Response( array( 'ok' => true ), 200 );
}

/* -------------------------------------------------------------------------
 * Ajustes
 * ---------------------------------------------------------------------- */

add_action( 'admin_init', function () {
	register_setting( 'ccu3d', 'ccu3d_email', array(
		'type'              => 'string',
		'default'           => CCU3D_DEFAULT_EMAIL,
		'sanitize_callback' => function ( $value ) {
			$value = sanitize_email( $value );
			return is_email( $value ) ? $value : CCU3D_DEFAULT_EMAIL;
		},
	) );
} );

add_action( 'admin_menu', function () {
	add_options_page( 'Casa Cuco 3D', 'Casa Cuco 3D', 'manage_options', 'casa-cuco-3d', 'ccu3d_settings_page' );
} );

add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), function ( $links ) {
	array_unshift( $links, '<a href="' . esc_url( admin_url( 'options-general.php?page=casa-cuco-3d' ) ) . '">Ajustes</a>' );
	return $links;
} );

function ccu3d_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$pages = get_pages( array( 'meta_key' => '_wp_page_template', 'meta_value' => CCU3D_TEMPLATE ) );
	?>
	<div class="wrap">
		<h1>Casa Cuco 3D</h1>
		<form method="post" action="options.php">
			<?php settings_fields( 'ccu3d' ); ?>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="ccu3d_email">Correo que recibe los mensajes</label></th>
					<td>
						<input name="ccu3d_email" id="ccu3d_email" type="email" class="regular-text" value="<?php echo esc_attr( get_option( 'ccu3d_email', CCU3D_DEFAULT_EMAIL ) ); ?>">
						<p class="description">Los mensajes del formulario de Contacto llegan aquí. Responder al correo le contesta directo a quien escribió.</p>
					</td>
				</tr>
			</table>
			<?php submit_button( 'Guardar cambios' ); ?>
		</form>

		<h2>Cómo publicarla</h2>
		<ol>
			<li>Ve a <strong>Páginas → Añadir nueva</strong> y ponle un título (por ejemplo «Casa Cuco»).</li>
			<li>En el panel <strong>Página → Plantilla</strong>, elige <strong>Casa Cuco 3D – pantalla completa</strong> y publica. El contenido del editor no se usa.</li>
			<li>Revisa la página. Cuando quieras que sea la portada, ve a <strong>Ajustes → Lectura → Una página estática</strong> y elígela como portada.</li>
		</ol>
		<?php if ( $pages ) : ?>
			<p><strong>Páginas que ya usan la plantilla:</strong>
			<?php
			echo implode( ', ', array_map( function ( $p ) {
				return '<a href="' . esc_url( get_permalink( $p ) ) . '" target="_blank" rel="noopener">' . esc_html( get_the_title( $p ) ) . '</a>';
			}, $pages ) );
			?>
			</p>
		<?php endif; ?>
		<p>Si los mensajes no llegan, el hosting puede estar bloqueando el envío de correos: instala un plugin SMTP (por ejemplo WP Mail SMTP) y configúralo con la cuenta de correo del dominio.</p>
	</div>
	<?php
}
