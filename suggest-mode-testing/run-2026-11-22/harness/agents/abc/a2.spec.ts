import { test } from '@wordpress/e2e-test-utils-playwright';
import { seedPost, openPost, switchIntent, suggestionSaved, getMarkers, getBlocks, getNotes, shot, collectConsole } from '../../helpers';
import { log, notices, modeMenu, shortcutCombos, brief, briefNotes } from './util';

const NAMES = [ 'core/editor/intent-edit', 'core/editor/intent-suggest', 'core/editor/intent-view' ];

test( 'MS-03b menu state', async ( { admin, editor, page, requestUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'abc MS-03b' } );
	const postId2 = await seedPost( requestUtils, { title: 'abc MS-08b second' } );
	await openPost( admin, editor, postId );
	log( 'menu initial', await modeMenu( page ) );
	await page.keyboard.press( 'Escape' );
	await switchIntent( page, 'Suggesting' );
	log( 'menu suggesting', await modeMenu( page ) );
	await shot( page, 'MS-03-suggesting-active-in-menu' );
	await page.keyboard.press( 'Escape' );
	await switchIntent( page, 'Editing' );
	log( 'menu editing', await modeMenu( page ) );
	await shot( page, 'MS-05-back-to-editing' );
	await page.keyboard.press( 'Escape' );
	// MS-08
	await switchIntent( page, 'Suggesting' );
	await page.reload();
	await editor.canvas.locator( '.is-root-container' ).first().waitFor();
	log( 'menu after reload', await modeMenu( page ) );
	await shot( page, 'MS-08-mode-after-reload' );
	await page.keyboard.press( 'Escape' );
	await switchIntent( page, 'Suggesting' );
	await openPost( admin, editor, postId2 );
	log( 'menu second post', await modeMenu( page ) );
	await shot( page, 'MS-08-second-post-mode' );
} );

test( 'MS-10 code editor', async ( { admin, editor, page, requestUtils } ) => {
	const errors = collectConsole( page );
	const postId = await seedPost( requestUtils, { title: 'abc MS-10' } );
	await openPost( admin, editor, postId );
	await switchIntent( page, 'Suggesting' );
	const p = editor.canvas.locator( '[data-type="core/paragraph"]' ).first();
	await p.click();
	await page.keyboard.press( 'End' );
	const saved = suggestionSaved( page );
	await page.keyboard.type( ' INSERTED', { delay: 25 } );
	await saved;
	log( 'markers', brief( await getMarkers( editor ) ) );
	log( 'menu suggesting', await modeMenu( page ) );
	const code = page.getByRole( 'menuitemradio', { name: /^Code editor/ } );
	await code.hover();
	await page.waitForTimeout( 600 );
	log( 'tooltip', await page.locator( '[role="tooltip"]' ).allInnerTexts() );
	log( 'code described-by', await code.evaluate( ( el ) => { const id = el.getAttribute( 'aria-describedby' ); return id ? id.split( ' ' ).map( ( i ) => document.getElementById( i )?.textContent ) : null; } ) );
	await shot( page, 'MS-10-code-editor-disabled-in-suggesting' );
	await code.click( { force: true } ).catch( ( e ) => log( 'click err', String( e ).slice( 0, 100 ) ) );
	await page.keyboard.press( 'Escape' );
	log( 'text editor visible after click', await page.locator( '.editor-post-text-editor' ).isVisible() );
	// Shortcut route.
	await p.click();
	await page.keyboard.press( 'Shift+Alt+Meta+M' );
	await page.waitForTimeout( 500 );
	log( 'text editor visible after shortcut', await page.locator( '.editor-post-text-editor' ).isVisible() );
	log( 'notices after shortcut', await notices( page ) );
	await shot( page, 'MS-10-shortcut-refused' );
	// Command palette route.
	await page.keyboard.press( 'Meta+K' );
	const palette = page.getByRole( 'combobox', { name: /Search commands/i } );
	if ( await palette.count() ) {
		await palette.fill( 'code editor' );
		await page.waitForTimeout( 800 );
		log( 'palette options', await page.getByRole( 'option' ).allInnerTexts() );
		const opt = page.getByRole( 'option', { name: /code editor/i } ).first();
		if ( await opt.count() ) {
			await opt.click();
			await page.waitForTimeout( 500 );
		} else {
			await page.keyboard.press( 'Escape' );
		}
	} else {
		log( 'palette', 'not found' );
	}
	log( 'text editor visible after palette', await page.locator( '.editor-post-text-editor' ).isVisible() );
	log( 'notices after palette', await notices( page ) );
	await page.keyboard.press( 'Escape' );
	// Back to Editing with a pending suggestion: is the code editor reachable?
	await switchIntent( page, 'Editing' );
	log( 'menu editing with pending', await modeMenu( page ) );
	await page.getByRole( 'menuitemradio', { name: /^Code editor/ } ).hover();
	await page.waitForTimeout( 600 );
	log( 'tooltip editing', await page.locator( '[role="tooltip"]' ).allInnerTexts() );
	await shot( page, 'MS-10-editing-with-pending-suggestion' );
	await page.keyboard.press( 'Escape' );
	await p.click();
	await page.keyboard.press( 'Shift+Alt+Meta+M' );
	await page.waitForTimeout( 500 );
	log( 'text editor visible in editing w/ pending', await page.locator( '.editor-post-text-editor' ).isVisible() );
	log( 'notices', await notices( page ) );
	log( 'blocks', ( await getBlocks( page ) ).length );
	log( 'block1', ( await getBlocks( page ) )[ 1 ] );
	log( 'notes', briefNotes( await getNotes( requestUtils, postId ) ).map( ( n ) => n.id ) );
	log( 'errors', errors );
} );

test( 'MS-09 site editor', async ( { admin, editor, page, requestUtils } ) => {
	const errors = collectConsole( page );
	const themes = await requestUtils.rest( { path: '/wp/v2/themes', params: { status: 'active' } } );
	log( 'active theme', themes.map( ( t: any ) => ( { stylesheet: t.stylesheet, block: t.is_block_theme } ) ) );
	await page.goto( '/wp-admin/site-editor.php' );
	await page.waitForTimeout( 3000 );
	log( 'url', page.url() );
	log( 'body text', ( await page.locator( 'body' ).innerText() ).slice( 0, 400 ) );
	await shot( page, 'MS-09-site-editor-landing' );
	log( 'errors', errors );
} );
