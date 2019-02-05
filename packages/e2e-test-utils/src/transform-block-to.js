/**
 * External dependencies
 */
import delay from 'delay';

/**
 * Converts editor's block type.
 *
 * @param {string} name Block name.
 */
export async function transformBlockTo( name ) {
	await page.keyboard.press( 'Escape' );
	await page.click( '.editor-block-switcher__toggle' );
	// Pause for -block-switcher opening animation.
	await delay( 50 );
	await page.click( `.editor-block-types-list__item[aria-label="${ name }"]` );
}
