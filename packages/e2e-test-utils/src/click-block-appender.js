/**
 * External dependencies
 */
import delay from 'delay';

/**
 * Clicks the default block appender.
 */
export async function clickBlockAppender() {
	await page.click( '.editor-default-block-appender__content' );
	await delay( 50 );
}
