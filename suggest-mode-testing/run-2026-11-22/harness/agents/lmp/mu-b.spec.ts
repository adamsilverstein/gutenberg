import { test } from '@wordpress/e2e-test-utils-playwright';
import { seedPost, openPost, switchIntent, shot, USERS, collectConsole } from '../../helpers';
import { log, takeOver, openAs, markersIn, blocksOf, selectIn, focusBlock, withSave, savePost, snackbars, notesFull, sidebarCards, decide } from './lib';

const rawMeta = async ( requestUtils: any, id: number | string ) => {
	const n = await requestUtils.rest( { path: `/wp/v2/comments/${ id }`, params: { context: 'edit' } } );
	const { _wp_suggestion, ...meta } = n.meta;
	return { id: n.id, status: n.status, author: n.author, meta };
};

test( 'MU-06 07 09 10', async ( { admin, editor, page, pageUtils, requestUtils, browser } ) => {
	const postId = await seedPost( requestUtils, { title: 'lmp MU-06-10' } );
	log( 'POST', postId );
	let ed = await openAs( browser, USERS.editor, postId );
	await switchIntent( ed.page, 'Suggesting' );
	await focusBlock( ed.page, 1 );
	await selectIn( ed.page, 1, 'brown', 'start' );
	log( 'ED add', ( await withSave( ed.page, () => ed.page.keyboard.type( 'EDADD ', { delay: 20 } ) ) )?.status );
	log( 'ED save', await savePost( ed.page ) );
	await ed.context.close();

	const err = collectConsole( page );
	await openPost( admin, editor, postId );
	log( 'ADMIN lock', await takeOver( page ) );
	await switchIntent( page, 'Suggesting' );
	await focusBlock( page, 1 );
	await selectIn( page, 1, 'lazy', 'start' );
	log( 'ADMIN add', ( await withSave( page, () => page.keyboard.type( 'ADMINADD ', { delay: 20 } ) ) )?.status );
	await selectIn( page, 1, 'riverbank' );
	log( 'ADMIN bold', ( await withSave( page, () => pageUtils.pressKeys( 'primary+b' ) ) )?.status );
	log( 'MU-06 markers', await markersIn( page ) );
	log( 'MU-06 block1', ( await blocksOf( page ) )[ 1 ] );
	log( 'MU-06 cards', await sidebarCards( page ) );
	log( 'MU-06 notes', await notesFull( requestUtils, postId ) );
	await shot( page, 'MU-06-mixed-author-same-block' );
	log( 'ADMIN save', await savePost( page ) );
	log( 'ADMIN console', err );
	await page.goto( '/wp-admin/' );

	// editor again: format + overlapping delete
	ed = await openAs( browser, USERS.editor, postId );
	const edErr = collectConsole( ed.page );
	log( 'ED lock', ed.lock );
	await switchIntent( ed.page, 'Suggesting' );
	await focusBlock( ed.page, 1 );
	await selectIn( ed.page, 1, 'quick' );
	log( 'ED bold', ( await withSave( ed.page, () => ed.page.keyboard.press( 'ControlOrMeta+b' ) ) )?.status );
	log( 'MU-03 format tint markers', ( await markersIn( ed.page ) ).filter( ( m: any ) => m.type === 'format' ) );
	await shot( ed.page, 'MU-03-format-markers-per-author' );
	await selectIn( ed.page, 1, 'the ADMINADD lazy' );
	log( 'MU-07 ED delete over admin add', ( await withSave( ed.page, () => ed.page.keyboard.press( 'Backspace' ) ) )?.status );
	log( 'MU-07 snack', await snackbars( ed.page ) );
	log( 'MU-07 markers', await markersIn( ed.page ) );
	log( 'MU-07 block1', ( await blocksOf( ed.page ) )[ 1 ] );
	const cards = await sidebarCards( ed.page );
	log( 'MU-07 cards', cards );
	await shot( ed.page, 'MU-07-overlap-conflict' );
	log( 'MU-07 notes', await notesFull( requestUtils, postId ) );
	log( 'ED save', await savePost( ed.page ) );

	// MU-10 editor withdraws own EDADD
	const own = cards.find( ( c: any ) => /EDADD/.test( c.text ) && /^.*Add:/.test( c.text ) );
	log( 'MU-10 own card', own );
	log( 'MU-10 reject status', await decide( ed.page, own!.id, 'reject' ) );
	log( 'MU-10 snack', await snackbars( ed.page ) );
	log( 'MU-10 block1', ( await blocksOf( ed.page ) )[ 1 ] );
	log( 'MU-10 meta pre-save', await rawMeta( requestUtils, own!.id ) );
	log( 'MU-10 cards', await sidebarCards( ed.page ) );
	await shot( ed.page, 'MU-10-suggester-withdraws-own' );
	log( 'ED save', await savePost( ed.page ) );
	log( 'MU-10 meta post-save', await rawMeta( requestUtils, own!.id ) );
	log( 'ED console', edErr );
	await ed.context.close();

	// MU-09 admin accepts editor's suggestions
	await openPost( admin, editor, postId );
	log( 'ADMIN lock', await takeOver( page ) );
	const c2 = await sidebarCards( page );
	log( 'MU-09 cards', c2 );
	const edFormat = c2.find( ( c: any ) => /editor-user/.test( c.text ) && /formatting/.test( c.text ) );
	log( 'MU-09 accept status', await decide( page, edFormat!.id, 'accept' ) );
	log( 'MU-09 snack', await snackbars( page ) );
	log( 'MU-09 block1', ( await blocksOf( page ) )[ 1 ] );
	log( 'MU-09 meta pre-save', await rawMeta( requestUtils, edFormat!.id ) );
	log( 'ADMIN save', await savePost( page ) );
	log( 'MU-09 meta post-save', await rawMeta( requestUtils, edFormat!.id ) );
	await page.getByRole( 'region', { name: 'Editor settings' } ).getByRole( 'button', { name: 'Filter' } ).click().catch( () => {} );
	await page.waitForTimeout( 500 );
	log( 'MU-09 filter menu', await page.locator( '[role="menu"], [role="dialog"], .components-popover' ).allInnerTexts() );
	await shot( page, 'MU-09-accept-other-users-suggestion' );
	await page.keyboard.press( 'Escape' );
	log( 'MU-09 cards after', await sidebarCards( page ) );
	log( 'MU-09 notes', await notesFull( requestUtils, postId ) );
	log( 'ADMIN console', err );
} );
