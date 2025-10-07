<?php
/**
 * Unit tests covering block comments functionality.
 *
 * @package gutenberg
 */

/**
 * Unit tests for block comments with resolution meta.
 *
 * @covers gutenberg_register_block_comment_resolution_meta
 */
class Gutenberg_Block_Comments_Resolution_Meta_Test extends WP_UnitTestCase {

	/**
	 * Tests that the resolution meta is properly registered.
	 */
	public function test_resolution_meta_is_registered() {
		global $wp_meta_keys;

		// Trigger the init hook to ensure meta is registered.
		do_action( 'init' );

		// Check if the meta key is registered for comments.
		$registered = registered_meta_key_exists( 'comment', '_resolution_event' );

		$this->assertTrue( $registered, 'Resolution event meta should be registered for comments' );
	}

	/**
	 * Tests that resolution meta can be set and retrieved.
	 */
	public function test_can_set_and_get_resolution_meta() {
		$post_id = self::factory()->post->create();
		$comment_id = self::factory()->comment->create(
			array(
				'comment_post_ID' => $post_id,
				'comment_type'    => 'block_comment',
			)
		);

		// Set resolution meta.
		update_comment_meta( $comment_id, '_resolution_event', 'resolved' );

		// Retrieve resolution meta.
		$meta_value = get_comment_meta( $comment_id, '_resolution_event', true );

		$this->assertEquals( 'resolved', $meta_value );
	}

	/**
	 * Tests that reopened meta can be set and retrieved.
	 */
	public function test_can_set_and_get_reopened_meta() {
		$post_id = self::factory()->post->create();
		$comment_id = self::factory()->comment->create(
			array(
				'comment_post_ID' => $post_id,
				'comment_type'    => 'block_comment',
			)
		);

		// Set reopened meta.
		update_comment_meta( $comment_id, '_resolution_event', 'reopened' );

		// Retrieve reopened meta.
		$meta_value = get_comment_meta( $comment_id, '_resolution_event', true );

		$this->assertEquals( 'reopened', $meta_value );
	}
}
