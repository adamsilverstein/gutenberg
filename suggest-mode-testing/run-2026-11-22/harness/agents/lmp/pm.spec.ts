import { test } from '@wordpress/e2e-test-utils-playwright';
import type { BrowserContext } from '@playwright/test';
import { seedPost, openPost, switchIntent, shot, USERS, loginAs, collectConsole } from '../../helpers';
import { log, takeOver, openAs, markersIn, blocksOf, selectIn, focusBlock, withSave, savePost, snackbars, notesFull, sidebarCards, decide, dismissGuide, canvasOf } from './lib';

const BASE = 'http://localhost:8947';

async function nonceOf( context: BrowserContext ) {
	const r = await context.request.get( `${ BASE }/wp-admin/admin-ajax.php?action=rest-nonce` );
	return ( await r.text() ).trim();
}

async function rest( context: BrowserContext, nonce: string | null, method: string, route: string, data?: any ) {
	const [ path, query ] = route.split( '?' );
	const url = `${ BASE }/index.php?rest_route=${ path }${ query ? '&' + query : '' }`;
	const r = await context.request.fetch( url, {
		method,
		headers: { ...( nonce ? { 'X-WP-Nonce': nonce } : {} ), 'Content-Type': 'application/json' },
		data: data ? JSON.stringify( data ) : undefined,
	} );
	let body: any = null;
	try {
		body = await r.json();
	} catch ( e ) {}
	const brief = Array.isArray( body )
		? `array(${ body.length })${ body.length ? ' ids=' + body.map( ( x: any ) => x.id ).join( ',' ) + ' metaLeak=' + JSON.stringify( body[ 0 ].meta ?? null ).slice( 0, 80 ) + ' content=' + JSON.stringify( body[ 0 ].content ?? null ).slice( 0, 80 ) : '' }`
		: body?.code ?? ( body?.id ? `ok id=${ body.id } status=${ body.status } sstatus=${ body.meta?._wp_suggestion_status } hasPayload=${ !! body.meta?._wp_suggestion }` : JSON.stringify( body ).slice( 0, 120 ) );
	return `${ r.status() } ${ brief }`;
}

const payload = JSON.stringify( { schemaVersion: 2, blockName: 'core/paragraph', baseRevision: null, operations: [ { type: 'inline-suggestion', attribute: 'content', suggestionType: 'add' } ] } );

async function battery( who: string, context: BrowserContext, nonce: string | null, postId: number, noteId: number, label: string ) {
	const out: Record< string, string > = {};
	out[ 'GET post edit' ] = await rest( context, nonce, 'GET', `/wp/v2/posts/${ postId }?context=edit` );
	out[ 'GET post view' ] = await rest( context, nonce, 'GET', `/wp/v2/posts/${ postId }` );
	out[ 'LIST notes hold' ] = await rest( context, nonce, 'GET', `/wp/v2/comments?post=${ postId }&type=note&status=hold` );
	out[ 'LIST notes all' ] = await rest( context, nonce, 'GET', `/wp/v2/comments?post=${ postId }&type=note&status=all` );
	out[ 'LIST notes default' ] = await rest( context, nonce, 'GET', `/wp/v2/comments?post=${ postId }&type=note` );
	out[ 'LIST notes edit ctx' ] = await rest( context, nonce, 'GET', `/wp/v2/comments?post=${ postId }&type=note&status=all&context=edit` );
	out[ 'GET note' ] = await rest( context, nonce, 'GET', `/wp/v2/comments/${ noteId }` );
	out[ 'GET note edit' ] = await rest( context, nonce, 'GET', `/wp/v2/comments/${ noteId }?context=edit` );
	out[ 'PUT note sstatus applied-unsaved' ] = await rest( context, nonce, 'PUT', `/wp/v2/comments/${ noteId }`, { meta: { _wp_suggestion_status: 'applied-unsaved' } } );
	out[ 'PUT note sstatus applied' ] = await rest( context, nonce, 'PUT', `/wp/v2/comments/${ noteId }`, { meta: { _wp_suggestion_status: 'applied' } } );
	out[ 'PUT note status approved' ] = await rest( context, nonce, 'PUT', `/wp/v2/comments/${ noteId }`, { status: 'approved' } );
	out[ 'PUT note payload' ] = await rest( context, nonce, 'PUT', `/wp/v2/comments/${ noteId }`, { meta: { _wp_suggestion: payload } } );
	out[ 'PUT post content' ] = await rest( context, nonce, 'PUT', `/wp/v2/posts/${ postId }`, { content: '<!-- wp:paragraph --><p>HACKED</p><!-- /wp:paragraph -->' } );
	out[ 'POST suggestion note' ] = await rest( context, nonce, 'POST', `/wp/v2/comments`, { post: postId, type: 'note', status: 'hold', content: '', parent: 0, meta: { _wp_suggestion: payload } } );
	out[ 'POST plain note' ] = await rest( context, nonce, 'POST', `/wp/v2/comments`, { post: postId, type: 'note', status: 'hold', content: 'plain note by ' + who, parent: 0 } );
	out[ 'POST reply' ] = await rest( context, nonce, 'POST', `/wp/v2/comments`, { post: postId, type: 'note', status: 'hold', content: 'reply by ' + who, parent: noteId } );
	out[ 'DELETE note' ] = await rest( context, nonce, 'DELETE', `/wp/v2/comments/${ noteId }` );
	for ( const [ k, v ] of Object.entries( out ) ) {
		log( `REST ${ label } ${ who } | ${ k }`, v );
	}
}

async function makeAdminPost( { admin, editor, page, requestUtils }: any, title: string, status: string ) {
	const postId = await seedPost( requestUtils, { title, status } );
	await openPost( admin, editor, postId );
	await switchIntent( page, 'Suggesting' );
	await focusBlock( page, 1 );
	await selectIn( page, 1, 'brown', 'start' );
	const s1 = await withSave( page, () => page.keyboard.type( 'ADMINADD ', { delay: 20 } ) );
	await focusBlock( page, 3 );
	await selectIn( page, 3, 'plain ' );
	const s2 = await withSave( page, () => page.keyboard.press( 'Backspace' ) );
	log( `${ title } saves`, [ s1?.status, s2?.status ] );
	log( `${ title } post save`, await savePost( page ) );
	const notes = await notesFull( requestUtils, postId );
	log( `${ title } notes`, notes.map( ( n: any ) => [ n.id, n.ops, n.status ] ) );
	return { postId, addId: notes[ 0 ].id as number, delId: notes[ 1 ].id as number };
}

test( 'PM REST battery', async ( { admin, editor, page, requestUtils, browser } ) => {
	const draft = await makeAdminPost( { admin, editor, page, requestUtils }, 'lmp PM draft', 'draft' );
	const pub = await makeAdminPost( { admin, editor, page, requestUtils }, 'lmp PM published', 'publish' );
	await page.goto( '/wp-admin/' );
	log( 'IDS', { draft, pub } );

	const anon = await browser.newContext( { storageState: { cookies: [], origins: [] } } );
	await battery( 'logged-out', anon, null, draft.postId, draft.delId, 'DRAFT' );
	await battery( 'logged-out', anon, null, pub.postId, pub.delId, 'PUBLISHED' );
	const front = await anon.request.get( `${ BASE }/?p=${ pub.postId }` );
	const html = await front.text();
	log( 'FRONT published', { status: front.status(), ADMINADD: /ADMINADD/.test( html ), plain: /Third paragraph: plain text/.test( html ), mark: /wp-suggestion|data-suggestion/.test( html ) } );
	await anon.close();

	for ( const [ who, user ] of [ [ 'contributor', USERS.contributor ], [ 'author', USERS.author ] ] as const ) {
		const { context, page: p } = await loginAs( browser, user );
		const nonce = await nonceOf( context );
		// UI: can they open admin's draft / published post?
		for ( const [ label, id ] of [ [ 'draft', draft.postId ], [ 'published', pub.postId ] ] as const ) {
			const res = await p.goto( `/wp-admin/post.php?post=${ id }&action=edit` );
			await p.waitForTimeout( 1500 );
			log( `UI ${ who } opens admin ${ label }`, { status: res?.status(), hasEditor: await p.locator( 'iframe[name="editor-canvas"]' ).count(), text: ( await p.locator( 'body' ).innerText() ).replace( /\s+/g, ' ' ).slice( 0, 160 ) } );
			if ( label === 'draft' ) {
				await shot( p, `PM-01-${ who }-on-admin-post` );
			}
		}
		await battery( who, context, nonce, draft.postId, draft.delId, 'DRAFT' );
		await battery( who, context, nonce, pub.postId, pub.delId, 'PUBLISHED' );
		await context.close();
	}
	// state after the attacks
	for ( const x of [ draft, pub ] ) {
		const notes = await notesFull( requestUtils, x.postId );
		log( 'AFTER ATTACKS notes', notes.map( ( n: any ) => [ n.id, n.author, n.status, n.ops, n.sstatus, n.parent, n.content ] ) );
		const server = await requestUtils.rest( { path: `/wp/v2/posts/${ x.postId }`, params: { context: 'edit' } } );
		log( 'AFTER ATTACKS content', { hacked: /HACKED/.test( server.content.raw ), marks: ( server.content.raw.match( /<mark /g ) || [] ).length } );
	}

	// PM-02 editor: UI controls + REST accept
	const ed = await openAs( browser, USERS.editor, draft.postId );
	log( 'PM-02 editor lock', ed.lock );
	log( 'PM-02 editor cards', await sidebarCards( ed.page ) );
	await shot( ed.page, 'PM-02-editor-review-controls' );
	const reqs: string[] = [];
	ed.page.on( 'request', ( r ) => { if ( /comments\/\d+/.test( r.url() ) && r.method() !== 'GET' ) reqs.push( `${ r.method() } ${ r.url().replace( /.*wp\/v2/, '' ).slice( 0, 60 ) } ${ ( r.postData() || '' ).slice( 0, 300 ) } hdr=${ r.headers()[ 'x-http-method-override' ] || '' }` ); } );
	log( 'PM-02 editor UI accept add', await decide( ed.page, draft.addId, 'accept' ) );
	log( 'PM-02 UI accept request', reqs );
	log( 'PM-02 editor snack', await snackbars( ed.page ) );
	log( 'PM-02 editor save', await savePost( ed.page ) );
	const edNonce = await nonceOf( ed.context );
	log( 'PM-02 editor REST accept del', await rest( ed.context, edNonce, 'PUT', `/wp/v2/comments/${ draft.delId }`, { meta: { _wp_suggestion_status: 'applied-unsaved' } } ) );
	log( 'PM-02 notes', ( await notesFull( requestUtils, draft.postId ) ).map( ( n: any ) => [ n.id, n.author, n.status, n.ops, n.sstatus ] ) );
	await ed.context.close();
} );

test( 'PM-01 contributor own draft', async ( { admin, editor, page, requestUtils, browser } ) => {
	const { context, page: p } = await loginAs( browser, USERS.contributor );
	const errs = collectConsole( p );
	const nonce = await nonceOf( context );
	const created = await context.request.fetch( `${ BASE }/index.php?rest_route=/wp/v2/posts`, { method: 'POST', headers: { 'X-WP-Nonce': nonce, 'Content-Type': 'application/json' }, data: JSON.stringify( { title: 'lmp PM-01 contributor draft', status: 'draft', content: '<!-- wp:paragraph -->\n<p>Contributor draft paragraph one for testing.</p>\n<!-- /wp:paragraph -->\n\n<!-- wp:paragraph -->\n<p>Contributor second paragraph stays here.</p>\n<!-- /wp:paragraph -->' } ) } );
	const post = await created.json();
	log( 'contributor created', { status: created.status(), id: post.id, author: post.author } );
	await p.goto( `/wp-admin/post.php?post=${ post.id }&action=edit` );
	await canvasOf( p ).locator( '.is-root-container' ).first().waitFor();
	await dismissGuide( p );
	await switchIntent( p, 'Suggesting' );
	await focusBlock( p, 0 );
	await selectIn( p, 0, 'paragraph', 'start' );
	log( 'contributor suggest add', await withSave( p, () => p.keyboard.type( 'CONTRIB ', { delay: 20 } ) ) );
	log( 'contributor markers', await markersIn( p ) );
	log( 'contributor cards', await sidebarCards( p ) );
	log( 'contributor top bar', await p.locator( '.editor-header button' ).evaluateAll( ( els ) => els.map( ( e ) => e.getAttribute( 'aria-label' ) || e.textContent ) ) );
	await shot( p, 'PM-01-contributor-own-draft-suggesting' );
	log( 'contributor save', await savePost( p ) );
	await p.goto( '/wp-admin/' );
	// admin suggests on the contributor's draft
	await openPost( admin, editor, post.id );
	log( 'admin lock', await takeOver( page ) );
	await switchIntent( page, 'Suggesting' );
	await focusBlock( page, 1 );
	await selectIn( page, 1, 'second ' );
	log( 'admin del on contributor draft', ( await withSave( page, () => page.keyboard.press( 'Backspace' ) ) )?.status );
	log( 'admin save', await savePost( page ) );
	await page.goto( '/wp-admin/' );
	// contributor reviews admin's suggestion on own draft
	await p.goto( `/wp-admin/post.php?post=${ post.id }&action=edit` );
	await canvasOf( p ).locator( '.is-root-container' ).first().waitFor();
	log( 'contributor lock', await takeOver( p ) );
	const cards = await sidebarCards( p );
	log( 'contributor sees', cards );
	const adminCard = cards.find( ( c: any ) => /Delete:/.test( c.text ) );
	if ( adminCard?.buttons.includes( 'Accept suggestion' ) ) {
		log( 'contributor accepts admin suggestion', await decide( p, adminCard.id, 'accept' ) );
		log( 'contributor snack', await snackbars( p ) );
		log( 'contributor blocks', await blocksOf( p ) );
		log( 'contributor save', await savePost( p ) );
	}
	await shot( p, 'PM-02-contributor-own-draft-review' );
	log( 'notes', ( await notesFull( requestUtils, post.id ) ).map( ( n: any ) => [ n.id, n.author, n.status, n.ops, n.sstatus ] ) );
	log( 'contributor console', errs );
	await context.close();
} );

test( 'PM-06 PM-07 retired checks', async ( { admin, editor, page, requestUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'lmp PM-06' } );
	await openPost( admin, editor, postId );
	await page.getByRole( 'region', { name: 'Editor top bar' } ).getByRole( 'button', { name: 'Options' } ).click();
	log( 'PM-06 intents', await page.getByRole( 'menuitemradio' ).allInnerTexts() );
	await shot( page, 'PM-06-no-viewing-intent' );
	await page.keyboard.press( 'Escape' );
	log( 'PM-06 shortcuts', await page.evaluate( () => {
		const s = ( window as any ).wp.data.select( 'core/keyboard-shortcuts' );
		const all = [ 'main', 'global', 'block', 'selection', 'text', 'list-view' ].flatMap( ( c ) => s.getCategoryShortcuts( c ) );
		return all.filter( ( n: string ) => /intent|suggest|view/i.test( n ) );
	} ) );
	log( 'PM-07 experiment flags', await page.evaluate( () => ( { globals: Object.keys( window ).filter( ( k ) => /experiment/i.test( k ) ), flags: ( window as any ).__experimentalSuggestionMode ?? null } ) ) );
} );
