import { test } from '@wordpress/e2e-test-utils-playwright';
import { seedPost, openPost, collectConsole, suggestionSaved, openNotesSidebar, getMarkers } from '../../helpers';
import { snap, decide, savePost, reload, rawContent, suggest, switchIntent, shot, P, selectWordJumps, flat } from './lib';

test( 'RV-14 reject move after reload', async ( { admin, editor, page, requestUtils } ) => {
	const errors = collectConsole( page );
	const postId = await seedPost( requestUtils, { title: 'ko RV-14' } );
	const ctx = { page, editor, requestUtils };
	const pristine = await rawContent( requestUtils, postId );
	await openPost( admin, editor, postId );
	await switchIntent( page, 'Suggesting' );
	await suggest( 'move', ctx );
	await savePost( page, postId );
	console.log( 'RAW with pending move', ( await rawContent( requestUtils, postId ) ).slice( 0, 700 ) );
	await reload( page, editor );
	await snap( 'RV-14 after save+reload, move pending', ctx, postId );
	console.log( 'INTENT after reload', await page.evaluate( () => { try { return ( window as any ).wp.data.select( 'core/editor' ).getEditorIntent?.(); } catch ( e ) { return 'n/a'; } } ) );
	await decide( page, 'Reject' );
	await page.waitForTimeout( 1000 );
	await snap( 'RV-14 after Reject (unsaved)', ctx, postId );
	await shot( page, 'RV-14-reject-move-after-reload' );
	await savePost( page, postId );
	await reload( page, editor );
	await snap( 'RV-14 after second save+reload', ctx, postId );
	const raw = await rawContent( requestUtils, postId );
	console.log( 'RAW==PRISTINE', raw === pristine, raw.slice( 0, 500 ) );
	console.log( 'CONSOLE', JSON.stringify( errors ) );
} );

test( 'RV-17 canvas vs sidebar', async ( { admin, editor, page, requestUtils } ) => {
	const errors = collectConsole( page );
	const postId = await seedPost( requestUtils, { title: 'ko RV-17' } );
	const ctx = { page, editor, requestUtils };
	await openPost( admin, editor, postId );
	await switchIntent( page, 'Suggesting' );
	await suggest( 'add', ctx );
	const saved = suggestionSaved( page );
	await P( editor, 'Third paragraph' ).click();
	await page.keyboard.press( 'End' );
	await page.keyboard.type( ' SECOND', { delay: 25 } );
	await saved;
	await switchIntent( page, 'Editing' );
	// Sidebar NOT opened. Click the first marker in the canvas.
	const toggle = page.getByRole( 'region', { name: 'Editor top bar' } ).getByRole( 'button', { name: 'All notes', exact: true } );
	console.log( 'ALL NOTES expanded before', await toggle.getAttribute( 'aria-expanded' ) );
	{ const box = await editor.canvas.locator( 'mark.wp-suggestion-add' ).first().boundingBox(); console.log( 'marker box', JSON.stringify( box ) ); await page.mouse.click( box!.x + box!.width / 2, box!.y + box!.height / 2 ); }
	await page.waitForTimeout( 1000 );
	console.log( 'ALL NOTES expanded after marker click', await toggle.getAttribute( 'aria-expanded' ) );
	const accepts = page.getByRole( 'button', { name: 'Accept suggestion' } );
	const rejects = page.getByRole( 'button', { name: 'Reject suggestion' } );
	console.log( 'CANVAS-SIDE buttons: accept', await accepts.count(), 'reject', await rejects.count() );
	const inCanvas = await editor.canvas.getByRole( 'button', { name: /Accept|Reject/ } ).count();
	console.log( 'buttons inside canvas iframe', inCanvas );
	const where = await accepts.evaluateAll( ( els ) => els.map( ( el ) => { let p: any = el; const chain: string[] = []; while ( p && chain.length < 12 ) { if ( p.className && typeof p.className === 'string' ) chain.push( p.className.split( ' ' )[ 0 ] ); p = p.parentElement; } return chain.join( ' < ' ); } ) );
	console.log( 'ACCEPT containers', JSON.stringify( where, null, 1 ) );
	const toolbarBtns = await page.getByRole( 'toolbar', { name: 'Block tools' } ).getByRole( 'button' ).evaluateAll( ( els ) => els.map( ( e ) => e.getAttribute( 'aria-label' ) || e.textContent ) );
	console.log( 'BLOCK TOOLBAR', JSON.stringify( toolbarBtns ) );
	await shot( page, 'RV-17-canvas-floating-note' );
	// Path 1: floating note (no sidebar) accept, for the first marker.
	if ( await accepts.count() ) {
		await accepts.first().click();
		const seen = await page.locator( '.components-snackbar-list' ).getByText( 'Suggestion applied.' ).first().waitFor( { timeout: 8000 } ).then( () => true, () => false );
		console.log( 'FLOATING accept snackbar', seen );
	}
	await page.waitForTimeout( 1000 );
	await snap( 'RV-17 after floating accept', ctx, postId );
	// Path 2: sidebar reject of the second.
	await decide( page, 'Reject', 'SECOND' );
	await page.waitForTimeout( 1000 );
	await snap( 'RV-17 after sidebar reject', ctx, postId );
	await shot( page, 'RV-17-canvas-vs-sidebar' );
	await savePost( page, postId );
	await reload( page, editor );
	await snap( 'RV-17 after save+reload', ctx, postId );
	console.log( 'CONSOLE', JSON.stringify( errors ) );
} );

test( 'RV-18 sequential review of many', async ( { admin, editor, page, requestUtils } ) => {
	const errors = collectConsole( page );
	const postId = await seedPost( requestUtils, { title: 'ko RV-18' } );
	const ctx = { page, editor, requestUtils };
	await openPost( admin, editor, postId );
	await switchIntent( page, 'Suggesting' );
	await suggest( 'attr', ctx ); // 1 heading level
	await suggest( 'format', ctx ); // 2 format "jumps" P1
	await suggest( 'add', ctx ); // 3 add KEEPME P1
	let saved = suggestionSaved( page ); // 4 add TAIL in P2
	await P( editor, 'second paragraph' ).click();
	await page.keyboard.press( 'End' );
	await page.keyboard.type( ' TAIL', { delay: 25 } );
	await saved; await page.waitForTimeout( 500 );
	saved = suggestionSaved( page ); // 5 del "Third" in P3
	await P( editor, 'Third paragraph' ).click();
	await page.keyboard.press( 'Home' );
	await page.keyboard.press( 'Shift+Alt+ArrowRight' );
	await page.keyboard.press( 'Backspace' );
	await saved; await page.waitForTimeout( 500 );
	saved = suggestionSaved( page ); // 6 insert after P3
	await page.keyboard.press( 'End' );
	await page.keyboard.press( 'Enter' );
	await page.keyboard.type( 'NEW BLOCK', { delay: 25 } );
	await saved; await page.waitForTimeout( 500 );
	saved = suggestionSaved( page ); // 8 move P4 down past the list
	await P( editor, 'Fourth paragraph' ).click( { position: { x: 300, y: 10 } } );
	await editor.clickBlockToolbarButton( 'Move down' );
	await saved; await page.waitForTimeout( 800 );
	saved = suggestionSaved( page ); // 7 remove image
	await editor.canvas.locator( '[data-type="core/image"]' ).click();
	await editor.clickBlockOptionsMenuItem( 'Delete' );
	await saved; await page.waitForTimeout( 500 );
	await snap( 'RV-18 eight pending', ctx, postId );
	await shot( page, 'RV-18-eight-pending' );
	await switchIntent( page, 'Editing' );
	const sidebar = await openNotesSidebar( page );
	const accepts = sidebar.getByRole( 'button', { name: 'Accept suggestion' } );
	const rejects = sidebar.getByRole( 'button', { name: 'Reject suggestion' } );
	const start = await accepts.count();
	console.log( 'PENDING before review', start );
	const log: string[] = [];
	for ( let i = 0; i < start; i++ ) {
		const action = i % 2 === 0 ? 'Accept' : 'Reject';
		const thread = sidebar.locator( '.editor-collab-sidebar-panel__thread' ).filter( { has: page.getByRole( 'button', { name: 'Accept suggestion' } ) } ).first();
		const label = ( await thread.locator( '.editor-collab-sidebar-panel__suggestion-summary' ).first().innerText().catch( () => '?' ) ).replace( /\s+/g, ' ' );
		await thread.getByRole( 'button', { name: `${ action } suggestion` } ).click();
		await page.waitForTimeout( 900 );
		const remaining = await accepts.count();
		const snack = ( await page.locator( '.components-snackbar-list .components-snackbar' ).allInnerTexts() ).join( ' / ' );
		log.push( `${ i + 1 }. ${ action } [${ label }] -> remaining ${ remaining } (rejects ${ await rejects.count() }) snack: ${ snack }` );
	}
	console.log( 'REVIEW LOG\n' + log.join( '\n' ) );
	await page.waitForTimeout( 1500 );
	await snap( 'RV-18 after reviewing all (unsaved)', ctx, postId );
	await shot( page, 'RV-18-sequential-review' );
	await savePost( page, postId );
	await reload( page, editor );
	await snap( 'RV-18 after save+reload', ctx, postId );
	console.log( 'RAW', await rawContent( requestUtils, postId ) );
	console.log( 'CONSOLE', JSON.stringify( errors ) );
} );

for ( const first of [ 'Add', 'Delete' ] ) {
	test( `RV-19 interleaved pair, ${ first } first`, async ( { admin, editor, page, requestUtils } ) => {
		const errors = collectConsole( page );
		const postId = await seedPost( requestUtils, { title: `ko RV-19 ${ first }` } );
		const ctx = { page, editor, requestUtils };
		await openPost( admin, editor, postId );
		await switchIntent( page, 'Suggesting' );
		await selectWordJumps( page, editor );
		const saved = suggestionSaved( page );
		await page.keyboard.type( 'leaps', { delay: 30 } );
		await saved;
		await page.waitForTimeout( 2500 );
		await snap( 'RV-19 type-over pending', ctx, postId );
		await switchIntent( page, 'Editing' );
		const sidebar = await openNotesSidebar( page );
		const n = await sidebar.getByRole( 'button', { name: 'Accept suggestion' } ).count();
		console.log( 'ACCEPT BUTTONS for the pair', n );
		if ( n > 1 ) {
			await decide( page, 'Accept', `${ first }:` );
		} else {
			await decide( page, 'Accept' );
		}
		await page.waitForTimeout( 1000 );
		await snap( `RV-19 after first accept (${ first })`, ctx, postId );
		await shot( page, `RV-19-interleaved-${ first.toLowerCase() }-first` );
		if ( await sidebar.getByRole( 'button', { name: 'Accept suggestion' } ).count() ) {
			await decide( page, 'Accept' );
			await page.waitForTimeout( 1000 );
			await snap( 'RV-19 after second accept', ctx, postId );
		}
		await savePost( page, postId );
		await reload( page, editor );
		await snap( 'RV-19 after save+reload', ctx, postId );
		console.log( 'CONSOLE', JSON.stringify( errors ) );
	} );
}

test( 'RV-20 bulk affordance', async ( { admin, editor, page, requestUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'ko RV-20' } );
	const ctx = { page, editor, requestUtils };
	await openPost( admin, editor, postId );
	await switchIntent( page, 'Suggesting' );
	await suggest( 'add', ctx );
	await suggest( 'remove', ctx );
	await suggest( 'attr', ctx );
	await switchIntent( page, 'Editing' );
	const sidebar = await openNotesSidebar( page );
	await page.waitForTimeout( 800 );
	const btns = await page.getByRole( 'button' ).evaluateAll( ( els ) => els.map( ( e ) => ( e.getAttribute( 'aria-label' ) || e.textContent || '' ).trim() ).filter( Boolean ) );
	console.log( 'ALL BUTTONS', JSON.stringify( btns ) );
	console.log( 'BULK MATCHES', JSON.stringify( btns.filter( ( b ) => /\ball\b/i.test( b ) && /accept|reject|apply|resolve/i.test( b ) ) ) );
	console.log( 'SIDEBAR TEXT', ( await sidebar.innerText() ).replace( /\s+/g, ' ' ).slice( 0, 1200 ) );
	// Sidebar header / more menus
	const menus = await sidebar.getByRole( 'button', { name: /Actions|Options|More/ } ).count();
	console.log( 'sidebar menu buttons', menus );
	if ( menus ) {
		await sidebar.getByRole( 'button', { name: /Actions|Options|More/ } ).first().click();
		await page.waitForTimeout( 400 );
		console.log( 'MENU ITEMS', JSON.stringify( await page.getByRole( 'menuitem' ).allInnerTexts() ) );
		await page.keyboard.press( 'Escape' );
	}
	// Command palette
	await page.keyboard.press( 'ControlOrMeta+k' );
	await page.waitForTimeout( 500 );
	await page.keyboard.type( 'suggestion' );
	await page.waitForTimeout( 1200 );
	console.log( 'COMMANDS', JSON.stringify( await page.getByRole( 'option' ).allInnerTexts() ) );
	await page.keyboard.press( 'Escape' );
	await snap( 'RV-20 three pending', ctx, postId );
	await shot( page, 'RV-20-bulk-affordance' );
} );

test( 'RV-21 review while suggesting', async ( { admin, editor, page, requestUtils } ) => {
	const errors = collectConsole( page );
	const postId = await seedPost( requestUtils, { title: 'ko RV-21' } );
	const ctx = { page, editor, requestUtils };
	await openPost( admin, editor, postId );
	await switchIntent( page, 'Suggesting' );
	await suggest( 'add', ctx );
	await suggest( 'remove', ctx );
	const sidebar = await openNotesSidebar( page );
	await page.waitForTimeout( 600 );
	const accepts = sidebar.getByRole( 'button', { name: 'Accept suggestion' } );
	console.log( 'IN SUGGESTING: accept buttons', await accepts.count(), 'enabled', await accepts.first().isEnabled().catch( () => 'n/a' ), 'reject', await sidebar.getByRole( 'button', { name: 'Reject suggestion' } ).count() );
	console.log( 'SIDEBAR TEXT', ( await sidebar.innerText() ).replace( /\s+/g, ' ' ).slice( 0, 800 ) );
	await shot( page, 'RV-21-review-while-suggesting-before' );
	if ( await accepts.count() ) {
		await decide( page, 'Accept', 'KEEPME' );
		await page.waitForTimeout( 1000 );
		await snap( 'RV-21 after accept in Suggesting', ctx, postId );
		await decide( page, 'Reject' );
		await page.waitForTimeout( 1000 );
		await snap( 'RV-21 after reject in Suggesting', ctx, postId );
	} else {
		await snap( 'RV-21 no accept in Suggesting', ctx, postId );
	}
	console.log( 'INTENT menu', await page.evaluate( () => { const s = ( window as any ).wp.data.select( 'core/editor' ); return s.getEditorIntent ? s.getEditorIntent() : 'n/a'; } ) );
	await shot( page, 'RV-21-review-while-suggesting' );
	await savePost( page, postId );
	await reload( page, editor );
	await snap( 'RV-21 after save+reload', ctx, postId );
	console.log( 'CONSOLE', JSON.stringify( errors ) );
} );
