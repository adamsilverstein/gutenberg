import { test } from '@wordpress/e2e-test-utils-playwright';
import { seedPost, openPost, openNotesSidebar } from '../../helpers';
import { setup, para, report, suggestionSaved, getMarkers, getBlocks, shot, log, brief } from './bc-util';

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

for ( const variant of [ 'shrink-then-rest', 'shrink-then-rest-sidebar-open', 'leave-and-return-then-all' ] ) {
	test( `ID-12x ${ variant }`, async ( { admin, editor, page, requestUtils } ) => {
		const f = { admin, editor, page, requestUtils };
		const ctx = await setup( f, `abc ID-12x ${ variant }` );
		await para( page, editor, 0, 20 );
		const s = safe( suggestionSaved( page ) );
		await page.keyboard.type( 'PENDING', { delay: 25 } );
		await s;
		await ctx.writes.quiet();
		if ( variant === 'shrink-then-rest-sidebar-open' ) await openNotesSidebar( page );
		await para( page, editor, 2, 0 );
		if ( variant !== 'leave-and-return-then-all' ) {
			await para( page, editor, 0, 22 );
			await shift( page, 3 );
			log( 'sel 1', await selText( editor ) );
			await page.keyboard.press( 'Delete' );
			await page.waitForTimeout( 1500 );
			log( 'after shrink', brief( await getMarkers( editor ) ) );
			await para( page, editor, 2, 0 );
		}
		await para( page, editor, 0, 20 );
		await shift( page, variant === 'leave-and-return-then-all' ? 7 : 4 );
		await page.waitForTimeout( 300 );
		log( 'sel 2', await selText( editor ) );
		await page.keyboard.press( 'Backspace' );
		await page.waitForTimeout( 6000 );
		log( `${ variant } statuses`, await allStatuses( requestUtils, ctx.postId ) );
		await report( ctx, `ID-12x ${ variant }`, [ 1 ], f, `ID-12-${ variant }` );
	} );
}

test( 'ID-08f paced references', async ( { admin, editor, page, requestUtils } ) => {
	for ( const key of [ 'Backspace', 'Delete' ] ) {
		const postId = await seedPost( requestUtils, { title: `abc ID-08f ${ key }` } );
		await openPost( admin, editor, postId );
		await para( page, editor, 2, 40 );
		await shift( page, 24 + 17 );
		await page.waitForTimeout( 500 );
		await page.keyboard.press( key );
		const blocks = await getBlocks( page );
		log( `editing paced ${ key } result`, blocks.map( ( b: any ) => b.content ).slice( 3, 5 ) );
	}
	const f = { admin, editor, page, requestUtils };
	const ctx = await setup( f, 'abc ID-08f suggest backspace' );
	await para( page, editor, 2, 40 );
	await shift( page, 24 + 17 );
	await page.waitForTimeout( 500 );
	const s = safe( suggestionSaved( page ) );
	await page.keyboard.press( 'Backspace' );
	await s;
	await ctx.writes.quiet();
	const blocks = await getBlocks( page );
	log( 'suggest paced Backspace', blocks.slice( 3, 5 ).map( ( b: any ) => b.metadata ) );
} );
