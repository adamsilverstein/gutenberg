<?php
/**
 * PHP and WordPress configuration compatibility functions for the Gutenberg
 * editor plugin changes related to REST API.
 *
 * @package gutenberg
 */

// When querying terms for a given taxonomy in the REST API, respect the default
// query arguments set for that taxonomy upon registration.
function gutenberg_respect_taxonomy_default_args_in_rest_api( $args ) {
	// If a `post` argument is provided, the Terms controller will use
	// `wp_get_object_terms`, which respects the default query arguments,
	// so we don't need to do anything.
	if ( ! empty( $args['post'] ) ) {
		return $args;
	}

	$t = get_taxonomy( $args['taxonomy'] );
	if ( isset( $t->args ) && is_array( $t->args ) ) {
		$args = array_merge( $args, $t->args );
	}
	return $args;
}
add_action(
	'registered_taxonomy',
	function ( $taxonomy ) {
		add_filter( "rest_{$taxonomy}_query", 'gutenberg_respect_taxonomy_default_args_in_rest_api' );
	}
);
add_action(
	'unregistered_taxonomy',
	function ( $taxonomy ) {
		remove_filter( "rest_{$taxonomy}_query", 'gutenberg_respect_taxonomy_default_args_in_rest_api' );
	}
);

/**
 * Adds the default template part areas to the REST API index.
 *
 * This function exposes the default template part areas through the WordPress REST API.
 * Note: This function backports into the wp-includes/rest-api/class-wp-rest-server.php file.
 *
 * @param WP_REST_Response $response REST API response.
 * @return WP_REST_Response Modified REST API response with default template part areas.
 */
function gutenberg_add_default_template_part_areas_to_index( WP_REST_Response $response ) {
	$response->data['default_template_part_areas'] = get_allowed_block_template_part_areas();
	return $response;
}

add_filter( 'rest_index', 'gutenberg_add_default_template_part_areas_to_index' );

/**
 * Adds the default template types to the REST API index.
 *
 * This function exposes the default template types through the WordPress REST API.
 * Note: This function backports into the wp-includes/rest-api/class-wp-rest-server.php file.
 *
 * @param WP_REST_Response $response REST API response.
 * @return WP_REST_Response Modified REST API response with default template part areas.
 */
function gutenberg_add_default_template_types_to_index( WP_REST_Response $response ) {
	$indexed_template_types = array();
	foreach ( get_default_block_template_types() as $slug => $template_type ) {
		$template_type['slug']    = (string) $slug;
		$indexed_template_types[] = $template_type;
	}

	$response->data['default_template_types'] = $indexed_template_types;
	return $response;
}

add_filter( 'rest_index', 'gutenberg_add_default_template_types_to_index' );


/**
 * Validates specific image mime types before upload processing.
 *
 * @param mixed           $response Response to replace the requested version with.
 * @param WP_REST_Server  $server   Server instance.
 * @param WP_REST_Request $request  Request used to generate the response.
 * @return mixed
 */
function gutenberg_validate_image_mime_type( $response, $server, $request ) {
	// Only handle media creation requests
	if ( 'POST' !== $request->get_method() || '/wp/v2/media' !== $request->get_route() ) {
		return $response;
	}

	$files = $request->get_file_params();
	if ( empty( $files ) ) {
		return $response;
	}

	$file = reset( $files );
	if ( empty( $file['type'] ) ) {
		return $response;
	}

	$unsupported_message = __( 'The web server cannot generate responsive image sizes for this image. Convert it to JPEG or PNG before uploading.', 'gutenberg' );

	// Check if WebP images can be edited.
	if ( $file['type'] === 'image/webp' && ! wp_image_editor_supports( array( 'mime_type' => 'image/webp' ) ) ) {
		return new WP_Error(
			'rest_upload_image_type_not_supported',
			$unsupported_message,
			array( 'status' => 400 )
		);
	}

	// Check if AVIF images can be edited.
	if ( $file['type'] === 'image/avif' && ! wp_image_editor_supports( array( 'mime_type' => 'image/avif' ) ) ) {
		return new WP_Error(
			'rest_upload_image_type_not_supported',
			$unsupported_message,
			array( 'status' => 400 )
		);
	}

	// Check if HEIC images can be edited.
	if ( $file['type'] === 'image/heic' && ! wp_image_editor_supports( array( 'mime_type' => 'image/heic' ) ) ) {
		return new WP_Error(
			'rest_upload_image_type_not_supported',
			$unsupported_message,
			array( 'status' => 400 )
		);
	}

	return $response;
}
add_filter( 'rest_pre_dispatch', 'gutenberg_validate_image_mime_type', 10, 3 );