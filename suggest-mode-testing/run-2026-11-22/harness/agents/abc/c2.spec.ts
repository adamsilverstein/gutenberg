import { test } from '@wordpress/e2e-test-utils-playwright';
import { seedPost, openPost } from '../../helpers';
import { setup, para, report, caretOffset, suggestionSaved, getMarkers, getBlocks, getNotes, shot, log, brief } from './bc-util';

const safe = ( p: Promise< any > ) => p.catch( ( e ) => log( 'NO SAVE RESPONSE', String( e ).slice( 0, 100 ) ) );
const selText = ( editor: any ) => editor.canvas.locator( 'body' ).evaluate( ( b: HTMLElement ) => b.ownerDocument.defaultView!.getSelection()!.toString() );
const shift = async ( page: any, n: number, key = 'ArrowRight' ) => { for ( let i = 0; i < n; i++ ) await page.keyboard.press( `Shift+${ key }` ); };
const allStatuses = async ( requestUtils: any, postId: number ) => {
	const out: any[] = [];
	for ( const status of [ 'hold', 'approve', 'trash' ] ) {
		const notes = await requestUtils.rest( { path: '/wp/v2/comments', params: { post: postId, type: 'note', status, per_page: 100, context: 'edit' } } );
		out.push( ...notes.map( ( n: any ) => `${ n.id }:${ n.status }:${ n.meta?._wp_suggestion_status }` ) );
	}
	return out;
};

for ( const variant of [ 'select-backspace', 'char-backspace', 'select-delete' ] ) {
	test( `ID-12w withdraw whole own addition (${ variant })`, async ( { admin, editor, page, requestUtils } ) => {
		const f = { admin, editor, page, requestUtils };
		const ctx = await setup( f, `abc ID-12w ${ variant }` );
		await para( page, editor, 0, 20 );
		const s = safe( suggestionSaved( page ) );
		await page.keyboard.type( 'PENG', { delay: 25 } );
		await s;
		await ctx.writes.quiet();
		log( 'before', brief( await getMarkers( editor ) ) );
		if ( variant === 'char-backspace' ) {
			for ( let i = 0; i < 4; i++ ) { await page.keyboard.press( 'Backspace' ); await page.waitForTimeout( 120 ); }
		} else {
			await shift( page, 4, 'ArrowLeft' );
			log( 'selection', await selText( editor ) );
			await page.keyboard.press( variant === 'select-delete' ? 'Delete' : 'Backspace' );
		}
		await page.waitForTimeout( 4000 );
		await ctx.writes.quiet();
		log( `${ variant } statuses`, await allStatuses( requestUtils, ctx.postId ) );
		await report( ctx, `ID-12w ${ variant }`, [ 1 ], f, `ID-12-withdraw-${ variant }` );
	} );
}

test( 'ID-08c backspace across blocks, logged', async ( { admin, editor, page, requestUtils } ) => {
	const f = { admin, editor, page, requestUtils };
	const ctx = await setup( f, 'abc ID-08c' );
	await para( page, editor, 2, 40 );
	await shift( page, 24 + 17 );
	log( 'ID-08c selection', { text: await selText( editor ), store: await page.evaluate( () => { const s = ( window as any ).wp.data.select( 'core/block-editor' ); return [ s.getSelectionStart(), s.getSelectionEnd() ].map( ( x: any ) => x.offset ); } ) } );
	const s = safe( suggestionSaved( page ) );
	await page.keyboard.press( 'Backspace' );
	await s;
	await report( ctx, 'ID-08c', [ 3, 4 ], f, 'ID-08-backspace-spanning-two-blocks' );
} );

test( 'ID-08e editing-mode reference for the same gestures', async ( { admin, editor, page, requestUtils } ) => {
	for ( const key of [ 'Backspace', 'Delete' ] ) {
		const postId = await seedPost( requestUtils, { title: `abc ID-08e ${ key }` } );
		await openPost( admin, editor, postId );
		await para( page, editor, 2, 40 );
		await shift( page, 24 + 17 );
		log( `editing ${ key } selection`, await selText( editor ) );
		await page.keyboard.press( key );
		const blocks = await getBlocks( page );
		log( `editing ${ key } result`, blocks.map( ( b: any ) => b.content ).slice( 2, 5 ) );
	}
} );
