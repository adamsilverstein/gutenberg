import { test } from '@wordpress/e2e-test-utils-playwright';
import { seedPost, openPost, collectConsole, getMarkers, getBlocks, getNotes } from '../../helpers';
import { snap, suggest, switchIntent, shot, savePost } from './lib';

const radios = async ( page: any ) => {
	await page.getByRole( 'region', { name: 'Editor top bar' } ).getByRole( 'button', { name: 'Options' } ).click();
	await page.waitForTimeout( 300 );
	const t = await page.getByRole( 'menuitemradio' ).evaluateAll( ( els: any[] ) => els.map( ( e ) => ( e.textContent || '' ).replace( /\s+/g, ' ' ).slice( 0, 14 ) + ( e.getAttribute( 'aria-checked' ) === 'true' ? ' [checked]' : '' ) + ( e.getAttribute( 'aria-disabled' ) === 'true' ? ' [disabled]' : '' ) ) );
	await page.keyboard.press( 'Escape' );
	return t;
};

test( 'EX-04c template mode from the post editor', async ( { admin, editor, page, requestUtils, pageUtils } ) => {
	const errors = collectConsole( page );
	const ctx = { page, editor, requestUtils };
	page.on( 'response', async ( r: any ) => { if ( /wp\/v2\/(comments|templates)/.test( r.url() ) && r.request().method() !== 'GET' ) console.log( '   RESP', r.status(), r.request().method(), decodeURIComponent( r.url() ).replace( /.*wp\/v2/, '' ).slice( 0, 50 ) ); } );
	const postId = await seedPost( requestUtils, { title: 'ko EX-04c' } );
	await openPost( admin, editor, postId );
	await switchIntent( page, 'Suggesting' );
	await suggest( 'add', ctx );
	await savePost( page, postId );
	await editor.openDocumentSettingsSidebar();
	const settings = page.getByRole( 'region', { name: 'Editor settings' } );
	await settings.getByRole( 'tab', { name: 'Post' } ).click().catch( () => {} );
	const row = settings.getByRole( 'button', { name: /Single Posts/ } ).filter( { hasNotText: 'Template:' } ).first();
	console.log( 'row button', JSON.stringify( await row.evaluate( ( e: any ) => ( { text: e.textContent, label: e.getAttribute( 'aria-label' ) } ) ).catch( () => null ) ) );
	console.log( 'SNACK before', JSON.stringify( await page.locator( '.components-snackbar' ).allInnerTexts() ) );
	for ( const mode of [ 'Suggesting', 'Editing' ] ) {
		if ( mode === 'Editing' ) await switchIntent( page, 'Editing' );
		await row.click();
		await page.waitForTimeout( 800 );
		console.log( `TEMPLATE POPOVER in ${ mode }:`, JSON.stringify( ( await page.locator( '.components-popover' ).allInnerTexts() ).map( ( t: string ) => t.replace( /\s+/g, ' ' ).slice( 0, 200 ) ) ) );
		console.log( 'SNACK', JSON.stringify( await page.locator( '.components-snackbar' ).allInnerTexts() ) );
		if ( mode === 'Suggesting' ) { await shot( page, 'EX-04-template-dropdown-suggesting' ); await page.keyboard.press( 'Escape' ); await page.waitForTimeout( 300 ); }
	}
	const edit = page.locator( '.components-popover' ).getByRole( 'menuitem', { name: /Edit template/i } );
	console.log( 'Edit template item (Editing)', await edit.count() );
	if ( await edit.count() ) {
		await page.evaluate( () => ( ( window as any ).__ko = 1 ) );
		await edit.click();
		await page.waitForTimeout( 3500 );
		console.log( 'URL', page.url(), 'same window', await page.evaluate( () => ( window as any ).__ko === 1 ), 'postType', await page.evaluate( () => ( window as any ).wp.data.select( 'core/editor' ).getCurrentPostType() ) );
		console.log( 'RADIOS in template', JSON.stringify( await radios( page ) ) );
		await pageUtils.pressKeys( 'secondary+x' );
		await page.waitForTimeout( 800 );
		console.log( 'SNACK after secondary+x', JSON.stringify( await page.locator( '.components-snackbar' ).allInnerTexts() ), 'RADIOS', JSON.stringify( await radios( page ) ) );
		console.log( 'All notes button', await page.getByRole( 'button', { name: 'All notes', exact: true } ).count(), 'markers visible in template canvas', ( await getMarkers( editor ) ).length );
		console.log( 'template blocks', JSON.stringify( ( await getBlocks( page ) ).map( ( b: any ) => b.name ) ) );
		await shot( page, 'EX-04-template-mode-from-post' );
		const back = page.getByRole( 'region', { name: 'Editor top bar' } ).getByRole( 'button', { name: /^Back$/ } );
		console.log( 'Back', await back.count() );
		if ( await back.count() ) {
			await back.click();
			await page.waitForTimeout( 2500 );
			console.log( 'RADIOS after back', JSON.stringify( await radios( page ) ) );
			await snap( 'EX-04c back on post', ctx, postId );
		}
	}
	console.log( 'CONSOLE', JSON.stringify( errors ) );
} );
