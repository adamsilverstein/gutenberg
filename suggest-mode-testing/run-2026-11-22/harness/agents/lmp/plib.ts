import type { Page } from '@playwright/test';
import { seedPost, openPost, switchIntent } from '../../helpers';
import { log, takeOver, markersIn, blocksOf, selectIn, focusBlock, withSave, snackbars, notesFull, sidebarCards } from './lib';

export const P_CONTENT = `<!-- wp:paragraph -->
<p>The quick brown fox jumps over the lazy dog near the riverbank.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>Second paragraph stays plain for reference.</p>
<!-- /wp:paragraph -->`;

export async function newPost( requestUtils: any, title: string, status = 'draft' ) {
	return seedPost( requestUtils, { title: `lmp ${ title }`, content: P_CONTENT, status } );
}

export async function adminOpen( { admin, editor, page }: any, postId: number, suggesting = true ) {
	await openPost( admin, editor, postId );
	await takeOver( page );
	if ( suggesting ) {
		await switchIntent( page, 'Suggesting' );
	}
	await focusBlock( page, 0 );
}

/** One gesture in block 0: select needle (or caret), run keys, wait for note write, report. */
export async function gesture( page: Page, label: string, needle: string, collapse: 'start' | 'end' | undefined, action: () => Promise< void >, block = 0 ) {
	await selectIn( page, block, needle, collapse );
	const save = await withSave( page, action, 7000 );
	log( `${ label } | note write`, save ? `${ save.method } ${ save.status }` : 'none within 7s' );
	return save;
}

export const compact = ( markers: any[] ) => markers.map( ( m ) => `${ m.type }#${ m.id }@${ m.author }${ m.parent ? '<in#' + m.parent + '>' : '' }"${ m.text }"` ).join( ' | ' );

export async function report( page: Page, requestUtils: any, postId: number, label: string, block = 0 ) {
	log( `${ label } | markers`, compact( await markersIn( page ) ) );
	log( `${ label } | html`, ( await blocksOf( page ) )[ block ]?.content );
	log( `${ label } | snack`, await snackbars( page ) );
	log( `${ label } | notes`, ( await notesFull( requestUtils, postId ) ).map( ( n: any ) => `${ n.id }@${ n.author } ${ n.status } ${ n.ops } ${ n.sstatus ?? '' }` ) );
}

export async function cards( page: Page, label: string ) {
	const c = await sidebarCards( page );
	log( `${ label } | cards`, c.map( ( x: any ) => `#${ x.id }: ${ x.text.replace( /^Add new reply /, '' ).replace( / Back to block$/, '' ) } [${ x.buttons.filter( ( b: string ) => /Accept|Reject/.test( b ) ).map( ( b: string ) => b[ 0 ] ).join( '' ) }]` ) );
	return c;
}

export async function spoken( page: Page ) {
	return page.locator( '#a11y-speak-polite, #a11y-speak-assertive' ).allInnerTexts();
}

import { loginAs } from '../../helpers';
import { canvasOf, dismissGuide } from './lib';

/** A persistent second-user session. */
export async function session( browser: any, user: any ) {
	const { context, page } = await loginAs( browser, user );
	const open = async ( postId: number, suggesting = true ) => {
		await page.goto( `/wp-admin/post.php?post=${ postId }&action=edit` );
		await canvasOf( page ).locator( '.is-root-container' ).first().waitFor();
		await dismissGuide( page );
		await takeOver( page );
		if ( suggesting ) {
			await switchIntent( page, 'Suggesting' );
		}
		await focusBlock( page, 0 );
	};
	const leave = () => page.goto( '/wp-admin/' );
	return { context, page, open, leave };
}
