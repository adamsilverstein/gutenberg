import { test } from '@wordpress/e2e-test-utils-playwright';
import { seedPost, openPost, switchIntent, getMarkers, getBlocks, getNotes, openNotesSidebar, shot, collectConsole, SCREENSHOT_DIR } from '../../helpers';
import { allKinds, summaries, treatments, para, step } from './kit';

const liveRegions = ( page: any ) =>
	page.evaluate( () =>
		Array.from( document.querySelectorAll( '[aria-live]' ) ).map( ( el ) => ( {
			id: el.id, cls: ( el.className || '' ).toString().slice( 0, 60 ), live: el.getAttribute( 'aria-live' ), role: el.getAttribute( 'role' ), text: ( el.textContent || '' ).slice( 0, 160 ),
		} ) ).filter( ( r ) => r.text )
	);

test( 'AX-01 mode switch announced', async ( { admin, editor, page, requestUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'hjn AX-01' } );
	await openPost( admin, editor, postId );
	console.log( 'LIVE before', JSON.stringify( await liveRegions( page ) ) );
	// record every mutation of live regions
	await page.evaluate( () => {
		( window as any ).__spoken = [];
		const obs = new MutationObserver( () => {
			document.querySelectorAll( '[aria-live]' ).forEach( ( el ) => {
				const t = ( el.textContent || '' ).trim();
				if ( t ) ( window as any ).__spoken.push( `${ el.getAttribute( 'aria-live' ) }#${ el.id || ( el.className || '' ).toString().slice( 0, 40 ) }: ${ t.slice( 0, 120 ) }` );
			} );
		} );
		obs.observe( document.body, { subtree: true, childList: true, characterData: true } );
	} );
	await switchIntent( page, 'Suggesting' );
	await page.waitForTimeout( 800 );
	console.log( 'SPOKEN after -> Suggesting', JSON.stringify( Array.from( new Set( await page.evaluate( () => ( window as any ).__spoken ) ) ) ) );
	console.log( 'LIVE now', JSON.stringify( await liveRegions( page ) ) );
	await shot( page, 'AX-01-suggesting-announced' );
	await page.evaluate( () => { ( window as any ).__spoken = []; } );
	await switchIntent( page, 'Editing' );
	await page.waitForTimeout( 800 );
	console.log( 'SPOKEN after -> Editing', JSON.stringify( Array.from( new Set( await page.evaluate( () => ( window as any ).__spoken ) ) ) ) );
	// menu item state
	await page.getByRole( 'region', { name: 'Editor top bar' } ).getByRole( 'button', { name: 'Options' } ).click();
	console.log( 'MENU RADIOS', JSON.stringify( await page.getByRole( 'menuitemradio' ).evaluateAll( ( els ) => els.map( ( e ) => ( e as HTMLElement ).innerText.split( '\n' )[ 0 ] + ' checked=' + e.getAttribute( 'aria-checked' ) ) ) ) );
	console.log( 'VIEWING item count', await page.getByRole( 'menuitemradio', { name: /^Viewing/ } ).count() );
	await page.keyboard.press( 'Escape' );
	// persistent (non-transient) indication of the mode?
	await switchIntent( page, 'Suggesting' );
	await page.waitForTimeout( 6000 );
	console.log( 'PERSISTENT indicator after snackbar gone', JSON.stringify( await page.evaluate( () => Array.from( document.querySelectorAll( '.editor-header *, .interface-interface-skeleton__footer *' ) ).filter( ( e ) => /suggest/i.test( ( e.getAttribute( 'aria-label' ) || '' ) + ( e.childElementCount ? '' : e.textContent ) ) ).map( ( e ) => e.tagName + ':' + ( e.getAttribute( 'aria-label' ) || e.textContent ) ).slice( 0, 6 ) ) ), 'snackbars', JSON.stringify( await page.locator( '.components-snackbar-list' ).allInnerTexts() ) );
} );

test( 'AX-02 AX-04 marker semantics and contrast', async ( { admin, editor, page, pageUtils, requestUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'hjn AX-02' } );
	await openPost( admin, editor, postId );
	await allKinds( page, editor, pageUtils );
	await page.waitForTimeout( 1500 );
	const info = await editor.canvas.locator( 'body' ).evaluate( ( body: HTMLElement ) => {
		const win = body.ownerDocument.defaultView as Window;
		const parse = ( c: string ) => {
			let m = c.match( /rgba?\(([^)]+)\)/ );
			if ( m ) { const p = m[ 1 ].split( /[,\s/]+/ ).filter( Boolean ).map( Number ); return [ p[ 0 ], p[ 1 ], p[ 2 ], p[ 3 ] === undefined ? 1 : p[ 3 ] ]; }
			m = c.match( /color\(srgb ([^)]+)\)/ );
			if ( m ) { const p = m[ 1 ].split( /[\s/]+/ ).filter( Boolean ).map( Number ); return [ p[ 0 ] * 255, p[ 1 ] * 255, p[ 2 ] * 255, p[ 3 ] === undefined ? 1 : p[ 3 ] ]; }
			return null;
		};
		const over = ( fg: number[], bg: number[] ) => [ 0, 1, 2 ].map( ( i ) => fg[ i ] * fg[ 3 ] + bg[ i ] * ( 1 - fg[ 3 ] ) ).concat( 1 );
		const lum = ( c: number[] ) => { const f = ( v: number ) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow( ( v + 0.055 ) / 1.055, 2.4 ); }; return 0.2126 * f( c[ 0 ] ) + 0.7152 * f( c[ 1 ] ) + 0.0722 * f( c[ 2 ] ); };
		const ratio = ( a: number[], b: number[] ) => { const la = lum( a ), lb = lum( b ); return +( ( Math.max( la, lb ) + 0.05 ) / ( Math.min( la, lb ) + 0.05 ) ).toFixed( 2 ); };
		const effBg = ( el: Element | null ): number[] => {
			const stack: number[][] = [];
			while ( el ) { const c = parse( win.getComputedStyle( el ).backgroundColor ); if ( c && c[ 3 ] > 0 ) { stack.push( c ); if ( c[ 3 ] === 1 ) break; } el = el.parentElement; }
			let base = [ 255, 255, 255, 1 ];
			for ( let i = stack.length - 1; i >= 0; i-- ) base = over( stack[ i ], base );
			return base;
		};
		const describe = ( el: HTMLElement ) => {
			const cs = win.getComputedStyle( el );
			const pageBg = effBg( el.parentElement );
			const ownBg = effBg( el );
			const fg = over( parse( cs.color )!, ownBg );
			const deco = parse( cs.textDecorationColor );
			const a11y = el.querySelector( '.wp-suggestion-a11y' ) as HTMLElement | null;
			return {
				cls: el.className, text: el.textContent, tag: el.tagName,
				role: el.getAttribute( 'role' ), ariaLabel: el.getAttribute( 'aria-label' ), title: el.getAttribute( 'title' ),
				a11ySpan: a11y ? { role: a11y.getAttribute( 'role' ), before: win.getComputedStyle( a11y, '::before' ).content, after: win.getComputedStyle( a11y, '::after' ).content, beforeClip: win.getComputedStyle( a11y, '::before' ).clipPath + '/' + win.getComputedStyle( a11y, '::before' ).position + '/' + win.getComputedStyle( a11y, '::before' ).width } : null,
				color: cs.color, bg: cs.backgroundColor, decoLine: cs.textDecorationLine, decoStyle: cs.textDecorationStyle, decoColor: cs.textDecorationColor, decoThickness: cs.textDecorationThickness,
				pageBg: pageBg.map( Math.round ), ownBg: ownBg.map( Math.round ),
				contrastTextOnOwnBg: ratio( fg, ownBg ),
				contrastDecoOnOwnBg: deco ? ratio( over( deco, ownBg ), ownBg ) : null,
				contrastDecoOnPageBg: deco ? ratio( over( deco, pageBg ), pageBg ) : null,
				contrastOwnBgVsPageBg: ratio( ownBg, pageBg ),
			};
		};
		const out: any = { marks: Array.from( body.querySelectorAll( 'mark[class*="wp-suggestion"]' ) ).map( ( e ) => describe( e as HTMLElement ) ) };
		out.blocks = Array.from( body.querySelectorAll( '[class*="is-suggestion-"]' ) ).map( ( e ) => {
			const el = e as HTMLElement; const cs = win.getComputedStyle( el );
			const pageBg = effBg( el.parentElement ); const ownBg = effBg( el );
			const oc = parse( cs.outlineColor ); const bc = parse( cs.borderTopColor );
			return { cls: Array.from( el.classList ).filter( ( c ) => c.includes( 'suggestion' ) ).join( ' ' ), ariaLabel: el.getAttribute( 'aria-label' ), ariaDescribedby: el.getAttribute( 'aria-describedby' ), describedText: ( el.getAttribute( 'aria-describedby' ) || '' ).split( ' ' ).map( ( id ) => body.ownerDocument.getElementById( id )?.textContent ).join( ' / ' ), ariaHidden: el.getAttribute( 'aria-hidden' ), inert: el.hasAttribute( 'inert' ), tabindex: el.getAttribute( 'tabindex' ), role: el.getAttribute( 'role' ), opacity: cs.opacity, outline: cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor, border: cs.borderTopStyle + ' ' + cs.borderTopWidth + ' ' + cs.borderTopColor, before: win.getComputedStyle( el, '::before' ).content.slice( 0, 60 ), after: win.getComputedStyle( el, '::after' ).content.slice( 0, 60 ),
				color: cs.color, textContrast: ratio( over( parse( cs.color )!, ownBg ), ownBg ), outlineContrast: oc && cs.outlineStyle !== 'none' ? ratio( over( oc, pageBg ), pageBg ) : null, borderContrast: bc && cs.borderTopStyle !== 'none' ? ratio( over( bc, pageBg ), pageBg ) : null, text: ( el.textContent || '' ).slice( 0, 50 ) };
		} );
		return out;
	} );
	console.log( 'MARKS', JSON.stringify( info.marks, null, 1 ) );
	console.log( 'BLOCK TREATMENTS', JSON.stringify( info.blocks, null, 1 ) );
	for ( const t of [ 'quick brown fox', 'Third paragraph', 'Fourth paragraph' ] ) {
		console.log( 'ARIA SNAPSHOT', t, '\n' + ( await para( editor, t ).ariaSnapshot() ) );
	}
	console.log( 'ARIA SNAPSHOT canvas\n' + ( await editor.canvas.locator( '.is-root-container' ).ariaSnapshot() ).slice( 0, 2500 ) );
	const content = await editor.getEditedPostContent();
	console.log( 'SERIALIZED leaks a11y?', JSON.stringify( { a11ySpan: content.includes( 'wp-suggestion-a11y' ), role: /role=/.test( content ) } ) );
	await page.evaluate( () => ( window as any ).wp.data.dispatch( 'core/block-editor' ).clearSelectedBlock() );
	await shot( page, 'AX-02-04-marker-semantics-contrast' );
	// dark mode
	await page.emulateMedia( { colorScheme: 'dark' } );
	await page.waitForTimeout( 500 );
	const dark = await editor.canvas.locator( 'body' ).evaluate( ( body: HTMLElement ) => { const w = body.ownerDocument.defaultView as Window; return { bodyBg: w.getComputedStyle( body ).backgroundColor, bodyColor: w.getComputedStyle( body ).color, mark: Array.from( body.querySelectorAll( 'mark[class*="wp-suggestion"]' ) ).map( ( e ) => w.getComputedStyle( e ).color + ' on ' + w.getComputedStyle( e ).backgroundColor ) }; } );
	console.log( 'DARK scheme emulation', JSON.stringify( dark ) );
	await shot( page, 'AX-04-dark-scheme-emulated' );
	await page.emulateMedia( { colorScheme: 'light' } );
	// close-ups for AX-07
	const closeups: [ string, any ][] = [
		[ 'AX-07-closeup-add', para( editor, 'quick brown fox' ) ],
		[ 'AX-07-closeup-del', para( editor, 'Third paragraph' ) ],
		[ 'AX-07-closeup-format', para( editor, 'Fourth paragraph' ) ],
		[ 'AX-07-closeup-pending-insert', editor.canvas.locator( '.is-suggestion-pending-insert' ).first() ],
		[ 'AX-07-closeup-pending-remove', editor.canvas.locator( '.is-suggestion-pending-remove' ).first() ],
		[ 'AX-07-closeup-pending-move', editor.canvas.locator( '.is-suggestion-pending-move' ).first() ],
		[ 'AX-07-closeup-move-ghost', editor.canvas.locator( '.is-suggestion-move-ghost' ).first() ],
		[ 'AX-07-closeup-pending-attributes', editor.canvas.locator( '.is-suggestion-pending' ).first() ],
	];
	for ( const [ name, loc ] of closeups ) {
		try {
			await loc.scrollIntoViewIfNeeded();
			await page.waitForTimeout( 200 );
			const b = await loc.boundingBox();
			await page.screenshot( { path: `${ SCREENSHOT_DIR }/${ name }.png`, clip: { x: Math.max( 0, b.x - 24 ), y: Math.max( 0, b.y - 28 ), width: Math.min( 900, b.width + 48 ), height: Math.min( 500, b.height + 56 ) } } );
			console.log( 'CLOSEUP', name, JSON.stringify( b ) );
		} catch ( e ) { console.log( 'CLOSEUP FAIL', name, String( e ).slice( 0, 200 ) ); }
	}
	// overlap checks: floating cards vs each other, vs snackbar, clipped marks
	await editor.canvas.locator( 'body' ).evaluate( ( b: HTMLElement ) => b.ownerDocument.defaultView!.scrollTo( 0, 0 ) );
	await page.waitForTimeout( 800 );
	const overlap = await page.evaluate( () => {
		const rect = ( el: Element ) => { const r = el.getBoundingClientRect(); return { t: Math.round( r.top ), b: Math.round( r.bottom ), l: Math.round( r.left ), r: Math.round( r.right ) }; };
		const cards = Array.from( document.querySelectorAll( '.editor-collab-sidebar-panel__thread.is-floating' ) ).map( rect ).sort( ( a, b ) => a.t - b.t );
		const hits: string[] = [];
		for ( let i = 1; i < cards.length; i++ ) if ( cards[ i ].t < cards[ i - 1 ].b && cards[ i ].l < cards[ i - 1 ].r ) hits.push( `card ${ i - 1 } (${ cards[ i - 1 ].t }-${ cards[ i - 1 ].b }) overlaps card ${ i } (${ cards[ i ].t }-${ cards[ i ].b })` );
		const snacks = Array.from( document.querySelectorAll( '.components-snackbar' ) ).map( rect );
		snacks.forEach( ( s ) => cards.forEach( ( c, i ) => { if ( s.t < c.b && s.b > c.t && s.l < c.r && s.r > c.l ) hits.push( `snackbar overlaps card ${ i }` ); } ) );
		// accept buttons hit-test
		const blocked: string[] = [];
		document.querySelectorAll( '.editor-collab-sidebar-panel__thread.is-floating button[aria-label="Accept suggestion"], .editor-collab-sidebar-panel__thread.is-floating button[aria-label="Reject suggestion"]' ).forEach( ( btn ) => {
			const r = btn.getBoundingClientRect();
			if ( r.bottom < 0 || r.top > window.innerHeight ) return;
			const top = document.elementFromPoint( r.left + r.width / 2, r.top + r.height / 2 );
			if ( top && ! btn.contains( top ) && ! top.contains( btn ) ) blocked.push( `${ btn.getAttribute( 'aria-label' ) } at ${ Math.round( r.top ) } covered by ${ top.tagName }.${ ( top.className || '' ).toString().slice( 0, 60 ) }` );
		} );
		return { cards, hits, snacks, blocked };
	} );
	console.log( 'OVERLAP', JSON.stringify( overlap ) );
	const clip = await editor.canvas.locator( 'body' ).evaluate( ( body: HTMLElement ) => Array.from( body.querySelectorAll( 'mark[class*="wp-suggestion"]' ) ).map( ( m ) => { const p = m.closest( '[data-block]' ) as HTMLElement; const mr = m.getBoundingClientRect(); const pr = p.getBoundingClientRect(); const cs = body.ownerDocument.defaultView!.getComputedStyle( p ); return { text: m.textContent, markBottom: Math.round( mr.bottom ), blockBottom: Math.round( pr.bottom ), overflow: cs.overflow, clipped: cs.overflow !== 'visible' && mr.bottom > pr.bottom }; } ) );
	console.log( 'CLIP', JSON.stringify( clip ) );
	await shot( page, 'AX-07-visual-sweep-top' );
	await editor.canvas.locator( '.is-suggestion-move-ghost' ).first().scrollIntoViewIfNeeded();
	await page.waitForTimeout( 600 );
	await shot( page, 'AX-07-visual-sweep-bottom' );
} );

test( 'AX-05 list view and ghost', async ( { admin, editor, page, pageUtils, requestUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'hjn AX-05' } );
	await openPost( admin, editor, postId );
	await allKinds( page, editor, pageUtils );
	await page.getByRole( 'region', { name: 'Editor top bar' } ).getByRole( 'button', { name: 'Document Overview' } ).click();
	const listView = page.getByRole( 'treegrid', { name: 'Block navigation structure' } );
	await listView.waitFor();
	await page.waitForTimeout( 800 );
	const rows = await listView.getByRole( 'row' ).evaluateAll( ( els ) => els.map( ( el ) => {
		const link = el.querySelector( 'a' );
		const ids = ( link?.getAttribute( 'aria-describedby' ) || '' ).split( ' ' ).filter( Boolean );
		return { cls: Array.from( el.classList ).filter( ( c ) => c.includes( 'suggestion' ) ).join( ' ' ) || 'none', text: ( link?.textContent || '' ).trim().slice( 0, 40 ), describedby: ids.map( ( id ) => document.getElementById( id )?.textContent ).join( ' | ' ), ariaLabel: link?.getAttribute( 'aria-label' ) };
	} ) );
	console.log( 'LIST VIEW ROWS', JSON.stringify( rows, null, 1 ) );
	console.log( 'LIST VIEW ARIA\n' + ( await listView.ariaSnapshot() ).slice( 0, 2500 ) );
	await shot( page, 'AX-05-list-view' );
	const ghost = await editor.canvas.locator( '.is-suggestion-move-ghost' ).first().evaluate( ( el: HTMLElement ) => {
		const focusables = el.querySelectorAll( 'a[href], button, input, [tabindex], [contenteditable="true"]' );
		return { tag: el.tagName, tabindex: el.getAttribute( 'tabindex' ), ariaHidden: el.getAttribute( 'aria-hidden' ), inert: el.hasAttribute( 'inert' ), role: el.getAttribute( 'role' ), ariaLabel: el.getAttribute( 'aria-label' ), contenteditable: el.getAttribute( 'contenteditable' ), focusableDescendants: focusables.length, text: el.textContent, dataBlock: el.getAttribute( 'data-block' ), html: el.outerHTML.slice( 0, 400 ) };
	} );
	console.log( 'GHOST', JSON.stringify( ghost ) );
	// Is there a row for the ghost in list view?
	console.log( 'ROW COUNT', rows.length, 'BLOCK COUNT', ( await getBlocks( page ) ).length );
	// keyboard: tab/arrow through the canvas blocks and see whether focus ever lands in the ghost
	await page.evaluate( () => ( window as any ).wp.data.dispatch( 'core/block-editor' ).clearSelectedBlock() );
	await editor.canvas.getByRole( 'document', { name: 'Block: Heading' } ).click();
	const seen: string[] = [];
	let ghostFocused = false;
	for ( let i = 0; i < 40; i++ ) {
		await page.keyboard.press( 'ArrowDown' );
		const a = await editor.canvas.locator( 'body' ).evaluate( ( b: HTMLElement ) => { const e = b.ownerDocument.activeElement as HTMLElement; return { d: e ? e.tagName + '.' + Array.from( e.classList ).filter( ( c ) => /suggestion|wp-block/.test( c ) ).join( '.' ) + ':' + ( e.textContent || '' ).slice( 0, 20 ) : 'none', inGhost: !! e?.closest( '.is-suggestion-move-ghost' ) }; } );
		if ( a.inGhost ) ghostFocused = true;
		if ( seen[ seen.length - 1 ] !== a.d ) seen.push( a.d );
	}
	console.log( 'ARROW WALK focus path', JSON.stringify( seen ), 'ghost ever focused', ghostFocused );
} );
