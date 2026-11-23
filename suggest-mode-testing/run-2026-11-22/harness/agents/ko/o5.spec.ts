import { test } from '@wordpress/e2e-test-utils-playwright';
import { seedPost, openPost, collectConsole, suggestionSaved, getMarkers, getNotes, getBlocks } from '../../helpers';
import { snap, savePost, reload, suggest, switchIntent, shot, P, threads } from './lib';

const b = async ( page: any, i: number ) => ( await getBlocks( page ) )[ i ].content;
const snack = ( page: any ) => page.locator( '.components-snackbar' ).allInnerTexts();
const allNotes = async ( requestUtils: any, postId: number ) => {
	const out: string[] = [];
	for ( const status of [ 'hold', 'approve', 'trash' ] ) {
		const n = await requestUtils.rest( { path: '/wp/v2/comments', params: { post: postId, type: 'note', status, per_page: 100, context: 'edit' } } ).catch( () => [] );
		n.forEach( ( x: any ) => out.push( `#${ x.id } ${ x.status } ${ x.meta?._wp_suggestion_status || '' } ${ ( x.meta?._wp_suggestion || '' ).replace( /.*"operations":/, '' ).slice( 0, 150 ) }` ) );
	}
	return out;
};

test( 'EX-09 diag', async ( { admin, editor, page, requestUtils, pageUtils } ) => {
	const errors = collectConsole( page );
	page.on( 'response', async ( r: any ) => { if ( /wp\/v2\/comments/.test( r.url() ) && r.request().method() !== 'GET' ) console.log( '   RESP', r.status(), r.request().method(), decodeURIComponent( r.url() ).replace( /.*wp\/v2/, '' ).slice( 0, 60 ), ( r.request().postData() || '' ).slice( 0, 110 ) ); } );
	const postId = await seedPost( requestUtils, { title: 'ko EX-09' } );
	await openPost( admin, editor, postId );
	// A: slow, shortcut-driven.
	await P( editor, 'Third paragraph' ).click();
	await page.keyboard.press( 'End' );
	await pageUtils.pressKeys( 'secondary+x' );
	await page.waitForTimeout( 300 );
	console.log( 'A snack after secondary+x', JSON.stringify( await snack( page ) ) );
	let saved = suggestionSaved( page );
	await page.keyboard.type( ' S0s', { delay: 20 } );
	console.log( 'A right after typing S0s:', await b( page, 3 ) );
	await saved;
	console.log( 'A after note saved:', await b( page, 3 ) );
	await pageUtils.pressKeys( 'secondary+z' );
	await page.waitForTimeout( 300 );
	console.log( 'A snack after secondary+z', JSON.stringify( await snack( page ) ), '\nA block:', await b( page, 3 ) );
	await page.keyboard.type( ' E0e', { delay: 20 } );
	await page.waitForTimeout( 2500 );
	console.log( 'A final:', await b( page, 3 ) );
	console.log( 'A notes', JSON.stringify( await allNotes( requestUtils, postId ) ) );

	// B: fast, shortcut-driven, 3 cycles, no waits.
	await P( editor, 'Fourth paragraph' ).click();
	await page.keyboard.press( 'End' );
	for ( let i = 1; i <= 3; i++ ) {
		await pageUtils.pressKeys( 'secondary+x' );
		await page.keyboard.type( ` S${ i }s`, { delay: 10 } );
		console.log( `B cycle ${ i } after S typed:`, await b( page, 4 ) );
		await pageUtils.pressKeys( 'secondary+z' );
		console.log( `B cycle ${ i } after switch to Editing:`, await b( page, 4 ) );
		await page.keyboard.type( ` E${ i }e`, { delay: 10 } );
		console.log( `B cycle ${ i } after E typed:`, await b( page, 4 ) );
	}
	await page.waitForTimeout( 5000 );
	const final = await b( page, 4 );
	console.log( 'B final:', final );
	const markers = await getMarkers( editor );
	console.log( 'MARKERS', JSON.stringify( markers.map( ( m: any ) => `${ m.type }#${ m.id } ${ JSON.stringify( m.text ) }` ) ) );
	const plain = final.replace( /<mark[^>]*>.*?<\/mark>/g, '' );
	const marked = markers.map( ( m: any ) => m.text ).join( '|' );
	for ( let i = 1; i <= 3; i++ ) console.log( `S${ i }s: inMarker=${ marked.includes( `S${ i }s` ) } inPlain=${ plain.includes( `S${ i }s` ) } | E${ i }e: inMarker=${ marked.includes( `E${ i }e` ) } inPlain=${ plain.includes( `E${ i }e` ) }` );
	console.log( 'notes', JSON.stringify( await allNotes( requestUtils, postId ) ) );
	console.log( 'snack', JSON.stringify( await snack( page ) ) );
	const an = page.getByRole( 'button', { name: 'All notes', exact: true } );
	console.log( 'All notes button count', await an.count() );
	if ( await an.count() ) console.log( 'THREADS', JSON.stringify( await threads( page ) ) );
	await shot( page, 'EX-09-rapid-mode-toggle' );
	await savePost( page, postId );
	await reload( page, editor );
	console.log( 'AFTER save+reload b3:', await b( page, 3 ), '\nb4:', await b( page, 4 ) );
	console.log( 'notes', JSON.stringify( await allNotes( requestUtils, postId ) ) );
	console.log( 'CONSOLE', JSON.stringify( errors ) );
} );

test( 'EX-08 diag offline suggestion', async ( { admin, editor, page, requestUtils, context } ) => {
	const errors: string[] = [];
	page.on( 'pageerror', ( e: any ) => errors.push( e.message ) );
	const ctx = { page, editor, requestUtils };
	const postId = await seedPost( requestUtils, { title: 'ko EX-08b' } );
	await openPost( admin, editor, postId );
	await switchIntent( page, 'Suggesting' );
	await suggest( 'add', ctx );
	page.on( 'requestfailed', ( r: any ) => { if ( r.method() !== 'GET' ) console.log( '   REQFAILED', r.method(), decodeURIComponent( r.url() ).replace( /.*rest_route=|.*wp-json/, '' ).slice( 0, 70 ) ); } );
	page.on( 'response', async ( r: any ) => { if ( /wp\/v2\/(comments|posts)/.test( r.url() ) && r.request().method() !== 'GET' ) console.log( '   RESP', r.status(), r.request().method(), decodeURIComponent( r.url() ).replace( /.*wp\/v2/, '' ).slice( 0, 60 ) ); } );
	await context.setOffline( true );
	await P( editor, 'Third paragraph' ).click();
	await page.keyboard.press( 'End' );
	await page.keyboard.type( ' OFFLINEADD', { delay: 25 } );
	console.log( 't+0 b3:', await b( page, 3 ) );
	for ( const t of [ 1000, 2000, 3000, 6000 ] ) {
		await page.waitForTimeout( t === 1000 ? 1000 : t === 6000 ? 3000 : 1000 );
		console.log( `t+${ t } b3:`, await b( page, 3 ), '| notices', JSON.stringify( await page.locator( '.components-notice, .components-snackbar' ).allInnerTexts() ) );
	}
	await shot( page, 'EX-08-offline-suggestion' );
	console.log( '--- pressing save while offline' );
	await page.keyboard.press( 'ControlOrMeta+s' );
	await page.waitForTimeout( 4000 );
	console.log( 'after offline save: notices', JSON.stringify( await page.locator( '.components-notice, .components-snackbar' ).allInnerTexts() ), 'dirty', await page.evaluate( () => ( window as any ).wp.data.select( 'core/editor' ).isEditedPostDirty() ) );
	await shot( page, 'EX-08-offline-save' );
	await context.setOffline( false );
	console.log( '--- back online' );
	await page.waitForTimeout( 8000 );
	console.log( 'online+8s b3:', await b( page, 3 ), 'notes', JSON.stringify( await allNotes( requestUtils, postId ) ) );
	// type one more char to see whether the suggestion retries
	await page.keyboard.type( 'X', { delay: 25 } );
	await page.waitForTimeout( 5000 );
	console.log( 'after typing X online b3:', await b( page, 3 ), 'notes', JSON.stringify( await allNotes( requestUtils, postId ) ) );
	const status = await savePost( page, postId );
	console.log( 'retry save', status );
	await reload( page, editor );
	await snap( 'EX-08 diag after reload', ctx, postId );
	await shot( page, 'EX-08-after-retry-reload' );
	console.log( 'PAGEERRORS', JSON.stringify( errors ) );
} );
