import type { Page } from '@playwright/test';
import { getBlocks, getMarkers, openNotesSidebar } from '../../helpers';

export function flat( blocks: any[], depth = 0, out: any[] = [] ) {
	for ( const b of blocks ) {
		out.push(
			`${ '  '.repeat( depth ) }${ b.name } ${ JSON.stringify( ( b.content ?? '' ).slice( 0, 90 ) ) } meta=${ JSON.stringify( b.metadata ?? null ) } attrs=${ JSON.stringify( b.attributes ).slice( 0, 260 ) }`
		);
		flat( b.innerBlocks, depth + 1, out );
	}
	return out;
}

export async function allNotes( requestUtils: any, postId: number ) {
	const out: any[] = [];
	for ( const status of [ 'hold', 'approve', 'trash' ] ) {
		try {
			const notes = await requestUtils.rest( {
				path: '/wp/v2/comments',
				params: { post: postId, type: 'note', status, per_page: 100, context: 'edit' },
			} );
			out.push( ...notes );
		} catch ( e: any ) {
			out.push( { id: 'ERR', status, content: { raw: String( e?.message ?? e ) } } );
		}
	}
	return out.map( ( n ) => ( {
		id: n.id,
		parent: n.parent,
		author: n.author,
		status: n.status,
		content: n.content?.raw ?? n.content?.rendered,
		meta: n.meta,
	} ) );
}

export async function summaries( page: Page ) {
	const toggle = page.getByRole( 'region', { name: 'Editor top bar' } ).getByRole( 'button', { name: 'All notes', exact: true } );
	if ( ! ( await toggle.count() ) ) {
		return [ '(no All notes toggle in top bar)' ];
	}
	const sidebar = await openNotesSidebar( page );
	await page.waitForTimeout( 600 );
	return sidebar.locator( '.editor-collab-sidebar-panel__suggestion-summary' ).allInnerTexts();
}

export async function dump( tag: string, ctx: { page: Page; editor: any; requestUtils: any; postId: number }, opts: { sidebar?: boolean } = {} ) {
	const { page, editor, requestUtils, postId } = ctx;
	console.log( `\n===== ${ tag } =====` );
	console.log( 'BLOCKS\n' + flat( await getBlocks( page ) ).join( '\n' ) );
	console.log( 'MARKERS', JSON.stringify( await getMarkers( editor ) ) );
	const notes = await allNotes( requestUtils, postId );
	console.log( 'NOTES', notes.length );
	for ( const n of notes ) {
		console.log( '  NOTE', JSON.stringify( n ).slice( 0, 1500 ) );
	}
	if ( opts.sidebar !== false ) {
		console.log( 'SUMMARIES', JSON.stringify( await summaries( page ) ) );
	}
	const classes = await editor.canvas.locator( 'body' ).evaluate( ( body: HTMLElement ) =>
		Array.from( body.querySelectorAll( '[class*="is-suggestion"]' ) ).map( ( el ) => ( {
			tag: el.tagName.toLowerCase(),
			cls: Array.from( el.classList ).filter( ( c ) => c.includes( 'suggestion' ) ).join( ' ' ),
			type: el.getAttribute( 'data-type' ),
			text: ( el.textContent || '' ).slice( 0, 80 ),
		} ) )
	);
	console.log( 'SUGGESTION-CLASSES', JSON.stringify( classes ) );
	return notes;
}

/** Resolves with the response, or null when no suggestion write happens in time. */
export function maybeSaved( page: Page, ms = 6000 ) {
	return page
		.waitForResponse(
			( r ) =>
				/\/wp\/v2\/comments(\?|$|\/)/.test( r.url() ) &&
				[ 'POST', 'PUT', 'DELETE' ].includes( r.request().method() ),
			{ timeout: ms }
		)
		.then( async ( r ) => `${ r.request().method() } ${ r.status() } ${ r.url().replace( /^.*wp\/v2/, '' ).slice( 0, 80 ) }` )
		.catch( () => null );
}

export function logWrites( page: Page ) {
	page.on( 'response', async ( r ) => {
		const m = r.request().method();
		if ( m !== 'GET' && m !== 'OPTIONS' && /wp\/v2\/(comments|posts|media)/.test( r.url() ) ) {
			console.log( 'WRITE', m, r.status(), r.url().replace( /^.*wp\/v2/, '' ).slice( 0, 90 ), r.status() >= 400 ? ( await r.text().catch( () => '' ) ).slice( 0, 300 ) : '' );
		}
	} );
}

export function para( editor: any, n: number ) {
	return editor.canvas.getByRole( 'document', { name: 'Block: Paragraph' } ).nth( n );
}

export async function settle( page: Page, ms = 1500 ) {
	await page.waitForTimeout( ms );
}
