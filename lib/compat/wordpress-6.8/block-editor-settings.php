<?php
/**
 * Block Editor Settings compatibility for WordPress 6.8
 *
 * Note: This will probably be a part of the get_default_block_editor_settings function during backport.
 *
 * @package gutenberg
 */

/**
 * Extends the block editor settings with image format support checks.
 *
 * @param array $settings The current block editor settings.
 * @return array Modified settings.
 */
function gutenberg_extend_block_editor_settings_with_image_support( $settings ) {
	$settings['serverUnsupportedTypes'] = array();

	$all_types = wp_get_mime_types();
	foreach ( $all_types as $type ) {
		// Check if image type can be edited, image types start with 'image/'.
		if ( str_starts_with( $type, 'image/' ) && ! wp_image_editor_supports( array( 'mime_type' => $type ) ) ) {
			$settings['serverUnsupportedTypes'][] = $type;
		}
	}
	return $settings;
}
add_filter( 'block_editor_settings_all', 'gutenberg_extend_block_editor_settings_with_image_support' );
