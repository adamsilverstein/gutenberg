import { test } from '@wordpress/e2e-test-utils-playwright';
import { seedPost, openPost, collectConsole, suggestionSaved, openNotesSidebar, getMarkers, getNotes, getBlocks } from '../../helpers';
import { snap, savePost, reload, rawContent, suggest, switchIntent, shot, P, flat, threads } from './lib';

const checkedIntent = async ( page: any ) => {
	await page.getByRole( 'region', { name: 'Editor top bar' } ).getByRole( 'button', { name: 'Options' } ).click();
	await page.waitForTimeout( 300 );
	const t = await page.locator( '[role="menuitemradio"][aria-checked="true"]' ).allInnerTexts();
	await page.keyboard.press( 'Escape' );
	return t.map( ( x: string ) => x.replace( /\s+/g, ' ' ).slice( 0, 30 ) );
};

test( 'EX-07 switch post while pending', async ( { admin, editor, page, requestUtils } ) => {
	const errors = collectConsole( page );
	const ctx = { page, editor, requestUtils };
	const otherId = await seedPost( requestUtils, { title: 'ko EX-07 other zebra' } );
	const postId = await seedPost( requestUtils, { title: 'ko EX-07 main' } );
	await openPost( admin, editor, postId );
	await switchIntent( page, 'Suggesting' );
	await suggest( 'add', ctx );
	await suggest( 'remove', ctx );
	await savePost( page, postId );
	await snap( 'EX-07 before switching (saved, 2 pending)', ctx, postId );
	console.log( 'INTENT before', JSON.stringify( await checkedIntent( page ) ) );
	await page.evaluate( () => ( ( window as any ).__koSamePage = true ) );
	// In-app navigation attempt: command palette to the other post.
	await page.keyboard.press( 'ControlOrMeta+k' );
	await page.waitForTimeout( 500 );
	await page.keyboard.type( 'ko EX-07 other zebra', { delay: 20 } );
	await page.waitForTimeout( 2500 );
	const opts = await page.getByRole( 'option' ).allInnerTexts();
	console.log( 'PALETTE OPTIONS', JSON.stringify( opts ) );
	page.once( 'dialog', ( d: any ) => { console.log( 'DIALOG', d.type(), d.message() ); d.accept(); } );
	if ( opts.length ) {
		await page.getByRole( 'option' ).first().click();
		await page.waitForTimeout( 4000 );
		await editor.canvas.locator( '.is-root-container' ).first().waitFor();
	}
	const samePage = await page.evaluate( () => !! ( window as any ).__koSamePage );
	console.log( 'URL now', page.url(), 'client-side navigation (window survived):', samePage );
	console.log( 'current post id', await page.evaluate( () => ( window as any ).wp.data.select( 'core/editor' ).getCurrentPostId() ), 'expected other', otherId );
	console.log( 'INTENT on other post', JSON.stringify( await checkedIntent( page ) ) );
	console.log( 'OTHER markers', ( await getMarkers( editor ) ).length, 'All notes button', await page.getByRole( 'button', { name: 'All notes', exact: true } ).count() );
	await shot( page, 'EX-07-on-other-post' );
	// And back.
	await page.evaluate( () => ( ( window as any ).__koSamePage2 = true ) );
	await page.keyboard.press( 'ControlOrMeta+k' );
	await page.waitForTimeout( 500 );
	await page.keyboard.type( 'ko EX-07 main', { delay: 20 } );
	await page.waitForTimeout( 2500 );
	if ( await page.getByRole( 'option' ).count() ) {
		await page.getByRole( 'option' ).first().click();
		await page.waitForTimeout( 4000 );
		await editor.canvas.locator( '.is-root-container' ).first().waitFor();
	}
	console.log( 'URL back', page.url(), 'client-side:', await page.evaluate( () => !! ( window as any ).__koSamePage2 ), 'post', await page.evaluate( () => ( window as any ).wp.data.select( 'core/editor' ).getCurrentPostId() ), 'expected', postId );
	console.log( 'INTENT back on main', JSON.stringify( await checkedIntent( page ) ) );
	await snap( 'EX-07 back on main post', ctx, postId );
	await shot( page, 'EX-07-back-on-main-post' );
	console.log( 'CONSOLE', JSON.stringify( errors ) );
} );

test( 'EX-08 offline save', async ( { admin, editor, page, requestUtils, context } ) => {
	const errors = collectConsole( page );
	const ctx = { page, editor, requestUtils };
	const postId = await seedPost( requestUtils, { title: 'ko EX-08' } );
	await openPost( admin, editor, postId );
	await switchIntent( page, 'Suggesting' );
	await suggest( 'add', ctx );
	const n0 = ( await getNotes( requestUtils, postId ) ).length;
	console.log( 'notes before offline', n0 );
	// A: suggestion made while offline.
	await context.setOffline( true );
	await P( editor, 'Third paragraph' ).click();
	await page.keyboard.press( 'End' );
	await page.keyboard.type( ' OFFLINEADD', { delay: 25 } );
	await page.waitForTimeout( 5000 );
	console.log( 'OFFLINE markers', JSON.stringify( ( await getMarkers( editor ) ).map( ( m: any ) => `${ m.type }#${ m.id } ${ m.text }` ) ) );
	console.log( 'OFFLINE notices', JSON.stringify( await page.locator( '.components-notice, .components-snackbar' ).allInnerTexts() ) );
	// B: save while offline.
	await page.keyboard.press( 'ControlOrMeta+s' );
	await page.waitForTimeout( 4000 );
	const notices = await page.locator( '.components-notice, .components-snackbar' ).allInnerTexts();
	console.log( 'OFFLINE SAVE notices', JSON.stringify( notices ) );
	console.log( 'dirty while offline', await page.evaluate( () => ( window as any ).wp.data.select( 'core/editor' ).isEditedPostDirty() ) );
	await shot( page, 'EX-08-offline-save' );
	await context.setOffline( false );
	await page.waitForTimeout( 6000 );
	console.log( 'BACK ONLINE markers (before retry)', JSON.stringify( ( await getMarkers( editor ) ).map( ( m: any ) => `${ m.type }#${ m.id } ${ m.text }` ) ), 'notes', ( await getNotes( requestUtils, postId ) ).length );
	const status = await savePost( page, postId );
	await page.waitForTimeout( 3000 );
	console.log( 'RETRY save status', status, 'dirty', await page.evaluate( () => ( window as any ).wp.data.select( 'core/editor' ).isEditedPostDirty() ) );
	await snap( 'EX-08 after retry', ctx, postId );
	await reload( page, editor );
	await snap( 'EX-08 after reload', ctx, postId );
	await shot( page, 'EX-08-after-retry-reload' );
	console.log( 'CONSOLE', JSON.stringify( errors ) );
} );

test( 'EX-09 rapid mode toggling while typing', async ( { admin, editor, page, requestUtils, pageUtils } ) => {
	const errors = collectConsole( page );
	const ctx = { page, editor, requestUtils };
	const postId = await seedPost( requestUtils, { title: 'ko EX-09' } );
	await openPost( admin, editor, postId );
	await P( editor, 'Third paragraph' ).click();
	await page.keyboard.press( 'End' );
	for ( let i = 0; i < 4; i++ ) {
		await pageUtils.pressKeys( 'secondary+x' );
		await page.keyboard.type( ` S${ i }s`, { delay: 10 } );
		await pageUtils.pressKeys( 'secondary+z' );
		await page.keyboard.type( ` E${ i }e`, { delay: 10 } );
	}
	await page.waitForTimeout( 5000 );
	const block = ( await getBlocks( page ) )[ 3 ];
	console.log( 'BLOCK', block.content );
	const markers = await getMarkers( editor );
	console.log( 'MARKERS', JSON.stringify( markers.map( ( m: any ) => `${ m.type }#${ m.id } ${ JSON.stringify( m.text ) }` ) ) );
	const inMarks = markers.map( ( m: any ) => m.text ).join( '|' );
	for ( let i = 0; i < 4; i++ ) {
		console.log( `S${ i }s in marker: ${ inMarks.includes( `S${ i }s` ) }; E${ i }e in marker: ${ inMarks.includes( `E${ i }e` ) }; E${ i }e in plain text: ${ block.content.replace( /<mark.*?<\/mark>/g, '' ).includes( `E${ i }e` ) }` );
	}
	await snap( 'EX-09 after rapid toggling', ctx, postId );
	await shot( page, 'EX-09-rapid-mode-toggle' );
	// Even faster: zero delay, no pause between toggle and key.
	await P( editor, 'Fourth paragraph' ).click();
	await page.keyboard.press( 'End' );
	for ( let i = 0; i < 4; i++ ) {
		await pageUtils.pressKeys( 'secondary+x' );
		await page.keyboard.type( `[s${ i }]` );
		await pageUtils.pressKeys( 'secondary+z' );
		await page.keyboard.type( `[e${ i }]` );
	}
	await page.waitForTimeout( 5000 );
	const b4 = ( await getBlocks( page ) )[ 4 ];
	console.log( 'BLOCK4 (zero delay)', b4.content );
	console.log( 'NOTES', ( await getNotes( requestUtils, postId ) ).length, 'THREADS', JSON.stringify( await threads( page ) ) );
	await shot( page, 'EX-09-rapid-mode-toggle-zero-delay' );
	console.log( 'CONSOLE', JSON.stringify( errors ) );
} );
