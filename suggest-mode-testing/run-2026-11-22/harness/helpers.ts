/**
 * Shared helpers for the Suggestion mode test run. Import from '../../helpers'.
 */
import path from 'path';
import type { Browser, BrowserContext, Page } from '@playwright/test';

export const SCREENSHOT_DIR =
	process.env.RUN_SCREENSHOT_DIR ||
	'/Users/adamsilverstein/repositories/worktrees/suggest-testing-docs-1122/suggest-mode-testing/run-2026-11-22/screenshots';

export const USERS = {
	admin: { username: 'admin', password: 'password', id: 1 },
	editor: { username: 'editor-user', password: 'password', id: 2 },
	contributor: { username: 'contributor-user', password: 'password', id: 3 },
	author: { username: 'author-user', password: 'password', id: 4 },
};

/** Seed content: four paragraphs, a heading, a list and an image. */
export const SEED_CONTENT = `<!-- wp:heading -->
<h2 class="wp-block-heading">Field notes from the river</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>The quick brown fox jumps over the lazy dog near the riverbank.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>A second paragraph with <strong>bold words</strong> and a <a href="https://example.org">link</a> in it.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>Third paragraph: plain text used for deletions and replacements.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>Fourth paragraph closes the opening section of the post.</p>
<!-- /wp:paragraph -->

<!-- wp:list -->
<ul class="wp-block-list"><!-- wp:list-item -->
<li>First item</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li>Second item</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li>Third item</li>
<!-- /wp:list-item --></ul>
<!-- /wp:list -->

<!-- wp:image -->
<figure class="wp-block-image"><img src="https://s.w.org/images/core/5.3/MtBlanc1.jpg" alt="Mountain"/></figure>
<!-- /wp:image -->`;

/** Creates a post over REST as the signed-in admin and returns its id. */
export async function seedPost(
	requestUtils: any,
	{ title = 'Suggestion mode seed', content = SEED_CONTENT, status = 'draft' } = {}
): Promise< number > {
	const post = await requestUtils.rest( {
		method: 'POST',
		path: '/wp/v2/posts',
		data: { title, content, status },
	} );
	return post.id;
}

/** Opens a post in the editor and waits for the canvas. */
export async function openPost( admin: any, editor: any, postId: number ) {
	await admin.editPost( postId );
	await editor.canvas.locator( '.wp-block-post-content, .is-root-container' ).first().waitFor();
}

export async function switchIntent( page: Page, intentLabel: 'Editing' | 'Suggesting' | string ) {
	await page
		.getByRole( 'region', { name: 'Editor top bar' } )
		.getByRole( 'button', { name: 'Options' } )
		.click();
	const menuItem = page.getByRole( 'menuitemradio', {
		name: new RegExp( `^${ intentLabel }` ),
	} );
	await menuItem.waitFor( { state: 'visible', timeout: 10000 } );
	await menuItem.click();
	await page.keyboard.press( 'Escape' );
}

/** Call BEFORE the edit that triggers the debounced suggestion auto-save. */
export function suggestionSaved( page: Page ) {
	return page.waitForResponse(
		( response ) =>
			/\/wp\/v2\/comments(\?|$|\/)/.test( response.url() ) &&
			[ 'POST', 'PUT' ].includes( response.request().method() ) &&
			response.ok(),
		{ timeout: 20000 }
	);
}

export async function openNotesSidebar( page: Page ) {
	const toggle = page
		.getByRole( 'region', { name: 'Editor top bar' } )
		.getByRole( 'button', { name: 'All notes', exact: true } );
	if ( ( await toggle.getAttribute( 'aria-expanded' ) ) === 'false' ) {
		await toggle.click();
	}
	return page.getByRole( 'region', { name: 'Editor settings' } );
}

/** Inline suggestion markers currently rendered in the canvas. */
export async function getMarkers( editor: any ) {
	return editor.canvas.locator( 'body' ).evaluate( ( body: HTMLElement ) =>
		Array.from(
			body.querySelectorAll( '[data-suggestion-id], mark[class*="wp-suggestion"], ins, del' )
		).map( ( el ) => ( {
			tag: el.tagName.toLowerCase(),
			id: el.getAttribute( 'data-suggestion-id' ),
			type: el.getAttribute( 'data-suggestion-type' ),
			author: el.getAttribute( 'data-author' ),
			className: el.className,
			text: el.textContent,
		} ) )
	);
}

/** Block tree snapshot from the block-editor store. */
export async function getBlocks( page: Page ) {
	return page.evaluate( () => {
		const strip = ( blocks: any[] ): any[] =>
			blocks.map( ( b ) => ( {
				name: b.name,
				content:
					b.attributes.content !== undefined
						? String( b.attributes.content )
						: undefined,
				metadata: b.attributes.metadata,
				attributes: Object.fromEntries(
					Object.entries( b.attributes ).filter(
						( [ k ] ) => ! [ 'content', 'metadata' ].includes( k )
					)
				),
				innerBlocks: strip( b.innerBlocks ),
			} ) );
		return strip( ( window as any ).wp.data.select( 'core/block-editor' ).getBlocks() );
	} );
}

/** Notes (suggestions included) for a post, straight from REST, any status. */
export async function getNotes( requestUtils: any, postId: number ) {
	const out: any[] = [];
	for ( const status of [ 'hold', 'approve' ] ) {
		const notes = await requestUtils.rest( {
			path: '/wp/v2/comments',
			params: { post: postId, type: 'note', status, per_page: 100, context: 'edit' },
		} );
		out.push( ...notes );
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

/** Text of each note card in the sidebar, as a reviewer reads it. */
export async function getSidebarNoteTexts( page: Page ) {
	const sidebar = await openNotesSidebar( page );
	return sidebar.locator( '[role="treeitem"], [role="listitem"], .editor-collab-sidebar-panel__thread' ).allInnerTexts();
}

export async function shot( page: Page, name: string, options: Record< string, unknown > = {} ) {
	const file = path.join( SCREENSHOT_DIR, name.endsWith( '.png' ) ? name : `${ name }.png` );
	await page.screenshot( { path: file, ...options } );
	return file;
}

/** A separate signed-in browser context for another user. Close it when done. */
export async function loginAs(
	browser: Browser,
	user: { username: string; password: string }
): Promise< { context: BrowserContext; page: Page } > {
	const context = await browser.newContext( {
		baseURL: process.env.WP_BASE_URL,
		storageState: { cookies: [], origins: [] },
		viewport: { width: 1440, height: 900 },
	} );
	const page = await context.newPage();
	await page.goto( '/wp-login.php' );
	await page.locator( '#user_login' ).fill( user.username );
	await page.locator( '#user_pass' ).fill( user.password );
	await page.locator( '#wp-submit' ).click();
	await page.waitForURL( /wp-admin/ );
	return { context, page };
}

/** Collects console errors and page errors for crash reporting. */
export function collectConsole( page: Page ) {
	const errors: string[] = [];
	page.on( 'console', ( msg ) => {
		if ( msg.type() === 'error' ) {
			errors.push( msg.text() );
		}
	} );
	page.on( 'pageerror', ( error ) => errors.push( `pageerror: ${ error.message }` ) );
	return errors;
}
