import { test } from '@wordpress/e2e-test-utils-playwright';
import { shot, USERS, collectConsole } from '../../helpers';
import { log, savePost, blocksOf, markersIn, snackbars, notesFull, decide, sidebarCards } from './lib';
import { newPost, adminOpen, gesture, report, cards, compact, session } from './plib';

type Ids = { E: number; A: number; D: number; F: number };

async function build( { admin, editor, page, pageUtils, requestUtils }: any, ed: any, title: string, status = 'draft' ) {
	const id = await newPost( requestUtils, title, status );
	await ed.open( id );
	await gesture( ed.page, `${ title } E`, 'brown', 'start', () => ed.page.keyboard.type( 'EDITOR SENTENCE HERE ', { delay: 15 } ) );
	await savePost( ed.page );
	await ed.leave();
	await adminOpen( { admin, editor, page }, id );
	await gesture( page, `${ title } A`, 'SENTENCE', 'start', () => page.keyboard.type( 'ADMIN ', { delay: 15 } ) );
	await gesture( page, `${ title } D`, 'HERE brown', undefined, () => page.keyboard.press( 'Backspace' ) );
	await gesture( page, `${ title } F`, 'SENTENCE', undefined, () => pageUtils.pressKeys( 'primary+b' ) );
	await savePost( page );
	const notes = await notesFull( requestUtils, id );
	const find = ( author: number, op: string ) => notes.find( ( n: any ) => n.author === author && n.ops?.[ 0 ] === op )?.id;
	const ids: Ids = { E: find( 2, 'inline-suggestion:add' ), A: find( 1, 'inline-suggestion:add' ), D: find( 1, 'inline-suggestion:del' ), F: find( 1, 'inline-suggestion:format' ) };
	log( `${ title } built`, { id, ids, html: ( await blocksOf( page ) )[ 0 ].content } );
	return { id, ids };
}

async function runOrder( ctx: any, ed: any, title: string, order: Array< [ keyof Ids, 'accept' | 'reject' ] >, shotName?: string ) {
	const { page, requestUtils } = ctx;
	const { id, ids } = await build( ctx, ed, title );
	await sidebarCards( page );
	for ( const [ key, decision ] of order ) {
		const btn = page.locator( `#note-thread-${ ids[ key ] }` ).getByRole( 'button', { name: decision === 'accept' ? 'Accept suggestion' : 'Reject suggestion' } );
		if ( ! ( await btn.count() ) || ( await btn.getAttribute( 'aria-disabled' ) ) === 'true' ) {
			log( `${ title } ${ key } ${ decision }`, 'NO BUTTON (card: ' + ( await page.locator( `#note-thread-${ ids[ key ] }` ).innerText().catch( () => 'missing' ) ).replace( /\s+/g, ' ' ) + ')' );
			continue;
		}
		const status = await decide( page, ids[ key ], decision );
		log( `${ title } ${ key } ${ decision }`, { status, text: ( ( await blocksOf( page ) )[ 0 ].content || '' ).replace( /<mark[^>]*>|<\/mark>/g, '' ), markers: compact( await markersIn( page ) ) } );
	}
	await cards( page, `${ title } final` );
	if ( shotName ) {
		await shot( page, shotName );
	}
	log( `${ title } save`, await savePost( page ) );
	const server = await requestUtils.rest( { path: `/wp/v2/posts/${ id }`, params: { context: 'edit' } } );
	const p0 = ( server.content.raw as string ).split( '\n' )[ 1 ];
	log( `${ title } SERVER p0`, p0 );
	log( `${ title } notes`, ( await notesFull( requestUtils, id ) ).map( ( n: any ) => `${ n.id }@${ n.author } ${ n.status } ${ n.ops } ${ n.sstatus ?? '' }` ) );
	return p0;
}

test( 'OV-10 order independence', async ( { admin, editor, page, pageUtils, requestUtils, browser } ) => {
	test.setTimeout( 600000 );
	const ctx = { admin, editor, page, pageUtils, requestUtils };
	const err = collectConsole( page );
	const ed = await session( browser, USERS.editor );
	const y1 = await runOrder( ctx, ed, 'OV-10 Y1', [ [ 'E', 'reject' ], [ 'A', 'accept' ], [ 'D', 'accept' ], [ 'F', 'reject' ] ], 'OV-10-reject-outer-first' );
	const y2 = await runOrder( ctx, ed, 'OV-10 Y2', [ [ 'F', 'reject' ], [ 'D', 'accept' ], [ 'A', 'accept' ], [ 'E', 'reject' ] ], 'OV-10-reject-outer-last' );
	log( 'OV-10 Y equal', { equal: y1 === y2, y1, y2 } );
	log( 'console', err );
	await ed.context.close();
} );

test( 'OV-11 reject outer and undo; OV-12 front end', async ( { admin, editor, page, pageUtils, requestUtils, browser } ) => {
	test.setTimeout( 300000 );
	const ctx = { admin, editor, page, pageUtils, requestUtils };
	const ed = await session( browser, USERS.editor );
	const { id, ids } = await build( ctx, ed, 'OV-12', 'publish' );
	// OV-12 front end with all four pending
	const anon = await browser.newContext( { storageState: { cookies: [], origins: [] } } );
	const front = async ( label: string ) => {
		const html = await ( await anon.request.get( `http://localhost:8947/?p=${ id }` ) ).text();
		const m = html.match( /<p[^>]*>The quick[\s\S]*?<\/p>/ );
		log( `OV-12 front ${ label }`, { p: m?.[ 0 ] ?? 'NOT FOUND', anyMark: /data-suggestion|wp-suggestion-(add|del|format)/.test( html ) } );
	};
	await front( 'all pending' );
	const fp = await anon.newPage();
	await fp.goto( `http://localhost:8947/?p=${ id }` );
	await fp.screenshot( { path: ( await import( '../../helpers' ) ).SCREENSHOT_DIR + '/OV-12-front-end-overlapping-pending.png' } );
	const rest = await ( await anon.request.get( `http://localhost:8947/index.php?rest_route=/wp/v2/posts/${ id }` ) ).json();
	log( 'OV-12 REST rendered', rest.content?.rendered?.split( '\n' )[ 1 ] );
	await shot( page, 'OV-12-editor-state-for-front-end' );

	// OV-11 reject outer
	await cards( page, 'OV-11 before' );
	log( 'OV-11 reject E', await decide( page, ids.E, 'reject' ) );
	log( 'OV-11 snack', await snackbars( page ) );
	await report( page, requestUtils, id, 'OV-11 after reject E' );
	await cards( page, 'OV-11 after reject E' );
	await shot( page, 'OV-11-reject-outer-takes-nested' );
	await editor.canvas.locator( 'p' ).first().click();
	await pageUtils.pressKeys( 'primary+z' );
	await page.waitForTimeout( 1500 );
	await report( page, requestUtils, id, 'OV-11 after undo' );
	await cards( page, 'OV-11 after undo' );
	await shot( page, 'OV-11-undo-restores-nested' );
	log( 'OV-11 reject E again', await decide( page, ids.E, 'reject' ).catch( ( e ) => 'failed: ' + String( e ).slice( 0, 150 ) ) );
	log( 'save', await savePost( page ) );
	await report( page, requestUtils, id, 'OV-11 after save' );
	await cards( page, 'OV-11 after save' );
	await front( 'after rejecting outer add + save (D on brown still pending)' );
	await anon.close();
	// OV-11b: the editor withdraws their own outer addition holding admin's nested suggestions.
	const b = await build( ctx, ed, 'OV-11b' );
	await page.goto( '/wp-admin/' );
	await ed.open( b.id, false );
	await cards( ed.page, 'OV-11b editor before' );
	log( 'OV-11b editor rejects own E', await decide( ed.page, b.ids.E, 'reject' ) );
	log( 'OV-11b snack', await snackbars( ed.page ) );
	await report( ed.page, requestUtils, b.id, 'OV-11b after withdraw' );
	await cards( ed.page, 'OV-11b after withdraw' );
	await shot( ed.page, 'OV-11-withdraw-own-add-outdates-others' );
	log( 'OV-11b save', await savePost( ed.page ) );
	await report( ed.page, requestUtils, b.id, 'OV-11b after save' );
	await cards( ed.page, 'OV-11b after save' );
	await ed.leave();
	await adminOpen( ctx, b.id, false );
	await cards( page, 'OV-11b admin view afterwards' );
	await shot( page, 'OV-11-admin-sees-own-nested-outdated' );
	await ed.context.close();
} );
