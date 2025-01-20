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
	$settings['typesNotSupportedByServer'] = array();

	// Check if WebP images can be edited.
	if ( ! wp_image_editor_supports( array( 'mime_type' => 'image/webp' ) ) ) {
		$settings['typesNotSupportedByServer']['image/webp'] = true;
	}

	// Check if AVIF images can be edited.
	if ( ! wp_image_editor_supports( array( 'mime_type' => 'image/avif' ) ) ) {
		$settings['typesNotSupportedByServer']['image/avif'] = true;
	}

	// Check if HEIC images can be edited.
	if ( ! wp_image_editor_supports( array( 'mime_type' => 'image/heic' ) ) ) {
		$settings['typesNotSupportedByServer']['image/heic'] = true;
	}

	return $settings;
}
add_filter( 'block_editor_settings_all', 'gutenberg_extend_block_editor_settings_with_image_support' );