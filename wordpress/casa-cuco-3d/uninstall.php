<?php
// Al borrar el plugin se elimina su único ajuste guardado.
defined( 'WP_UNINSTALL_PLUGIN' ) || exit;
delete_option( 'ccu3d_email' );
