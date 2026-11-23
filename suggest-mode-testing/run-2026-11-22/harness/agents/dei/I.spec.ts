import { test } from '@wordpress/e2e-test-utils-playwright';
import { seedPost, openPost, switchIntent, suggestionSaved, shot, collectConsole, getBlocks, getMarkers, getNotes, openNotesSidebar } from '../../helpers';
import { P, dump, selectWord, caretBefore, settle, summaries } from './util';

async function start( { admin, editor, page, requestUtils }: any, title: string ) {
	const postId = await seedPost( requestUtils, { title } );
	await openPost( admin, editor, postId );
	const errors = collectConsole( page );
	await switchIntent( page, 'Suggesting' );
	return { postId, errors };
}

const fmt = ( ms: any[] ) => ms.map( ( m ) => `${ m.type }:${ JSON.stringify( m.text ) }` );

async function state( label: string, { editor, page, requestUtils, postId }: any, sidebar = true ) {
	const blocks = await getBlocks( page );
	const notes = await getNotes( requestUtils, postId );
	const out = {
		markers: fmt( await getMarkers( editor ) ),
		notes: notes.map( ( n: any ) => `${ n.id }:${ n.status }:${ n.meta?._wp_suggestion_status }` ),
		summaries: sidebar ? await summaries( page ) : [ '(sidebar not opened, focus kept in canvas)' ],
		blocks: blocks.map( ( b: any ) => b.name.replace( 'core/', '' ) + ( b.metadata?.suggestion ? `(${ b.metadata.suggestion.type })` : '' ) ).join( ',' ),
		ghosts: await editor.canvas.locator( '.is-suggestion-move-ghost' ).count(),
		texts: blocks.map( ( b: any ) => b.content ).filter( ( c: any ) => c !== undefined ),
	};
	console.log( `STATE ${ label }`, JSON.stringify( out ) );
	return out;
}

async function undo( page: any, pageUtils: any, key = 'primary+z' ) {
	await pageUtils.pressKeys( key );
	await settle( page, 2500 );
}

async function trashed( requestUtils: any, postId: number ) {
	const t = await requestUtils.rest( { path: '/wp/v2/comments', params: { post: postId, type: 'note', status: 'trash', per_page: 100, context: 'edit' } } ).catch( ( e: Error ) => 'ERR ' + e.message );
	return Array.isArray( t ) ? t.map( ( n: any ) => n.id ) : t;
}

test( 'UN-01 undo a typed addition', async ( { admin, editor, page, requestUtils, pageUtils } ) => {
	const ctx = { editor, page, requestUtils, ...( await start( { admin, editor, page, requestUtils }, 'dei UN-01' ) ) };
	await caretBefore( editor, page, 0, 'jumps' );
	const saved = suggestionSaved( page );
	await page.keyboard.type( 'ADDED ', { delay: 25 } );
	await saved; await settle( page );
	await state( 'UN-01 before', ctx, false );
	await shot( page, 'UN-01-before-undo' );
	await undo( page, pageUtils );
	await state( 'UN-01 after 1 undo', ctx );
	console.log( 'TRASH', JSON.stringify( await trashed( requestUtils, ctx.postId ) ) );
	await shot( page, 'UN-01-undo-addition' );
	console.log( 'ERRORS', JSON.stringify( ctx.errors ) );
} );

test( 'UN-02 undo a deletion', async ( { admin, editor, page, requestUtils, pageUtils } ) => {
	const ctx = { editor, page, requestUtils, ...( await start( { admin, editor, page, requestUtils }, 'dei UN-02' ) ) };
	await selectWord( editor, page, 0, 'jumps' );
	const saved = suggestionSaved( page );
	await page.keyboard.press( 'Backspace' );
	await saved; await settle( page );
	await state( 'UN-02 before', ctx, false );
	await undo( page, pageUtils );
	await state( 'UN-02 after 1 undo', ctx );
	await shot( page, 'UN-02-undo-deletion' );
	console.log( 'ERRORS', JSON.stringify( ctx.errors ) );
} );

test( 'UN-03 undo a type-over', async ( { admin, editor, page, requestUtils, pageUtils } ) => {
	const ctx = { editor, page, requestUtils, ...( await start( { admin, editor, page, requestUtils }, 'dei UN-03' ) ) };
	await selectWord( editor, page, 0, 'jumps' );
	const saved = suggestionSaved( page );
	await page.keyboard.type( 'leaps', { delay: 25 } );
	await saved; await settle( page );
	await state( 'UN-03 before', ctx, false );
	await undo( page, pageUtils );
	await state( 'UN-03 after 1 undo', ctx );
	await shot( page, 'UN-03-undo-type-over' );
	await undo( page, pageUtils );
	await state( 'UN-03 after 2 undos', ctx );
	console.log( 'ERRORS', JSON.stringify( ctx.errors ) );
} );

test( 'UN-04 undo a format suggestion', async ( { admin, editor, page, requestUtils, pageUtils } ) => {
	const ctx = { editor, page, requestUtils, ...( await start( { admin, editor, page, requestUtils }, 'dei UN-04' ) ) };
	await selectWord( editor, page, 0, 'jumps' );
	const saved = suggestionSaved( page );
	await pageUtils.pressKeys( 'primary+b' );
	await saved; await settle( page );
	await state( 'UN-04 before', ctx, false );
	await undo( page, pageUtils );
	await state( 'UN-04 after 1 undo', ctx );
	await shot( page, 'UN-04-undo-format' );
	// Second half: undo a "remove bold" suggestion keeps the original bold.
	await selectWord( editor, page, 1, 'bold words' );
	const saved2 = suggestionSaved( page );
	await pageUtils.pressKeys( 'primary+b' );
	await saved2; await settle( page );
	await state( 'UN-04b before', ctx, false );
	await undo( page, pageUtils );
	await state( 'UN-04b after 1 undo', ctx );
	await shot( page, 'UN-04-undo-remove-format' );
	console.log( 'ERRORS', JSON.stringify( ctx.errors ) );
} );

test( 'UN-05 undo each structural type', async ( { admin, editor, page, requestUtils, pageUtils } ) => {
	const ctx = { editor, page, requestUtils, ...( await start( { admin, editor, page, requestUtils }, 'dei UN-05' ) ) };
	// Insert.
	await caretBefore( editor, page, 3, 'Fourth' );
	await page.keyboard.press( 'End' );
	let saved = suggestionSaved( page );
	await page.keyboard.press( 'Enter' );
	await page.keyboard.type( 'Brand new paragraph', { delay: 20 } );
	await saved; await settle( page );
	await state( 'UN-05 insert before', ctx, false );
	await shot( page, 'UN-05-insert-before-undo' );
	await undo( page, pageUtils );
	const s1 = await state( 'UN-05 insert after 1 undo', ctx );
	if ( s1.notes.length ) { await undo( page, pageUtils ); await state( 'UN-05 insert after 2 undos', ctx ); }
	// Remove.
	await caretBefore( editor, page, 2, 'Third' );
	saved = suggestionSaved( page );
	await editor.clickBlockOptionsMenuItem( 'Delete' );
	await saved; await settle( page );
	await state( 'UN-05 remove before', ctx, false );
	await shot( page, 'UN-05-remove-before-undo' );
	await undo( page, pageUtils );
	await state( 'UN-05 remove after 1 undo', ctx );
	// Move.
	await caretBefore( editor, page, 1, 'second' );
	saved = suggestionSaved( page );
	await editor.clickBlockToolbarButton( 'Move down' );
	await saved; await settle( page );
	await state( 'UN-05 move before', ctx, false );
	await shot( page, 'UN-05-move-before-undo' );
	await undo( page, pageUtils );
	await state( 'UN-05 move after 1 undo', ctx );
	await shot( page, 'UN-05-undo-structural' );
	console.log( 'ERRORS', JSON.stringify( ctx.errors ) );
} );

test( 'UN-06 repeated undo, newest-first', async ( { admin, editor, page, requestUtils, pageUtils } ) => {
	const ctx = { editor, page, requestUtils, ...( await start( { admin, editor, page, requestUtils }, 'dei UN-06' ) ) };
	const pristine = JSON.stringify( ( await getBlocks( page ) ).map( ( b: any ) => b.content ) );
	const step = async ( fn: () => Promise< void > ) => { const saved = suggestionSaved( page ); await fn(); await saved; await settle( page, 1200 ); };
	// 1 add (p0)
	await caretBefore( editor, page, 0, 'jumps' );
	await step( () => page.keyboard.type( 'ADDED ', { delay: 25 } ) );
	// 2 delete (p1)
	await selectWord( editor, page, 1, 'second' );
	await step( () => page.keyboard.press( 'Backspace' ) );
	// 3 format (p2)
	await selectWord( editor, page, 2, 'plain' );
	await step( () => pageUtils.pressKeys( 'primary+b' ) );
	// 4 insert block after p3
	await caretBefore( editor, page, 3, 'Fourth' );
	await page.keyboard.press( 'End' );
	await step( async () => { await page.keyboard.press( 'Enter' ); await page.keyboard.type( 'Inserted block', { delay: 20 } ); } );
	// 5 remove block (heading)
	await editor.canvas.locator( 'h2[data-type="core/heading"]' ).click();
	await step( () => editor.clickBlockOptionsMenuItem( 'Delete' ) );
	await state( 'UN-06 five made', ctx, false );
	await shot( page, 'UN-06-five-suggestions' );
	for ( let i = 1; i <= 12; i++ ) {
		await undo( page, pageUtils );
		const s = await state( `UN-06 after undo ${ i }`, ctx );
		if ( ! s.notes.length && ! s.markers.length ) { console.log( 'UNDOS NEEDED', i ); break; }
	}
	console.log( 'PRISTINE', pristine === JSON.stringify( ( await getBlocks( page ) ).map( ( b: any ) => b.content ) ) );
	await shot( page, 'UN-06-repeated-undo' );
	console.log( 'ERRORS', JSON.stringify( ctx.errors ) );
} );

test( 'UN-07 redo after undo', async ( { admin, editor, page, requestUtils, pageUtils } ) => {
	const ctx = { editor, page, requestUtils, ...( await start( { admin, editor, page, requestUtils }, 'dei UN-07' ) ) };
	await caretBefore( editor, page, 0, 'jumps' );
	const saved = suggestionSaved( page );
	await page.keyboard.type( 'REDOME ', { delay: 25 } );
	await saved; await settle( page );
	await state( 'UN-07 before', ctx, false );
	await undo( page, pageUtils );
	await state( 'UN-07 after undo', ctx );
	await undo( page, pageUtils, 'primary+shift+z' );
	await state( 'UN-07 after redo', ctx );
	await shot( page, 'UN-07-redo-after-undo' );
	for ( let i = 0; i < 3; i++ ) await pageUtils.pressKeys( 'primary+shift+z' );
	await settle( page, 2000 );
	await state( 'UN-07 after 3 more redos', ctx );
	// Is the restored suggestion still reviewable?
	const sidebar = await openNotesSidebar( page );
	console.log( 'ACCEPT BUTTONS', await sidebar.getByRole( 'button', { name: 'Accept suggestion' } ).count() );
	console.log( 'ERRORS', JSON.stringify( ctx.errors ) );
} );

test( 'UN-08 undo after accept', async ( { admin, editor, page, requestUtils, pageUtils } ) => {
	const ctx = { editor, page, requestUtils, ...( await start( { admin, editor, page, requestUtils }, 'dei UN-08' ) ) };
	await caretBefore( editor, page, 0, 'jumps' );
	const saved = suggestionSaved( page );
	await page.keyboard.type( 'ACCEPTME ', { delay: 25 } );
	await saved; await settle( page );
	await switchIntent( page, 'Editing' );
	const sidebar = await openNotesSidebar( page );
	await sidebar.getByRole( 'button', { name: 'Accept suggestion' } ).click();
	await settle( page, 2500 );
	console.log( 'SNACK', JSON.stringify( await page.locator( '.components-snackbar-list .components-snackbar' ).allInnerTexts() ) );
	await state( 'UN-08 after accept', ctx );
	console.log( 'SIDEBAR accepted', JSON.stringify( await sidebar.innerText() ).slice( 0, 500 ) );
	await shot( page, 'UN-08-after-accept' );
	await undo( page, pageUtils );
	await state( 'UN-08 after undo', ctx );
	console.log( 'ACCEPT BUTTONS', await sidebar.getByRole( 'button', { name: 'Accept suggestion' } ).count(), 'REJECT', await sidebar.getByRole( 'button', { name: 'Reject suggestion' } ).count() );
	console.log( 'SIDEBAR after undo', JSON.stringify( await sidebar.innerText() ).slice( 0, 500 ) );
	await shot( page, 'UN-08-undo-after-accept' );
	await undo( page, pageUtils, 'primary+shift+z' );
	await state( 'UN-08 after redo', ctx );
	console.log( 'SIDEBAR after redo', JSON.stringify( await sidebar.innerText() ).slice( 0, 500 ) );
	console.log( 'ERRORS', JSON.stringify( ctx.errors ) );
} );

test( 'UN-09 undo across mode switch', async ( { admin, editor, page, requestUtils, pageUtils } ) => {
	const ctx = { editor, page, requestUtils, ...( await start( { admin, editor, page, requestUtils }, 'dei UN-09' ) ) };
	await caretBefore( editor, page, 0, 'jumps' );
	const saved = suggestionSaved( page );
	await page.keyboard.type( 'SWITCH ', { delay: 25 } );
	await saved; await settle( page );
	await state( 'UN-09 before', ctx, false );
	await switchIntent( page, 'Editing' );
	await undo( page, pageUtils );
	await state( 'UN-09 after undo in Editing', ctx );
	await shot( page, 'UN-09-undo-across-mode-switch' );
	await undo( page, pageUtils, 'primary+shift+z' );
	await state( 'UN-09 after redo in Editing', ctx );
	console.log( 'ERRORS', JSON.stringify( ctx.errors ) );
} );

test( 'UN-05b undo past a withdrawn block insertion', async ( { admin, editor, page, requestUtils, pageUtils } ) => {
	const ctx = { editor, page, requestUtils, ...( await start( { admin, editor, page, requestUtils }, 'dei UN-05b' ) ) };
	const pristine = JSON.stringify( ( await getBlocks( page ) ).map( ( b: any ) => b.content ) );
	await caretBefore( editor, page, 0, 'jumps' );
	let saved = suggestionSaved( page );
	await page.keyboard.type( 'ADDED ', { delay: 25 } );
	await saved; await settle( page );
	await caretBefore( editor, page, 3, 'Fourth' );
	await page.keyboard.press( 'End' );
	saved = suggestionSaved( page );
	await page.keyboard.press( 'Enter' );
	await page.keyboard.type( 'Inserted block', { delay: 20 } );
	await saved; await settle( page );
	await state( 'UN-05b made', ctx, false );
	for ( let i = 1; i <= 8; i++ ) {
		await undo( page, pageUtils );
		const s = await state( `UN-05b after undo ${ i }`, ctx );
		if ( i === 2 ) await shot( page, 'UN-06-undo-resurrects-inserted-block' );
		if ( ! s.notes.length && ! s.markers.length && s.blocks.split( ',' ).length === 7 ) { console.log( 'UNDOS NEEDED', i ); break; }
	}
	console.log( 'PRISTINE', pristine === JSON.stringify( ( await getBlocks( page ) ).map( ( b: any ) => b.content ) ) );
	console.log( 'TRASH', JSON.stringify( await trashed( requestUtils, ctx.postId ) ) );
	console.log( 'ERRORS', JSON.stringify( ctx.errors ) );
} );
