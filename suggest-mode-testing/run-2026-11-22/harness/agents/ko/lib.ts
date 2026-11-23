import type { Page } from '@playwright/test';
import {
	getMarkers,
	getBlocks,
	getNotes,
	openNotesSidebar,
	switchIntent,
	suggestionSaved,
	shot,
} from '../../helpers';

export const P = ( editor: any, text: string ) =>
	editor.canvas
		.locator( '[data-type="core/paragraph"]' )
		.filter( { hasText: text } )
		.first();

export async function flat( page: Page ) {
	const blocks = await getBlocks( page );
	return blocks.map( ( b: any, i: number ) => {
		const s = b.metadata?.suggestion;
		return `${ i }:${ b.name.replace( 'core/', '' ) }${
			b.attributes.level ? '(h' + b.attributes.level + ')' : ''
		}${ s ? '[' + ( s.type || JSON.stringify( s ) ) + ']' : '' }${
			b.metadata?.noteId ? '{note ' + JSON.stringify( b.metadata.noteId ) + '}' : ''
		} ${ b.content !== undefined ? JSON.stringify( b.content.slice( 0, 160 ) ) : '' }`;
	} );
}

export async function threads( page: Page ) {
	const sidebar = await openNotesSidebar( page );
	await page.waitForTimeout( 400 );
	const t = await sidebar
		.locator( '.editor-collab-sidebar-panel__thread' )
		.allInnerTexts();
	return t.map( ( x ) => x.replace( /\s+/g, ' ' ).trim() );
}

export async function snackbars( page: Page ) {
	return page.locator( '.components-snackbar-list .components-snackbar' ).allInnerTexts();
}

export async function snap(
	label: string,
	{ page, editor, requestUtils }: any,
	postId: number
) {
	const markers = await getMarkers( editor );
	const ghosts = await editor.canvas.locator( '.is-suggestion-move-ghost' ).count();
	const notes = await getNotes( requestUtils, postId );
	const out = {
		markers: markers.map( ( m: any ) => `${ m.tag }.${ m.className }#${ m.id }/${ m.type } ${ JSON.stringify( m.text ) }` ),
		blocks: await flat( page ),
		ghosts,
		notes: notes.map(
			( n: any ) =>
				`#${ n.id } ${ n.status } status=${ n.meta?._wp_suggestion_status ?? '' } ${ String( n.content ).slice( 0, 60 ) } ${ String( n.meta?._wp_suggestion ?? '' ).slice( 0, 140 ) }`
		),
		threads: await threads( page ),
		snack: await snackbars( page ),
		dirty: await page.evaluate( () => ( window as any ).wp.data.select( 'core/editor' ).isEditedPostDirty() ),
	};
	console.log( `\n=== ${ label } ===\n` + JSON.stringify( out, null, 1 ) );
	return out;
}

export async function decide( page: Page, action: 'Accept' | 'Reject', filterText?: string ) {
	const sidebar = await openNotesSidebar( page );
	let scope: any = sidebar;
	if ( filterText ) {
		scope = sidebar.locator( '.editor-collab-sidebar-panel__thread' ).filter( { hasText: filterText } );
	}
	await scope.getByRole( 'button', { name: `${ action } suggestion` } ).first().click();
	const text = action === 'Accept' ? 'Suggestion applied.' : 'Suggestion rejected.';
	let seen = true;
	try {
		await page.locator( '.components-snackbar-list' ).getByText( text ).first().waitFor( { timeout: 8000 } );
	} catch ( e ) {
		seen = false;
	}
	console.log( `DECIDE ${ action } snackbar "${ text }" seen=${ seen }` );
	return seen;
}

/** Save with the keyboard shortcut and wait for the post PUT/POST. */
export async function savePost( page: Page, postId: number ) {
	const resp = page.waitForResponse(
		( r ) =>
			new RegExp( `/wp/v2/posts/${ postId }(\\?|$)` ).test( decodeURIComponent( r.url() ) ) &&
			[ 'POST', 'PUT' ].includes( r.request().method() ),
		{ timeout: 30000 }
	);
	await page.keyboard.press( 'ControlOrMeta+s' );
	const r = await resp;
	console.log( 'SAVE', r.status() );
	await page.waitForFunction( () => ! ( window as any ).wp.data.select( 'core/editor' ).isSavingPost() );
	await page.waitForTimeout( 1500 );
	return r.status();
}

export async function reload( page: Page, editor: any ) {
	await page.reload();
	await editor.canvas.locator( '.is-root-container' ).first().waitFor();
	await page.waitForTimeout( 1500 );
}

export async function rawContent( requestUtils: any, postId: number ) {
	const post = await requestUtils.rest( { path: `/wp/v2/posts/${ postId }`, params: { context: 'edit' } } );
	return post.content.raw as string;
}

export async function selectWordJumps( page: Page, editor: any ) {
	await P( editor, 'quick brown fox' ).click();
	await page.keyboard.press( 'Home' );
	for ( let i = 0; i < 4; i++ ) await page.keyboard.press( 'Alt+ArrowRight' );
	await page.keyboard.press( 'ArrowRight' );
	await page.keyboard.press( 'Shift+Alt+ArrowRight' );
}

export type Kind = 'add' | 'del' | 'format' | 'insert' | 'remove' | 'move' | 'attr';

/** Makes one suggestion with real gestures; assumes Suggesting intent. */
export async function suggest( kind: Kind, { page, editor }: any ) {
	const saved = suggestionSaved( page );
	if ( kind === 'add' ) {
		await P( editor, 'quick brown fox' ).click();
		await page.keyboard.press( 'Home' );
		for ( let i = 0; i < 4; i++ ) await page.keyboard.press( 'Alt+ArrowRight' );
		await page.keyboard.type( ' KEEPME', { delay: 25 } );
	} else if ( kind === 'del' ) {
		await selectWordJumps( page, editor );
		await page.keyboard.press( 'Backspace' );
	} else if ( kind === 'format' ) {
		await selectWordJumps( page, editor );
		await page.keyboard.press( 'ControlOrMeta+b' );
	} else if ( kind === 'insert' ) {
		await P( editor, 'Fourth paragraph' ).click();
		await page.keyboard.press( 'End' );
		await page.keyboard.press( 'Enter' );
		await page.keyboard.type( 'NEW BLOCK', { delay: 25 } );
	} else if ( kind === 'remove' ) {
		await P( editor, 'Third paragraph' ).click();
		await editor.clickBlockOptionsMenuItem( 'Delete' );
	} else if ( kind === 'move' ) {
		await P( editor, 'quick brown fox' ).click();
		await editor.clickBlockToolbarButton( 'Move down' );
	} else if ( kind === 'attr' ) {
		await editor.canvas.locator( '[data-type="core/heading"]' ).first().click();
		await page
			.getByRole( 'toolbar', { name: 'Block tools' } )
			.getByRole( 'button', { name: /^Heading 2$/ } )
			.click();
		await page.getByRole( 'menuitem', { name: /^Heading 4/ } ).click();
	}
	await saved;
	await page.waitForTimeout( 600 );
}

export { switchIntent, shot };
