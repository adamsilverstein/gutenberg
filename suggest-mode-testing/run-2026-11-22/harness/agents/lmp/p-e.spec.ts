import { test } from '@wordpress/e2e-test-utils-playwright';
import { shot, USERS, collectConsole } from '../../helpers';
import { log, savePost, blocksOf, markersIn, snackbars, notesFull, decide, selectIn, canvasOf, focusBlock, withSave } from './lib';
import { newPost, adminOpen, gesture, report, cards, compact, session, spoken, P_CONTENT } from './plib';

const blockSummary = async ( page: any ) => ( await blocksOf( page ) ).map( ( b: any ) => `${ JSON.stringify( b.metadata?.suggestion ?? null ) }:${ ( b.content || '' ).replace( /<[^>]+>/g, '' ).slice( 0, 30 ) }` );

test( 'OV-08 author-user own post, both directions', async ( { admin, editor, page, pageUtils, requestUtils, browser } ) => {
	const au = await session( browser, USERS.author );
	const err = collectConsole( au.page );
	const nonce = ( await ( await au.context.request.get( 'http://localhost:8947/wp-admin/admin-ajax.php?action=rest-nonce' ) ).text() ).trim();
	const created = await au.context.request.fetch( 'http://localhost:8947/index.php?rest_route=/wp/v2/posts', { method: 'POST', headers: { 'X-WP-Nonce': nonce, 'Content-Type': 'application/json' }, data: JSON.stringify( { title: 'lmp OV-08 author post', status: 'draft', content: P_CONTENT } ) } );
	const id = ( await created.json() ).id;
	log( 'author post', { status: created.status(), id } );
	await au.open( id );
	await gesture( au.page, 'OV-08 author del', 'lazy dog', undefined, () => au.page.keyboard.press( 'Backspace' ) );
	await gesture( au.page, 'OV-08 author add', 'brown', 'start', () => au.page.keyboard.type( 'AUTHOR TEXT ', { delay: 20 } ) );
	log( 'author save', await savePost( au.page ) );
	await au.leave();
	await adminOpen( { admin, editor, page }, id );
	await gesture( page, 'OV-08 admin del overlapping author del', 'the lazy', undefined, () => page.keyboard.press( 'Backspace' ) );
	await gesture( page, 'OV-08 admin types over selection in author add', 'TEXT', undefined, () => page.keyboard.type( 'COPY', { delay: 20 } ) );
	await report( page, requestUtils, id, 'OV-08 admin over author' );
	await cards( page, 'OV-08 admin over author' );
	await shot( page, 'OV-08-admin-over-author' );
	log( 'admin save', await savePost( page ) );
	await page.goto( '/wp-admin/' );
	await au.open( id );
	await gesture( au.page, 'OV-08 author bolds over admin del', 'the', undefined, () => au.page.keyboard.press( 'ControlOrMeta+b' ), 0 );
	await gesture( au.page, 'OV-08 author deletes inside admin nested add', 'COPY', undefined, () => au.page.keyboard.press( 'Backspace' ) );
	await report( au.page, requestUtils, id, 'OV-08 author over admin' );
	const c = await cards( au.page, 'OV-08 author over admin' );
	await shot( au.page, 'OV-08-author-over-admin' );
	// Author reviews: accept admin's deletion on own post.
	const adminDel = c.find( ( x: any ) => /^Add new reply admin/.test( x.text ) && /Delete:/.test( x.text ) );
	if ( adminDel ) {
		log( 'OV-08 author accepts admin del', await decide( au.page, adminDel.id, 'accept' ) );
		await report( au.page, requestUtils, id, 'OV-08 after author accept' );
	}
	log( 'author save', await savePost( au.page ) );
	await au.page.waitForTimeout( 3000 );
	await cards( au.page, 'OV-08 author cards 3s after save' );
	log( 'console', err );
	await au.context.close();
} );

test( 'OV-14 OV-15 block-level overlaps', async ( { admin, editor, page, requestUtils, browser } ) => {
	const err = collectConsole( page );
	const id = await newPost( requestUtils, 'OV-14' );
	const ed = await session( browser, USERS.editor );
	await ed.open( id );
	await focusBlock( ed.page, 1 );
	await selectIn( ed.page, 1, 'reference.', 'end' );
	log( 'editor inserts block', ( await withSave( ed.page, async () => { await ed.page.keyboard.press( 'Enter' ); await ed.page.keyboard.type( 'Editor inserted block', { delay: 20 } ); } ) )?.status );
	log( 'ed save', await savePost( ed.page ) );
	await ed.leave();
	await adminOpen( { admin, editor, page }, id );
	log( 'OV-14 start', await blockSummary( page ) );
	// OV-15a: admin types inside editor's suggested block
	await focusBlock( page, 2 );
	await selectIn( page, 2, 'inserted', 'start' );
	log( 'OV-15 admin types inside editor pending-insert block', ( await withSave( page, () => page.keyboard.type( 'ADMIN ', { delay: 20 } ), 7000 ) )?.status ?? 'no note write' );
	log( 'OV-15 block2', ( await blocksOf( page ) )[ 2 ] );
	log( 'OV-15 snack', await snackbars( page ) );
	await cards( page, 'OV-15 typed in suggested block' );
	await shot( page, 'OV-15-typing-inside-others-suggested-block' );
	// OV-14: admin removes editor's suggested block
	await editor.selectBlocks( editor.canvas.locator( '.is-root-container > [data-block]' ).nth( 2 ) );
	log( 'OV-14 admin removes suggested block', ( await withSave( page, () => editor.clickBlockOptionsMenuItem( 'Delete' ), 8000 ) )?.status ?? 'no note write' );
	log( 'OV-14 after remove', await blockSummary( page ) );
	log( 'OV-14 snack', await snackbars( page ) );
	const c = await cards( page, 'OV-14 nested removal' );
	await shot( page, 'OV-14-removal-nested-on-suggested-block' );
	const removal = c.find( ( x: any ) => /Remove block/.test( x.text ) );
	if ( removal ) {
		log( 'OV-14 reject removal', await decide( page, removal.id, 'reject' ) );
		log( 'OV-14 after reject removal', await blockSummary( page ) );
		await cards( page, 'OV-14 after reject removal' );
		await editor.selectBlocks( editor.canvas.locator( '.is-root-container > [data-block]' ).nth( 2 ) );
		log( 'OV-14 admin removes again', ( await withSave( page, () => editor.clickBlockOptionsMenuItem( 'Delete' ), 8000 ) )?.status ?? 'no note write' );
		const c2 = await cards( page, 'OV-14 removal 2' );
		const removal2 = c2.find( ( x: any ) => /Remove block/.test( x.text ) && x.buttons.includes( 'Accept suggestion' ) );
		if ( removal2 ) {
			log( 'OV-14 accept removal', await decide( page, removal2.id, 'accept' ) );
			log( 'OV-14 after accept removal', await blockSummary( page ) );
			await cards( page, 'OV-14 after accept removal' );
			await shot( page, 'OV-14-accept-nested-removal' );
		}
	}
	log( 'admin save', await savePost( page ) );
	log( 'OV-14 notes', ( await notesFull( requestUtils, id ) ).map( ( n: any ) => `${ n.id }@${ n.author } ${ n.status } ${ n.ops } ${ n.sstatus ?? '' }` ) );
	// OV-15b: admin inline suggestion in block 0, editor removes that block
	await gesture( page, 'OV-15 admin inline add', 'brown', 'start', () => page.keyboard.type( 'ADMINADD ', { delay: 20 } ) );
	log( 'admin save', await savePost( page ) );
	await page.goto( '/wp-admin/' );
	await ed.open( id );
	await canvasOf( ed.page ).locator( '.is-root-container > [data-block]' ).nth( 0 ).click();
	await ed.page.keyboard.press( 'Escape' );
	await ed.page.waitForTimeout( 300 );
	log( 'OV-15 editor removes block holding admin inline suggestion', ( await withSave( ed.page, () => ed.page.keyboard.press( 'Backspace' ), 8000 ) )?.status ?? 'no note write' );
	log( 'OV-15 after editor remove', await blockSummary( ed.page ) );
	log( 'OV-15 snack', { snack: await snackbars( ed.page ), spoken: await spoken( ed.page ) } );
	log( 'OV-15 markers', compact( await markersIn( ed.page ) ) );
	const c3 = await cards( ed.page, 'OV-15 block removal over inline' );
	await shot( ed.page, 'OV-15-block-removal-over-others-inline' );
	const rem = c3.find( ( x: any ) => /Remove block/.test( x.text ) && x.buttons.includes( 'Accept suggestion' ) );
	if ( rem ) {
		log( 'OV-15 accept removal', await decide( ed.page, rem.id, 'accept' ) );
		log( 'OV-15 after accept', await blockSummary( ed.page ) );
		log( 'ed save', await savePost( ed.page ) );
		await ed.page.waitForTimeout( 3000 );
		await cards( ed.page, 'OV-15 after accept+save' );
		log( 'OV-15 notes', ( await notesFull( requestUtils, id ) ).map( ( n: any ) => `${ n.id }@${ n.author } ${ n.status } ${ n.ops } ${ n.sstatus ?? '' }` ) );
	}
	log( 'console', err );
	await ed.context.close();
} );

test( 'OV-13 extra Enter cases + OV-09 click', async ( { admin, editor, page, requestUtils } ) => {
	const id = await newPost( requestUtils, 'OV-13b' );
	await adminOpen( { admin, editor, page }, id );
	await gesture( page, 'own add', 'brown', 'start', () => page.keyboard.type( 'OWN ', { delay: 20 } ) );
	await gesture( page, 'own del', 'lazy dog', undefined, () => page.keyboard.press( 'Backspace' ) );
	const state = async () => ( { blocks: await blockSummary( page ), snack: await snackbars( page ), spoken: await spoken( page ) } );
	for ( const [ label, needle, collapse ] of [ [ 'own-only paragraph, caret in plain text (before near)', 'near', 'start' ], [ 'own-only paragraph, caret at end', 'riverbank.', 'end' ], [ 'own-only paragraph, caret inside own add', 'WN ', 'start' ] ] as const ) {
		await selectIn( page, 0, needle, collapse );
		await page.keyboard.press( 'Enter' );
		await page.waitForTimeout( 1200 );
		log( `OV-13 Enter ${ label }`, await state() );
		await shot( page, `OV-13-enter-${ label.includes( 'end' ) ? 'at-end' : label.includes( 'inside' ) ? 'inside-own-add-only' : 'plain-own-only' }` );
		if ( ( await blocksOf( page ) ).length > 2 ) {
			await page.keyboard.press( 'ControlOrMeta+z' );
			await page.waitForTimeout( 500 );
			log( 'undone', await blockSummary( page ) );
		}
		await page.waitForTimeout( 2500 );
	}
	// OV-09 click: which thread does clicking a marker select?
	await cards( page, 'click check' );
	for ( const sel of [ 'mark.wp-suggestion-del', 'mark.wp-suggestion-add' ] ) {
		const box = await editor.canvas.locator( sel ).first().boundingBox();
		await page.mouse.click( box!.x + box!.width / 2, box!.y + box!.height / 2 );
		await page.waitForTimeout( 1000 );
		log( `OV-09 click ${ sel }`, await page.locator( '[id^="note-thread-"]' ).evaluateAll( ( els ) => els.map( ( el ) => `${ el.id }${ el.className.includes( 'is-selected' ) ? ' SELECTED' : '' } ${ ( el as HTMLElement ).innerText.replace( /\s+/g, ' ' ).slice( 14, 60 ) }` ) ) );
	}
} );
