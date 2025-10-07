<?php

/**
 * Adds support for block comments to the built-in post types.
 *
 * @return void
 */
function gutenberg_block_comment_add_post_type_support() {
	$post_types = array( 'post', 'page' );

	foreach ( $post_types as $post_type ) {
		if ( ! post_type_supports( $post_type, 'editor' ) ) {
			continue;
		}

		$supports        = get_all_post_type_supports( $post_type );
		$editor_supports = array( 'block-comments' => true );

		// `add_post_type_support()` doesn't merge support sub-properties, so we explicitly merge it here.
		if ( is_array( $supports['editor'] ) && isset( $supports['editor'][0] ) && is_array( $supports['editor'][0] ) ) {
			$editor_supports = array_merge( $editor_supports, $supports['editor'][0] );
		}

		add_post_type_support( $post_type, 'editor', $editor_supports );
	}
}
add_action( 'init', 'gutenberg_block_comment_add_post_type_support' );

/**
 * Register comment meta for resolution events.
 *
 * @return void
 */
function gutenberg_register_block_comment_resolution_meta() {
	register_meta(
		'comment',
		'_resolution_event',
		array(
			'type'         => 'string',
			'description'  => 'Resolution event type (resolved or reopened)',
			'single'       => true,
			'show_in_rest' => true,
		)
	);
}
add_action( 'init', 'gutenberg_register_block_comment_resolution_meta' );

/**
 * Updates the comment type for avatars in the WordPress REST API.
 *
 * This function adds the 'block_comment' type to the list of comment types
 * for which avatars should be retrieved in the WordPress REST API.
 *
 * @param array $comment_type The array of comment types.
 * @return array The updated array of comment types.
 */
if ( ! function_exists( 'update_get_avatar_comment_type' ) ) {
	function update_get_avatar_comment_type( $comment_type ) {
		$comment_type[] = 'block_comment';
		return $comment_type;
	}
	add_filter( 'get_avatar_comment_types', 'update_get_avatar_comment_type' );
}

/**
 * Excludes block comments from the admin comments query.
 *
 * This function modifies the comments query to exclude comments of type 'block_comment'
 * when the query is for comments in the WordPress admin.
 *
 * @global wpdb $wpdb WordPress database abstraction object.
 *
 * @param string[] $clauses The current SQL clauses for the comments query.
 * @param WP_Comment_Query $query The current comments query.
 *
 * @return string[] The modified SQL clauses for the comments query.
 */
if ( ! function_exists( 'exclude_block_comments_from_admin' ) ) {
	function exclude_block_comments_from_admin( $clauses, $query ) {
		// Only modify the query if it's for comments
		if ( isset( $query->query_vars['type'] ) && '' === $query->query_vars['type'] ) {
			$query->set( 'type', '' );

			global $wpdb;
			$clauses['where'] .= " AND {$wpdb->comments}.comment_type != 'block_comment'";
		}

		return $clauses;
	}
	add_action( 'comments_clauses', 'exclude_block_comments_from_admin', 10, 2 );
}

/**
 * Filter the comment count query to exclude block_comment type comments.
 *
 * Note: we need to make sure this doesn't interfere with the "Editorial Comments" view
 * once https://github.com/WordPress/gutenberg/issues/71621 is implemented.
 *
 * @param string $query The SQL query string.
 * @return string The modified SQL query string.
 */
function gutenberg_filter_comment_count_query_exclude_block_comments( $query ) {
	// Adjust the query if it is a comment count query.
	if ( str_starts_with( $query, 'SELECT comment_post_ID, COUNT(comment_ID) as num_comments FROM' ) && str_contains( $query, 'comment_approved' ) ) {
		if ( ! str_contains( $query, "comment_type != 'block_comment'" ) ) {
			$query = str_replace( 'comment_approved', "comment_type != 'block_comment' AND comment_approved", $query );
		}
	}
	return $query;
}
add_filter( 'query', 'gutenberg_filter_comment_count_query_exclude_block_comments' );

/**
 * Bypass REST API validation for resolution comments.
 *
 * The REST API validates both empty content and duplicates before WordPress core filters run,
 * so we need to handle resolution comments at the REST level.
 *
 * @param true|WP_Error $result Response to replace the request with.
 * @param WP_REST_Server $server Server instance.
 * @param WP_REST_Request $request Request used to generate the response.
 * @return true|WP_Error Modified response.
 */
function gutenberg_bypass_rest_validation_for_resolution_comments( $result, $server, $request ) {
	// Only handle comment creation requests.
	if ( $request->get_route() !== '/wp/v2/comments' || $request->get_method() !== 'POST' ) {
		return $result;
	}

	// Check if this is a block_comment with resolution event meta.
	$comment_type = $request->get_param( 'comment_type' );
	$meta = $request->get_param( 'meta' );
	$has_resolution_event = isset( $meta['_resolution_event'] ) &&
		( 'resolved' === $meta['_resolution_event'] || 'reopened' === $meta['_resolution_event'] );

	if ( 'block_comment' === $comment_type && $has_resolution_event ) {
		// Temporarily bypass both empty content and duplicate validation for resolution comments.
		add_filter( 'allow_empty_comment', '__return_true', 50 );
		add_filter( 'duplicate_comment_id', '__return_false', 50 );
	}

	return $result;
}
add_filter( 'rest_pre_dispatch', 'gutenberg_bypass_rest_validation_for_resolution_comments', 10, 3 );

/**
 * Disable WordPress duplicate comment detection for resolution comments.
 *
 * @param int|false $duplicate_id ID of the duplicate comment, or false if not duplicate.
 * @param array $commentdata Comment data array.
 * @return int|false Modified duplicate check result.
 */
function gutenberg_disable_duplicate_detection_for_resolution_comments( $duplicate_id, $commentdata ) {
	// Check if this is a block_comment with resolution event meta.
	if ( isset( $commentdata['comment_type'] ) && 'block_comment' === $commentdata['comment_type'] ) {
		// For block comments, we need to check if there's a resolution event in the current request.
		// This is handled by the REST API bypass filter above.
		// The duplicate check is disabled in rest_pre_dispatch for resolution events.
	}

	return $duplicate_id;
}
add_filter( 'duplicate_comment_id', 'gutenberg_disable_duplicate_detection_for_resolution_comments', 10, 2 );
