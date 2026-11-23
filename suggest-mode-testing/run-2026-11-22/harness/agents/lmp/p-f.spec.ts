import { test } from '@wordpress/e2e-test-utils-playwright';
import { shot, USERS, collectConsole } from '../../helpers';
import { log, savePost, blocksOf, markersIn, snackbars, notesFull, decide, canvasOf, withSave } from './lib';
import { newPost, adminOpen, gesture, report, cards, compact, session, spoken } from './plib';

const blockSummary = async ( page: any ) => ( await blocksOf( page ) ).map( ( b: any ) => `${ JSON.stringify( b.metadata?.suggestion ?? null ) }:${ ( b.content || '' ).replace( /<[^>]+>/g, '' ).slice( 0, 30 ) }` );
const selectedThreads = ( page: any ) => page.locator( '[id^="note-thread-"]' ).evaluateAll( ( els: HTMLElement[] ) => els.filter( ( el ) => el.className.includes( 'is-selected' ) ).map( ( el ) => `${ el.id } ${ el.innerText.replace( /\s+/g, ' ' ).slice( 14, 70 ) }` ) );

test( 'OV-16 owner deletes text another user nested in their addition', async ( { admin, editor, page, pageUtils, requestUtils, browser } ) => {
	const id = await newPost( requestUtils, 'OV-16' );
	const ed = await session( browser, USERS.editor );
	const err = collectConsole( ed.page );
	await ed.open( id );
	await gesture( ed.page, 'E', 'brown', 'start', () => ed.page.keyboard.type( 'EDITOR SENTENCE HERE ', { delay: 15 } ) );
	await savePost( ed.page );
	await ed.leave();
	await adminOpen( { admin, editor, page }, id );
	await gesture( page, 'A nested add', 'SENTENCE', 'start', () => page.keyboard.type( 'ADMIN ', { delay: 15 } ) );
	await gesture( page, 'A2 nested add', 'HERE', 'start', () => page.keyboard.type( 'SECOND ', { delay: 15 } ) );
	await gesture( page, 'D nested del', 'HERE', undefined, () => page.keyboard.press( 'Backspace' ) );
	await gesture( page, 'F nested bold', 'EDITOR', undefined, () => pageUtils.pressKeys( 'primary+b' ) );
	await savePost( page );
	await report( page, requestUtils, id, 'OV-16 built' );
	// OV-09: click each nested marker
	await cards( page, 'OV-09 nested' );
	for ( const [ label, sel ] of [ [ 'nested add', 'mark.wp-suggestion-add mark.wp-suggestion-add' ], [ 'nested del', 'mark.wp-suggestion-add mark.wp-suggestion-del' ], [ 'nested format', 'mark.wp-suggestion-add mark.wp-suggestion-format' ] ] ) {
		const box = await editor.canvas.locator( sel ).first().boundingBox();
		await page.mouse.click( box!.x + box!.width / 2, box!.y + box!.height / 2 );
		await page.waitForTimeout( 1000 );
		log( `OV-09 click ${ label }`, await selectedThreads( page ) );
	}
	await shot( page, 'OV-09-click-nested-marker-selects' );
	await page.goto( '/wp-admin/' );

	await ed.open( id );
	await gesture( ed.page, 'OV-16 editor (owner of outer add) deletes admin nested "ADMIN"', 'ADMIN', undefined, () => ed.page.keyboard.press( 'Backspace' ) );
	await report( ed.page, requestUtils, id, 'OV-16 after deleting admin nested add' );
	log( 'OV-16 spoken', await spoken( ed.page ) );
	await cards( ed.page, 'OV-16 after deleting admin nested add' );
	await shot( ed.page, 'OV-16-owner-deletes-others-nested-add' );
	await gesture( ed.page, 'OV-16 editor deletes "SECOND HERE" (admin nested add + admin-deleted own text)', 'SECOND HERE', undefined, () => ed.page.keyboard.press( 'Backspace' ) );
	await report( ed.page, requestUtils, id, 'OV-16 after second delete' );
	await cards( ed.page, 'OV-16 after second delete' );
	log( 'ed save', await savePost( ed.page ) );
	await ed.page.waitForTimeout( 3000 );
	await report( ed.page, requestUtils, id, 'OV-16 after save' );
	await ed.leave();
	await adminOpen( { admin, editor, page }, id, false );
	await cards( page, 'OV-16 admin view after' );
	await shot( page, 'OV-16-admin-view-after-owner-deleted' );
	log( 'console', err );
	await ed.context.close();
} );

test( 'OV-15b block removal over inline; stale hint check', async ( { admin, editor, page, requestUtils, browser } ) => {
	const id = await newPost( requestUtils, 'OV-15b' );
	await adminOpen( { admin, editor, page }, id );
	await gesture( page, 'admin inline add', 'brown', 'start', () => page.keyboard.type( 'ADMINADD ', { delay: 20 } ) );
	await gesture( page, 'admin inline del', 'lazy ', undefined, () => page.keyboard.press( 'Backspace' ) );
	const c0 = await cards( page, 'hint before' );
	log( 'admin accepts own del', await decide( page, c0.find( ( x: any ) => /Delete:/.test( x.text ) )!.id, 'accept' ) );
	log( 'admin save', await savePost( page ) );
	await page.waitForTimeout( 3000 );
	await cards( page, 'HINT admin 3s after save' );
	await page.goto( '/wp-admin/' );
	const ed = await session( browser, USERS.editor );
	await ed.open( id );
	await canvasOf( ed.page ).locator( '.is-root-container > [data-block]' ).nth( 0 ).click();
	const removal = await withSave( ed.page, async () => {
		await ed.page.getByRole( 'toolbar', { name: 'Block tools' } ).getByRole( 'button', { name: 'Options' } ).click();
		await ed.page.getByRole( 'menuitem', { name: /^Delete/ } ).click();
	}, 8000 );
	log( 'OV-15 editor removes block holding admin inline suggestion', removal?.status ?? 'no note write' );
	log( 'OV-15 after editor remove', await blockSummary( ed.page ) );
	log( 'OV-15 snack', { snack: await snackbars( ed.page ), spoken: await spoken( ed.page ) } );
	log( 'OV-15 markers', compact( await markersIn( ed.page ) ) );
	const c3 = await cards( ed.page, 'OV-15 block removal over inline' );
	await shot( ed.page, 'OV-15-block-removal-over-others-inline' );
	const rem = c3.find( ( x: any ) => /Remove block/.test( x.text ) && x.buttons.includes( 'Accept suggestion' ) );
	if ( rem ) {
		log( 'OV-15 accept removal', await decide( ed.page, rem.id, 'accept' ) );
		log( 'OV-15 after accept', await blockSummary( ed.page ) );
		await cards( ed.page, 'OV-15 right after accept' );
		log( 'ed save', await savePost( ed.page ) );
		await ed.page.waitForTimeout( 3000 );
		await cards( ed.page, 'HINT editor 3s after save' );
		await shot( ed.page, 'OV-15-after-accepting-removal' );
		log( 'OV-15 notes', ( await notesFull( requestUtils, id ) ).map( ( n: any ) => `${ n.id }@${ n.author } ${ n.status } ${ n.ops } ${ n.sstatus ?? '' }` ) );
	}
	await ed.context.close();
} );
