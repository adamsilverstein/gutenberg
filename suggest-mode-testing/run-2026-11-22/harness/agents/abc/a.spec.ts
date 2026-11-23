import { test } from '@wordpress/e2e-test-utils-playwright';
import { seedPost, openPost, switchIntent, suggestionSaved, getMarkers, getBlocks, getNotes, getSidebarNoteTexts, shot, collectConsole } from '../../helpers';
import { log, notices, intent, openOptions, menuSnapshot, shortcutCombos, editableCount, brief, briefNotes } from './util';

const NAMES = [ 'core/editor/intent-edit', 'core/editor/intent-suggest', 'core/editor/intent-view' ];

test( 'MS-01 MS-02 MS-04 MS-07 MS-11 gate and viewing', async ( { admin, editor, page, requestUtils } ) => {
	const errors = collectConsole( page );
	const postId = await seedPost( requestUtils, { title: 'abc MS-01' } );
	await openPost( admin, editor, postId );
	log( 'flag', await page.evaluate( () => ( { flag: ( window as any ).__experimentalSuggestionMode, exps: Object.keys( window ).filter( ( k ) => /experimental/i.test( k ) ) } ) ) );
	await openOptions( page );
	log( 'menu', await menuSnapshot( page ) );
	log( 'viewing items', await page.getByRole( 'menuitemradio', { name: /View/i } ).count() );
	await shot( page, 'MS-02-mode-group-editing-suggesting' );
	await shot( page, 'MS-04-no-viewing-menu-item' );
	await page.keyboard.press( 'Escape' );
	log( 'shortcuts', await shortcutCombos( page, NAMES ) );
	// Old Viewing shortcut: secondary+c.
	const before = await getBlocks( page );
	await editor.canvas.locator( '[data-type="core/paragraph"]' ).first().click();
	await page.keyboard.press( 'Shift+Alt+Meta+C' );
	log( 'notices after old view shortcut', await notices( page ) );
	log( 'intent after old view shortcut', await intent( page ) );
	const after = await getBlocks( page );
	log( 'blocks changed', JSON.stringify( before ) !== JSON.stringify( after ) );
	log( 'editables', await editableCount( editor ) );
	log( 'errors', errors );
} );

test( 'MS-03 MS-05 switch via menu', async ( { admin, editor, page, requestUtils } ) => {
	const errors = collectConsole( page );
	const postId = await seedPost( requestUtils, { title: 'abc MS-03' } );
	await openPost( admin, editor, postId );
	log( 'editables editing', await editableCount( editor ) );
	await switchIntent( page, 'Suggesting' );
	log( 'notices', await notices( page ) );
	log( 'snackbar text', await page.getByTestId( 'snackbar' ).allInnerTexts() );
	log( 'intent', await intent( page ) );
	await openOptions( page );
	log( 'menu', ( await menuSnapshot( page ) ).filter( ( g ) => /mode/i.test( g.group || '' ) || g.items.some( ( i ) => /Suggesting/.test( i.text ) ) ) );
	await shot( page, 'MS-03-suggesting-active-in-menu' );
	await page.keyboard.press( 'Escape' );
	// Prove suggesting: type and expect a marker.
	const p = editor.canvas.locator( '[data-type="core/paragraph"]' ).first();
	await p.click();
	await page.keyboard.press( 'End' );
	const saved = suggestionSaved( page );
	await page.keyboard.type( ' SUGG', { delay: 25 } );
	await saved;
	log( 'markers suggesting', brief( await getMarkers( editor ) ) );
	log( 'notes suggesting', briefNotes( await getNotes( requestUtils, postId ) ) );

	// MS-05
	await switchIntent( page, 'Editing' );
	log( 'notices after editing', await notices( page ) );
	log( 'snackbar text', await page.getByTestId( 'snackbar' ).allInnerTexts() );
	log( 'intent', await intent( page ) );
	log( 'editables editing again', await editableCount( editor ) );
	const p3 = editor.canvas.locator( '[data-type="core/paragraph"]' ).nth( 2 );
	await p3.click();
	await page.keyboard.press( 'End' );
	await page.keyboard.type( ' DIRECT', { delay: 25 } );
	await page.waitForTimeout( 2500 );
	log( 'markers after direct', brief( await getMarkers( editor ) ) );
	log( 'block3', ( await getBlocks( page ) )[ 3 ] );
	log( 'notes after direct', briefNotes( await getNotes( requestUtils, postId ) ).length );
	await openOptions( page );
	log( 'menu', ( await menuSnapshot( page ) ).filter( ( g ) => g.items.some( ( i ) => /Suggesting/.test( i.text ) ) ) );
	await shot( page, 'MS-05-back-to-editing' );
	await page.keyboard.press( 'Escape' );
	log( 'errors', errors );
} );

test( 'MS-06 shortcut cycle', async ( { admin, editor, page, requestUtils } ) => {
	const errors = collectConsole( page );
	const postId = await seedPost( requestUtils, { title: 'abc MS-06' } );
	await openPost( admin, editor, postId );
	log( 'shortcuts', await shortcutCombos( page, NAMES ) );
	await editor.canvas.locator( '[data-type="core/paragraph"]' ).first().click();
	const seq: any[] = [];
	const step = async ( label: string, keys: string ) => {
		await page.evaluate( () => ( window as any ).wp.data.dispatch( 'core/notices' ).removeAllNotices( 'snackbar' ) ).catch( () => {} );
		await page.keyboard.press( keys );
		await page.waitForTimeout( 400 );
		seq.push( { label, intent: await intent( page ), snack: await page.getByTestId( 'snackbar' ).allInnerTexts() } );
	};
	await step( 'X (suggest)', 'Shift+Alt+Meta+X' );
	await shot( page, 'MS-06-shortcut-suggesting' );
	await step( 'X again (same mode)', 'Shift+Alt+Meta+X' );
	await step( 'Z (edit)', 'Shift+Alt+Meta+Z' );
	await shot( page, 'MS-06-shortcut-editing' );
	await step( 'Z again', 'Shift+Alt+Meta+Z' );
	await step( 'C (old view)', 'Shift+Alt+Meta+C' );
	await step( 'X', 'Shift+Alt+Meta+X' );
	log( 'sequence', seq );
	// did any shortcut leak a character into content?
	log( 'block1', ( await getBlocks( page ) )[ 1 ].content );
	// focus in top bar too
	await page.getByRole( 'region', { name: 'Editor top bar' } ).getByRole( 'button', { name: 'Options' } ).focus();
	await step( 'Z from top bar focus', 'Shift+Alt+Meta+Z' );
	log( 'sequence2', seq.slice( -1 ) );
	// Keyboard shortcuts help modal listing
	await page.keyboard.press( 'Control+Alt+H' );
	const modal = page.getByRole( 'dialog', { name: 'Keyboard shortcuts' } );
	if ( await modal.count() ) {
		log( 'modal intent rows', await modal.locator( 'li' ).filter( { hasText: /Switch to/ } ).allInnerTexts() );
		await modal.locator( 'li' ).filter( { hasText: /Switch to Suggesting/ } ).scrollIntoViewIfNeeded().catch( () => {} );
		await shot( page, 'MS-06-shortcut-help-modal' );
	} else {
		log( 'modal', 'not opened' );
	}
	log( 'errors', errors );
} );

test( 'MS-08 session scoped', async ( { admin, editor, page, requestUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'abc MS-08' } );
	const postId2 = await seedPost( requestUtils, { title: 'abc MS-08 second' } );
	await openPost( admin, editor, postId );
	await switchIntent( page, 'Suggesting' );
	log( 'intent before reload', await intent( page ) );
	log( 'prefs', await page.evaluate( () => JSON.stringify( ( window as any ).wp.data.select( 'core/preferences' ).get( 'core', 'editorIntent' ) ?? null ) ) );
	await page.reload();
	await editor.canvas.locator( '.is-root-container' ).first().waitFor();
	log( 'intent after reload', await intent( page ) );
	await openOptions( page );
	log( 'menu after reload', ( await menuSnapshot( page ) ).filter( ( g ) => g.items.some( ( i ) => /Suggesting/.test( i.text ) ) ) );
	await shot( page, 'MS-08-mode-after-reload' );
	await page.keyboard.press( 'Escape' );
	const p = editor.canvas.locator( '[data-type="core/paragraph"]' ).first();
	await p.click();
	await page.keyboard.press( 'End' );
	await page.keyboard.type( ' AFTERRELOAD', { delay: 25 } );
	await page.waitForTimeout( 2500 );
	log( 'markers', brief( await getMarkers( editor ) ) );
	log( 'block1', ( await getBlocks( page ) )[ 1 ].content );
	log( 'notes', ( await getNotes( requestUtils, postId ) ).length );
	// Across posts: set suggesting here, open another post.
	await switchIntent( page, 'Suggesting' );
	page.on( 'dialog', ( d ) => d.accept() );
	await openPost( admin, editor, postId2 );
	log( 'intent on second post', await intent( page ) );
	await openOptions( page );
	log( 'menu second post', ( await menuSnapshot( page ) ).filter( ( g ) => g.items.some( ( i ) => /Suggesting/.test( i.text ) ) ) );
	await shot( page, 'MS-08-second-post-mode' );
	await page.keyboard.press( 'Escape' );
	const allPrefs = await page.evaluate( () => {
		const s = ( window as any ).wp.data.select( 'core/preferences' );
		return JSON.stringify( [ s.get( 'core', 'editorIntent' ), s.get( 'core/edit-post', 'editorIntent' ), s.get( 'core', 'intent' ) ] );
	} );
	log( 'prefs', allPrefs );
	log( 'localStorage intent keys', await page.evaluate( () => Object.keys( localStorage ).filter( ( k ) => /intent/i.test( k ) || /intent/i.test( localStorage.getItem( k ) || '' ) ) ) );
} );
