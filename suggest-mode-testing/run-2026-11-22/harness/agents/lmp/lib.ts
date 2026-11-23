import type { Browser, Page } from '@playwright/test';
import { loginAs, suggestionSaved } from '../../helpers';

export const log = ( label: string, value: unknown ) =>
	console.log( `>>> ${ label } ${ typeof value === 'string' ? value : JSON.stringify( value ) }` );

export const canvasOf = ( page: Page ) => page.frameLocator( 'iframe[name="editor-canvas"]' );

/** Open a post in a separate context as another user. */
export async function openAs( browser: Browser, user: any, postId: number ) {
	const { context, page } = await loginAs( browser, user );
	const res = await page.goto( `/wp-admin/post.php?post=${ postId }&action=edit` );
	const status = res?.status();
	const hasEditor = await page
		.locator( 'iframe[name="editor-canvas"]' )
		.first()
		.waitFor( { timeout: 15000 } )
		.then( () => true )
		.catch( () => false );
	if ( hasEditor ) {
		await canvasOf( page ).locator( '.is-root-container' ).first().waitFor();
		await dismissGuide( page );
	}
	const lock = hasEditor ? await takeOver( page ) : null;
	return { context, page, canvas: canvasOf( page ), status, hasEditor, lock };
}

/** Clicks "Take over" on the post-lock dialog if it shows; returns the dialog text or null. */
export async function takeOver( page: Page ) {
	const btn = page.getByText( 'Take over', { exact: true } );
	const visible = await btn.waitFor( { state: 'visible', timeout: 2500 } ).then( () => true ).catch( () => false );
	if ( ! visible ) {
		return null;
	}
	const text = ( await page.locator( '.components-modal__frame' ).last().innerText() ).replace( /\s+/g, ' ' );
	await btn.click();
	await page.waitForTimeout( 500 );
	return text;
}

export async function dismissGuide( page: Page ) {
	const close = page.getByRole( 'dialog' ).getByRole( 'button', { name: 'Close' } );
	if ( await close.isVisible().catch( () => false ) ) {
		await close.click();
	}
}

export async function markersIn( page: Page ) {
	return canvasOf( page )
		.locator( 'body' )
		.evaluate( ( body: HTMLElement ) =>
			Array.from( body.querySelectorAll( 'mark[data-suggestion-id]' ) ).map( ( el ) => {
				const cs = getComputedStyle( el );
				return {
					id: el.getAttribute( 'data-suggestion-id' ),
					type: el.getAttribute( 'data-suggestion-type' ),
					author: el.getAttribute( 'data-author' ),
					text: el.textContent,
					parent: el.parentElement?.closest( 'mark[data-suggestion-id]' )?.getAttribute( 'data-suggestion-id' ) ?? null,
					color: cs.textDecorationColor,
					bg: cs.backgroundColor,
				};
			} )
		);
}

/** Compact blocks: name, content, metadata. */
export async function blocksOf( page: Page ) {
	return page.evaluate( () => {
		const strip = ( blocks: any[] ): any[] =>
			blocks.map( ( b ) => ( {
				name: b.name.replace( 'core/', '' ),
				content: b.attributes.content !== undefined ? String( b.attributes.content ) : undefined,
				metadata: b.attributes.metadata,
				...( b.innerBlocks.length ? { inner: strip( b.innerBlocks ) } : {} ),
			} ) );
		return strip( ( window as any ).wp.data.select( 'core/block-editor' ).getBlocks() );
	} );
}

/** Select [needle] inside block index (top-level) by plain-text offsets; collapse to start/end if asked. */
export async function selectIn( page: Page, blockIndex: number, needle: string, collapse?: 'start' | 'end', occurrence = 0 ) {
	const r = await page.evaluate(
		( [ index, n, c, occ ]: any[] ) => {
			const { select, dispatch } = ( window as any ).wp.data;
			const block = select( 'core/block-editor' ).getBlocks()[ index ];
			const div = document.createElement( 'div' );
			div.innerHTML = String( block.attributes.content );
			const text = div.textContent || '';
			let at = -1;
			for ( let i = 0; i <= occ; i++ ) {
				at = text.indexOf( n, at + 1 );
			}
			if ( at < 0 ) {
				return { error: `needle not found in: ${ text }` };
			}
			let s = at;
			let e = at + n.length;
			if ( c === 'start' ) {
				e = s;
			}
			if ( c === 'end' ) {
				s = e;
			}
			dispatch( 'core/block-editor' ).selectionChange( block.clientId, 'content', s, e );
			return { s, e, text };
		},
		[ blockIndex, needle, collapse ?? null, occurrence ]
	);
	if ( ( r as any ).error ) {
		throw new Error( ( r as any ).error );
	}
	return r;
}

export async function focusBlock( page: Page, blockIndex: number ) {
	await canvasOf( page ).locator( '.is-root-container > [data-block]' ).nth( blockIndex ).click();
}

/** Run an edit and wait for the suggestion note write; returns false if no write happened. */
export async function withSave( page: Page, fn: () => Promise< void >, timeout = 12000 ) {
	const saved = page
		.waitForResponse(
			( response ) =>
				/\/wp\/v2\/comments(\?|$|\/)/.test( response.url() ) &&
				[ 'POST', 'PUT' ].includes( response.request().method() ),
			{ timeout }
		)
		.then( async ( r ) => ( { status: r.status(), method: r.request().method(), body: ( await r.text() ).slice( 0, 200 ) } ) )
		.catch( () => null );
	await fn();
	const out = await saved;
	await page.waitForTimeout( 600 );
	return out;
}

export async function savePost( page: Page ) {
	const put = page
		.waitForResponse(
			( r ) => /\/wp\/v2\/posts\/\d+/.test( r.url() ) && [ 'POST', 'PUT' ].includes( r.request().method() ),
			{ timeout: 15000 }
		)
		.then( ( r ) => r.status() )
		.catch( () => 'no-post-save-request' );
	await page.keyboard.press( 'ControlOrMeta+s' );
	const status = await put;
	await page.waitForTimeout( 800 );
	return status;
}

export async function snackbars( page: Page ) {
	return page.locator( '.components-snackbar-list .components-snackbar' ).allInnerTexts();
}

/** REST as the page's signed-in user; returns status + body. */
export async function restAs( page: Page, options: { path: string; method?: string; data?: any } ) {
	return page.evaluate( async ( opts ) => {
		try {
			const res = await ( window as any ).wp.apiFetch( { ...opts, parse: false } );
			let body: any = null;
			try {
				body = await res.json();
			} catch ( e ) {}
			return { status: res.status, body };
		} catch ( res: any ) {
			let body: any = null;
			try {
				body = await res.json();
			} catch ( e ) {}
			return { status: res.status, code: body?.code, message: body?.message };
		}
	}, options );
}

export async function notesFull( requestUtils: any, postId: number ) {
	const out: any[] = [];
	for ( const status of [ 'hold', 'approve', 'trash' ] ) {
		const notes = await requestUtils.rest( {
			path: '/wp/v2/comments',
			params: { post: postId, type: 'note', status, per_page: 100, context: 'edit' },
		} );
		out.push( ...notes );
	}
	return out
		.sort( ( a, b ) => a.id - b.id )
		.map( ( n ) => {
			let ops: any = null;
			try {
				ops = JSON.parse( n.meta?._wp_suggestion || 'null' )?.operations?.map(
					( o: any ) => `${ o.type }${ o.suggestionType ? ':' + o.suggestionType : '' }`
				);
			} catch ( e ) {}
			return {
				id: n.id,
				parent: n.parent,
				author: n.author,
				author_name: n.author_name,
				status: n.status,
				content: n.content?.raw,
				ops,
				sstatus: n.meta?._wp_suggestion_status,
				metaKeys: Object.keys( n.meta || {} ).filter( ( k ) => k !== '_wp_suggestion' ),
			};
		} );
}

export async function sidebarCards( page: Page ) {
	const toggle = page
		.getByRole( 'region', { name: 'Editor top bar' } )
		.getByRole( 'button', { name: 'All notes', exact: true } );
	if ( ( await toggle.getAttribute( 'aria-expanded' ) ) === 'false' ) {
		await toggle.click();
	}
	const sidebar = page.getByRole( 'region', { name: 'Editor settings' } );
	await page.waitForTimeout( 800 );
	return sidebar.locator( '[id^="note-thread-"]' ).evaluateAll( ( els ) =>
		els.map( ( el ) => ( {
			id: el.id.replace( 'note-thread-', '' ),
			text: ( el as HTMLElement ).innerText.replace( /\s+/g, ' ' ).trim(),
			avatars: el.querySelectorAll( 'img' ).length,
			buttons: Array.from( el.querySelectorAll( 'button' ) ).map( ( b ) => b.getAttribute( 'aria-label' ) || b.textContent ),
		} ) )
	);
}

export async function decide( page: Page, noteId: number | string, decision: 'accept' | 'reject' ) {
	const sidebar = page.getByRole( 'region', { name: 'Editor settings' } );
	const decided = page
		.waitForResponse( ( r ) => r.url().includes( `/wp/v2/comments/${ noteId }` ) && r.request().method() !== 'GET', { timeout: 12000 } )
		.then( ( r ) => r.status() )
		.catch( () => 'no-request' );
	await sidebar
		.locator( `#note-thread-${ noteId }` )
		.getByRole( 'button', { name: decision === 'accept' ? 'Accept suggestion' : 'Reject suggestion' } )
		.click();
	const status = await decided;
	await page.waitForTimeout( 600 );
	return status;
}

export { suggestionSaved };
