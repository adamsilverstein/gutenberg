import type { Page } from '@playwright/test';
import { seedPost, openPost, switchIntent, suggestionSaved, getMarkers, getBlocks, getNotes, getSidebarNoteTexts, shot, collectConsole } from '../../helpers';
import { log, notices, brief } from './util';

/** Tracks note writes so a flow can wait for the debounced saves to go quiet. */
export function trackWrites( page: Page ) {
	const state = { inflight: 0, last: Date.now(), log: [] as string[] };
	const isWrite = ( r: any ) => /\/wp\/v2\/comments/.test( r.url() ) && [ 'POST', 'PUT', 'DELETE' ].includes( r.method() );
	page.on( 'request', ( r ) => { if ( isWrite( r ) ) { state.inflight++; state.last = Date.now(); } } );
	const done = async ( r: any ) => {
		if ( ! isWrite( r ) ) return;
		state.inflight--; state.last = Date.now();
		const res = await r.response().catch( () => null );
		const override = r.headers()[ 'x-http-method-override' ];
		state.log.push( `${ override || r.method() } ${ r.url().replace( /^.*wp\/v2/, '' ).slice( 0, 40 ) } -> ${ res ? res.status() : 'failed' }` );
	};
	page.on( 'requestfinished', done );
	page.on( 'requestfailed', done );
	return {
		state,
		async quiet( ms = 2500, max = 20000 ) {
			const start = Date.now();
			while ( Date.now() - start < max ) {
				if ( state.inflight === 0 && Date.now() - state.last > ms ) return;
				await page.waitForTimeout( 200 );
			}
		},
	};
}

export async function setup( { admin, editor, page, requestUtils }: any, title: string, content?: string ) {
	const errors = collectConsole( page );
	const postId = await seedPost( requestUtils, content ? { title, content } : { title } );
	await openPost( admin, editor, postId );
	const writes = trackWrites( page );
	await switchIntent( page, 'Suggesting' );
	return { postId, errors, writes };
}

export async function caretOffset( editor: any, index: number ) {
	return editor.canvas.locator( '[data-type="core/paragraph"]' ).nth( index ).evaluate( ( el: HTMLElement ) => {
		const sel = el.ownerDocument.defaultView!.getSelection()!;
		if ( ! sel.rangeCount || ! el.contains( sel.focusNode ) ) return -1;
		const r = el.ownerDocument.createRange();
		r.selectNodeContents( el );
		r.setEnd( sel.focusNode!, sel.focusOffset );
		return r.toString().replace( /\uFEFF/g, '' ).length;
	} );
}

/** Click a paragraph, then walk the caret with real arrow keys to a text offset (verified by reading the DOM selection). */
export async function para( page: Page, editor: any, index: number, offset: number | 'end' ) {
	const p = editor.canvas.locator( '[data-type="core/paragraph"]' ).nth( index );
	await p.click();
	if ( offset === 'end' ) {
		await page.keyboard.press( 'End' );
		log( `caret p${ index }`, await caretOffset( editor, index ) );
		return p;
	}
	await page.keyboard.press( 'Home' );
	for ( let tries = 0; tries < 6; tries++ ) {
		const at = await caretOffset( editor, index );
		if ( at === offset ) break;
		const key = at < offset ? 'ArrowRight' : 'ArrowLeft';
		for ( let i = 0; i < Math.abs( offset - at ); i++ ) await page.keyboard.press( key );
	}
	log( `caret p${ index } want ${ offset }`, await caretOffset( editor, index ) );
	return p;
}

export async function report( ctx: any, flow: string, blockIdx: number[], { page, editor, requestUtils }: any, shotName?: string ) {
	await ctx.writes.quiet();
	const markers = await getMarkers( editor );
	log( `${ flow } MARKERS`, brief( markers ) );
	const blocks = await getBlocks( page );
	log( `${ flow } BLOCKCOUNT`, blocks.length + ' ' + blocks.map( ( b: any ) => b.name.replace( 'core/', '' ) + ( b.metadata ? JSON.stringify( b.metadata ) : '' ) ).join( ' | ' ) );
	for ( const i of blockIdx ) log( `${ flow } BLOCK${ i }`, { content: blocks[ i ]?.content, metadata: blocks[ i ]?.metadata } );
	log( `${ flow } RENDERED`, await editor.canvas.locator( '.is-root-container > [data-type]' ).evaluateAll( ( els: HTMLElement[] ) => els.slice( 0, 5 ).map( ( e ) => `${ e.className.split( ' ' ).filter( ( c ) => /suggestion|pending/.test( c ) ).join( '.' ) }:${ e.innerText }` ) ) );
	const notes = await getNotes( requestUtils, ctx.postId );
	log( `${ flow } NOTES`, notes.map( ( n: any ) => ( { id: n.id, status: n.status, content: n.content, sug: n.meta?._wp_suggestion, st: n.meta?._wp_suggestion_status } ) ) );
	log( `${ flow } WRITES`, ctx.writes.state.log );
	log( `${ flow } NOTICES`, await notices( page ) );
	const hasToggle = await page.getByRole( 'region', { name: 'Editor top bar' } ).getByRole( 'button', { name: 'All notes', exact: true } ).count();
	log( `${ flow } SIDEBAR`, hasToggle ? await getSidebarNoteTexts( page ) : 'no All notes button (no notes)' );
	log( `${ flow } ERRORS`, ctx.errors );
	if ( shotName ) {
		await page.waitForTimeout( 400 );
		await shot( page, shotName );
	}
	return { markers, blocks, notes };
}

export { suggestionSaved, getMarkers, getBlocks, getNotes, shot, log, brief, switchIntent };
