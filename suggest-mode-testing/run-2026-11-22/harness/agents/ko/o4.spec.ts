import { test } from '@wordpress/e2e-test-utils-playwright';
import { seedPost, openPost, collectConsole, suggestionSaved, getMarkers, getNotes, getBlocks } from '../../helpers';
import { snap, savePost, suggest, switchIntent, shot, P, flat, threads } from './lib';

const radios = async ( page: any ) => {
	await page.getByRole( 'region', { name: 'Editor top bar' } ).getByRole( 'button', { name: 'Options' } ).click();
	await page.waitForTimeout( 300 );
	const t = await page.getByRole( 'menuitemradio' ).evaluateAll( ( els: any[] ) => els.map( ( e ) => ( e.textContent || '' ).replace( /\s+/g, ' ' ).slice( 0, 24 ) + ( e.getAttribute( 'aria-checked' ) === 'true' ? ' [checked]' : '' ) + ( e.getAttribute( 'aria-disabled' ) === 'true' ? ' [disabled]' : '' ) ) );
	await page.keyboard.press( 'Escape' );
	return t;
};

test( 'EX-03b pattern: Edit original and back (client-side nav with pending)', async ( { admin, editor, page, requestUtils } ) => {
	const errors = collectConsole( page );
	const ctx = { page, editor, requestUtils };
	const pattern = await requestUtils.rest( { method: 'POST', path: '/wp/v2/blocks', data: { title: 'ko EX-03b synced pattern', status: 'publish', content: '<!-- wp:paragraph -->\n<p>Second synced pattern text.</p>\n<!-- /wp:paragraph -->' } } );
	const postId = await seedPost( requestUtils, { title: 'ko EX-03b', content: `<!-- wp:paragraph -->\n<p>The quick brown fox jumps over the lazy dog near the riverbank.</p>\n<!-- /wp:paragraph -->\n\n<!-- wp:paragraph -->\n<p>Third paragraph: plain text.</p>\n<!-- /wp:paragraph -->\n\n<!-- wp:block {"ref":${ pattern.id }} /-->` } );
	page.on( 'response', async ( r: any ) => { if ( r.status() >= 400 ) console.log( 'HTTP', r.status(), r.request().method(), decodeURIComponent( r.url() ).slice( 0, 220 ), ( await r.text().catch( () => '' ) ).slice( 0, 160 ) ); } );
	await openPost( admin, editor, postId );
	await switchIntent( page, 'Suggesting' );
	await suggest( 'add', ctx );
	await page.evaluate( () => ( ( window as any ).__ko = 1 ) );
	console.log( 'RADIOS host (Suggesting)', JSON.stringify( await radios( page ) ) );
	// Try to delete the pattern block in Suggesting (structural suggestion on the reference).
	await editor.canvas.locator( '[data-type="core/block"]' ).first().click( { force: true } );
	await page.waitForTimeout( 500 );
	await page.getByRole( 'toolbar', { name: 'Block tools' } ).getByRole( 'button', { name: /Edit original/ } ).click();
	await page.waitForTimeout( 3000 );
	console.log( 'URL', page.url(), 'same window', await page.evaluate( () => ( window as any ).__ko === 1 ), 'postType', await page.evaluate( () => ( window as any ).wp.data.select( 'core/editor' ).getCurrentPostType() ) );
	console.log( 'RADIOS in pattern editor', JSON.stringify( await radios( page ) ) );
	console.log( 'SNACK', JSON.stringify( await page.locator( '.components-snackbar' ).allInnerTexts() ) );
	const p = editor.canvas.locator( '[data-type="core/paragraph"]' ).first();
	await p.click();
	await page.keyboard.press( 'End' );
	await page.keyboard.type( ' DIRECT', { delay: 25 } );
	await page.waitForTimeout( 3000 );
	console.log( 'pattern editor markers', ( await getMarkers( editor ) ).length, 'blocks', JSON.stringify( await flat( page ) ) );
	await shot( page, 'EX-03-pattern-editor-while-suggesting' );
	// Back
	const back = page.getByRole( 'region', { name: 'Editor top bar' } ).getByRole( 'button', { name: /^Back$/ } );
	console.log( 'Back button', await back.count() );
	page.once( 'dialog', ( d: any ) => { console.log( 'DIALOG', d.message() ); d.accept(); } );
	if ( await back.count() ) {
		await back.click();
		await page.waitForTimeout( 3000 );
	}
	console.log( 'URL after back', page.url(), 'same window', await page.evaluate( () => ( window as any ).__ko === 1 ), 'post', await page.evaluate( () => ( window as any ).wp.data.select( 'core/editor' ).getCurrentPostId() ) );
	console.log( 'RADIOS after back', JSON.stringify( await radios( page ) ) );
	await snap( 'EX-03b/EX-07 back on host post', ctx, postId );
	// Is the mode what the menu says? type and see.
	const saved = suggestionSaved( page ).catch( () => null );
	await P( editor, 'quick brown fox' ).click();
	await page.keyboard.press( 'End' );
	await page.keyboard.type( ' AFTERBACK', { delay: 25 } );
	const r = await Promise.race( [ saved, page.waitForTimeout( 6000 ).then( () => 'no-note-request' ) ] );
	console.log( 'typing after back -> note request:', r === 'no-note-request' ? r : 'saved' );
	console.log( 'MARKERS', JSON.stringify( ( await getMarkers( editor ) ).map( ( m: any ) => `${ m.type }#${ m.id } ${ m.text }` ) ) );
	console.log( 'pattern entity dirty', await page.evaluate( ( ref: number ) => ( window as any ).wp.data.select( 'core' ).hasEditsForEntityRecord( 'postType', 'wp_block', ref ), pattern.id ) );
	await shot( page, 'EX-07-back-from-pattern-editor' );
	console.log( 'CONSOLE', JSON.stringify( errors ) );
} );

test( 'EX-04b template mode from the post editor', async ( { admin, editor, page, requestUtils, pageUtils } ) => {
	const errors = collectConsole( page );
	const ctx = { page, editor, requestUtils };
	page.on( 'response', async ( r: any ) => { if ( /wp\/v2\/comments/.test( r.url() ) && r.request().method() !== 'GET' ) console.log( 'RESP', r.status(), r.request().method(), ( r.request().postData() || '' ).slice( 0, 200 ) ); } );
	const postId = await seedPost( requestUtils, { title: 'ko EX-04b' } );
	await openPost( admin, editor, postId );
	await switchIntent( page, 'Suggesting' );
	await suggest( 'add', ctx );
	console.log( 'RADIOS post', JSON.stringify( await radios( page ) ) );
	await editor.openDocumentSettingsSidebar();
	const settings = page.getByRole( 'region', { name: 'Editor settings' } );
	await settings.getByRole( 'tab', { name: 'Post' } ).click().catch( () => {} );
	const labels = async () => JSON.stringify( await settings.getByRole( 'button' ).evaluateAll( ( els: any[] ) => els.map( ( e ) => e.getAttribute( 'aria-label' ) || e.textContent ) ) );
	console.log( 'SETTINGS BUTTONS (Suggesting)', await labels() );
	let btn = settings.getByRole( 'button', { name: /Edit Template/i } );
	console.log( 'Edit Template button in Suggesting', await btn.count() );
	if ( ! ( await btn.count() ) ) {
		const t = settings.getByRole( 'button', { name: /^Template/ } );
		if ( await t.count() ) { await t.first().click(); await page.waitForTimeout( 500 ); console.log( 'template popover', JSON.stringify( await page.locator( '.components-popover' ).last().innerText().catch( () => '' ) ) ); btn = page.getByRole( 'menuitem', { name: /Edit template/i } ); console.log( 'Edit template menuitem', await btn.count() ); }
	}
	page.once( 'dialog', ( d: any ) => { console.log( 'DIALOG', d.message() ); d.accept(); } );
	await btn.first().click();
	await page.waitForTimeout( 3500 );
	console.log( 'URL', page.url(), 'postType', await page.evaluate( () => ( window as any ).wp.data.select( 'core/editor' ).getCurrentPostType() ), 'renderingMode', await page.evaluate( () => ( window as any ).wp.data.select( 'core/editor' ).getRenderingMode() ) );
	console.log( 'RADIOS template', JSON.stringify( await radios( page ) ) );
	console.log( 'SNACK', JSON.stringify( await page.locator( '.components-snackbar' ).allInnerTexts() ) );
	await pageUtils.pressKeys( 'secondary+x' );
	await page.waitForTimeout( 800 );
	console.log( 'SNACK after secondary+x', JSON.stringify( await page.locator( '.components-snackbar' ).allInnerTexts() ), 'RADIOS', JSON.stringify( await radios( page ) ) );
	console.log( 'All notes button', await page.getByRole( 'button', { name: 'All notes', exact: true } ).count() );
	console.log( 'canvas markers in template view', ( await getMarkers( editor ) ).length, 'template blocks', JSON.stringify( ( await getBlocks( page ) ).map( ( b: any ) => b.name ) ) );
	console.log( 'dirty entities (nothing typed in template)', JSON.stringify( await page.evaluate( () => ( ( window as any ).wp.data.select( 'core' ).__experimentalGetDirtyEntityRecords?.() || [] ).map( ( d: any ) => d.name + ':' + d.key ) ) ) );
	await shot( page, 'EX-04-template-mode-from-post' );
	const back = page.getByRole( 'region', { name: 'Editor top bar' } ).getByRole( 'button', { name: /^Back$/ } );
	if ( await back.count() ) {
		await back.click();
		await page.waitForTimeout( 2500 );
		console.log( 'RADIOS after back', JSON.stringify( await radios( page ) ) );
		await snap( 'EX-04b back on post', ctx, postId );
	}
	console.log( 'CONSOLE', JSON.stringify( errors ) );
} );
