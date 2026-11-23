import type { Page } from '@playwright/test';
import { getMarkers, getBlocks, getNotes, openNotesSidebar } from '../../helpers';

export const P = 'p[data-type="core/paragraph"]';

export async function summaries( page: Page ) {
	const toggle = page.getByRole( 'region', { name: 'Editor top bar' } ).getByRole( 'button', { name: 'All notes', exact: true } );
	if ( ! ( await toggle.count() ) ) return [ '(no All notes button)' ];
	const sidebar = await openNotesSidebar( page );
	await page.waitForTimeout( 400 );
	return sidebar.locator( '.editor-collab-sidebar-panel__suggestion-summary' ).allInnerTexts();
}

export async function selText( editor: any ) {
	return editor.canvas.locator( 'body' ).evaluate( ( b: HTMLElement ) => b.ownerDocument.getSelection()?.toString() );
}

/** Page coordinates of a text run inside a block (first occurrence). */
export async function wordRect( page: Page, block: any, word: string ) {
	const r = await block.evaluate( ( el: HTMLElement, w: string ) => {
		const doc = el.ownerDocument;
		const walker = doc.createTreeWalker( el, 4 );
		let node: any;
		while ( ( node = walker.nextNode() ) ) {
			const idx = node.data.indexOf( w );
			if ( idx >= 0 ) {
				const range = doc.createRange();
				range.setStart( node, idx );
				range.setEnd( node, idx + w.length );
				const b = range.getBoundingClientRect();
				return { x: b.x, y: b.y, width: b.width, height: b.height };
			}
		}
		return null;
	}, word );
	if ( ! r ) throw new Error( `text "${ word }" not found in a single text node` );
	const frame = await page.locator( 'iframe[name="editor-canvas"]' ).boundingBox();
	return { x: r.x + ( frame?.x || 0 ), y: r.y + ( frame?.y || 0 ), width: r.width, height: r.height };
}

/** Selects `word` in the nth paragraph: click at its start, then Shift+Arrow across it. */
export async function selectWord( editor: any, page: Page, nth: number, word: string, selector = P ) {
	const p = await caretBefore( editor, page, nth, word, selector );
	for ( let i = 0; i < word.length; i++ ) await page.keyboard.press( 'Shift+ArrowRight' );
	const got = await selText( editor );
	console.log( 'SELECTION', JSON.stringify( got ) );
	if ( got !== word ) throw new Error( `selection is "${ got }", wanted "${ word }"` );
	return p;
}

/** Caret before `word` in the nth paragraph, by a real mouse click, corrected with arrows. */
export async function caretBefore( editor: any, page: Page, nth: number, word: string, selector = P ) {
	const p = editor.canvas.locator( selector ).nth( nth );
	const r = await wordRect( page, p, word );
	await page.mouse.click( r.x + 1, r.y + r.height / 2 );
	// Verify and correct the caret using the rendered text offset.
	for ( let tries = 0; tries < 4; tries++ ) {
		const delta = await p.evaluate( ( el: HTMLElement, w: string ) => {
			const doc = el.ownerDocument;
			const sel = doc.getSelection()!;
			if ( ! sel.rangeCount || ! el.contains( sel.anchorNode ) ) return null;
			const pre = doc.createRange();
			pre.selectNodeContents( el );
			pre.setEnd( sel.anchorNode!, sel.anchorOffset );
			return el.textContent!.indexOf( w ) - pre.toString().length;
		}, word );
		if ( delta === null ) { await p.click(); continue; }
		if ( delta === 0 ) break;
		for ( let i = 0; i < Math.abs( delta ); i++ ) await page.keyboard.press( delta > 0 ? 'ArrowRight' : 'ArrowLeft' );
	}
	return p;
}

export async function dump( label: string, { editor, page, requestUtils, postId, blocks = [ 1 ] }: any ) {
	console.log( `--- ${ label }` );
	console.log( 'MARKERS', JSON.stringify( ( await getMarkers( editor ) ).map( ( m: any ) => `${ m.tag }#${ m.id }:${ m.type }:${ JSON.stringify( m.text ) }[${ m.className }]` ) ) );
	const all = await getBlocks( page );
	console.log( 'BLOCKCOUNT', all.length, all.map( ( b: any ) => b.name.replace( 'core/', '' ) + ( b.metadata?.suggestion ? `(${ b.metadata.suggestion.type })` : '' ) ).join( ',' ) );
	for ( const i of blocks ) {
		if ( all[ i ] ) console.log( `BLOCK${ i }`, JSON.stringify( { content: all[ i ].content, metadata: all[ i ].metadata, attributes: all[ i ].attributes } ) );
	}
	if ( postId ) {
		const notes = await getNotes( requestUtils, postId );
		console.log( 'NOTES', notes.length, JSON.stringify( notes ) );
	}
	console.log( 'SUMMARIES', JSON.stringify( await summaries( page ) ) );
}

export async function settle( page: Page, ms = 1500 ) {
	await page.waitForTimeout( ms );
}
