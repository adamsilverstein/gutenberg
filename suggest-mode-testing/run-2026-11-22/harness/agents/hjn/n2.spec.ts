import { test } from '@wordpress/e2e-test-utils-playwright';
import { seedPost, openPost, switchIntent, getMarkers, getBlocks, getNotes, shot, collectConsole, SCREENSHOT_DIR } from '../../helpers';
import { allKinds, treatments, para, step } from './kit';

const focusDesc = ( page: any ) =>
	page.evaluate( () => {
		let doc: Document = document;
		let el = doc.activeElement as HTMLElement | null;
		let frame = '';
		while ( el && el.tagName === 'IFRAME' ) {
			frame = 'canvas>';
			doc = ( el as HTMLIFrameElement ).contentDocument as Document;
			el = doc.activeElement as HTMLElement | null;
		}
		if ( ! el ) return { d: 'none' };
		const cs = doc.defaultView!.getComputedStyle( el );
		const thread = el.closest( '.editor-collab-sidebar-panel__thread' );
		const ring = ( cs.outlineStyle !== 'none' && parseFloat( cs.outlineWidth ) > 0 ) || ( cs.boxShadow && cs.boxShadow !== 'none' );
		return {
			d: `${ frame }${ el.tagName.toLowerCase() }${ el.getAttribute( 'role' ) ? '[' + el.getAttribute( 'role' ) + ']' : '' } "${ ( el.getAttribute( 'aria-label' ) || el.textContent || '' ).trim().slice( 0, 40 ) }"${ thread ? ' in ' + thread.id + ( thread.classList.contains( 'is-floating' ) ? '(floating)' : '' ) : '' }`,
			ring: !! ring,
			ringCss: `outline:${ cs.outlineStyle } ${ cs.outlineWidth } ${ cs.outlineColor }; shadow:${ ( cs.boxShadow || '' ).slice( 0, 70 ) }`,
			focusVisible: el.matches( ':focus-visible' ),
		};
	} );

async function walk( page: any, key: string, max: number, stop: RegExp, log: string[] ) {
	for ( let i = 0; i < max; i++ ) {
		await page.keyboard.press( key );
		await page.waitForTimeout( 120 );
		const f = await focusDesc( page );
		log.push( `${ key } -> ${ f.d } | ring=${ f.ring } fv=${ f.focusVisible }${ f.ring ? '' : ' [' + f.ringCss + ']' }` );
		if ( stop.test( f.d ) ) return f;
	}
	return null;
}

async function twoSuggestions( page: any, editor: any ) {
	await switchIntent( page, 'Suggesting' );
	await step( page, 'add1', async () => {
		await para( editor, 'quick brown fox' ).click();
		await page.keyboard.press( 'End' );
		await page.keyboard.type( ' KEYONE', { delay: 20 } );
	} );
	await step( page, 'add2', async () => {
		await page.evaluate( () => ( window as any ).wp.data.dispatch( 'core/block-editor' ).clearSelectedBlock() );
		await para( editor, 'Third paragraph' ).click();
		await page.keyboard.press( 'End' );
		await page.keyboard.type( ' KEYTWO', { delay: 20 } );
	} );
}

test( 'AX-03a keyboard review via floating notes', async ( { admin, editor, page, requestUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'hjn AX-03a' } );
	await openPost( admin, editor, postId );
	await page.evaluate( () => ( window as any ).wp.data.dispatch( 'core/interface' ).disableComplementaryArea( 'core' ) );
	await twoSuggestions( page, editor );
	console.log( 'START focus', JSON.stringify( await focusDesc( page ) ), 'markers', JSON.stringify( ( await getMarkers( editor ) ).map( ( m: any ) => m.id + ':' + m.text ) ) );
	const log: string[] = [];
	const hit = await walk( page, 'Tab', 25, /Accept suggestion/, log );
	console.log( 'TAB PATH\n  ' + log.join( '\n  ' ) );
	console.log( 'REACHED ACCEPT by Tab from canvas?', !! hit, JSON.stringify( hit ) );
	if ( hit ) {
		await shot( page, 'AX-03-focus-on-accept-floating' );
		await page.keyboard.press( 'Enter' );
		await page.waitForTimeout( 1000 );
		console.log( 'after Enter: snack', JSON.stringify( await page.locator( '.components-snackbar-list' ).allInnerTexts() ), 'markers', JSON.stringify( ( await getMarkers( editor ) ).map( ( m: any ) => m.id + ':' + m.text ) ), 'focus now', JSON.stringify( await focusDesc( page ) ) );
	}
} );

test( 'AX-03b keyboard review via All notes sidebar', async ( { admin, editor, page, pageUtils, requestUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'hjn AX-03b' } );
	await openPost( admin, editor, postId );
	await page.evaluate( () => ( window as any ).wp.data.dispatch( 'core/interface' ).disableComplementaryArea( 'core' ) );
	await twoSuggestions( page, editor );
	console.log( 'START focus', JSON.stringify( await focusDesc( page ) ) );
	const log: string[] = [];
	// region navigation to the top bar
	let inTop = false;
	for ( let i = 0; i < 8 && ! inTop; i++ ) {
		await pageUtils.pressKeys( 'ctrl+`' );
		await page.waitForTimeout( 150 );
		const f = await focusDesc( page );
		log.push( `ctrl+\` -> ${ f.d } | ring=${ f.ring }` );
		inTop = /Editor top bar/.test( f.d );
	}
	console.log( 'REGION PATH\n  ' + log.join( '\n  ' ), '\n reached top bar', inTop );
	const log2: string[] = [];
	const notesBtn = await walk( page, 'Tab', 25, /"All notes"/, log2 );
	console.log( 'TAB to All notes\n  ' + log2.join( '\n  ' ) );
	if ( ! notesBtn ) { console.log( 'COULD NOT REACH All notes by keyboard' ); return; }
	await shot( page, 'AX-03-focus-on-all-notes' );
	await page.keyboard.press( 'Enter' );
	await page.waitForTimeout( 800 );
	console.log( 'after Enter on All notes: focus', JSON.stringify( await focusDesc( page ) ) );
	const log3: string[] = [];
	const acc = await walk( page, 'Tab', 30, /Accept suggestion/, log3 );
	console.log( 'TAB to Accept\n  ' + log3.join( '\n  ' ) );
	if ( ! acc ) { console.log( 'COULD NOT REACH Accept by Tab in sidebar' ); await shot( page, 'AX-03-sidebar-stuck' ); return; }
	await shot( page, 'AX-03-focus-on-accept' );
	const before = ( await getMarkers( editor ) ).map( ( m: any ) => m.id + ':' + m.text );
	await page.keyboard.press( 'Enter' );
	await page.waitForTimeout( 1200 );
	console.log( 'ACCEPT by Enter: markers before', JSON.stringify( before ), 'after', JSON.stringify( ( await getMarkers( editor ) ).map( ( m: any ) => m.id + ':' + m.text ) ), 'snack', JSON.stringify( await page.locator( '.components-snackbar-list' ).allInnerTexts() ) );
	console.log( 'focus after accept', JSON.stringify( await focusDesc( page ) ) );
	const log4: string[] = [];
	const rej = await walk( page, 'Tab', 30, /Reject suggestion/, log4 );
	console.log( 'TAB to Reject\n  ' + log4.join( '\n  ' ) );
	if ( ! rej ) { console.log( 'COULD NOT REACH Reject by Tab after accept' ); await shot( page, 'AX-03-after-accept-stuck' ); return; }
	await shot( page, 'AX-03-focus-on-reject' );
	await page.keyboard.press( 'Enter' );
	await page.waitForTimeout( 1200 );
	console.log( 'REJECT by Enter: markers after', JSON.stringify( ( await getMarkers( editor ) ).map( ( m: any ) => m.id + ':' + m.text ) ), 'snack', JSON.stringify( await page.locator( '.components-snackbar-list' ).allInnerTexts() ) );
	console.log( 'focus after reject', JSON.stringify( await focusDesc( page ) ) );
	console.log( 'blocks', JSON.stringify( ( await getBlocks( page ) ).slice( 1, 4 ).map( ( b: any ) => b.content ) ) );
	console.log( 'notes', JSON.stringify( ( await getNotes( requestUtils, postId ) ).map( ( n: any ) => `${ n.id }:${ n.meta?._wp_suggestion_status }` ) ) );
	// back to canvas by keyboard
	const log5: string[] = [];
	const back = await walk( page, 'Tab', 12, /Back to block/, log5 );
	console.log( 'TAB to Back to block\n  ' + log5.join( '\n  ' ) );
	if ( back ) { await page.keyboard.press( 'Enter' ); await page.waitForTimeout( 500 ); console.log( 'after Back to block focus', JSON.stringify( await focusDesc( page ) ) ); }
	await shot( page, 'AX-03-keyboard-review-done' );
} );

test( 'AX-07b close-ups and overlay check', async ( { admin, editor, page, pageUtils, requestUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'hjn AX-07' } );
	await openPost( admin, editor, postId );
	await page.evaluate( () => ( window as any ).wp.data.dispatch( 'core/interface' ).disableComplementaryArea( 'core' ) );
	await allKinds( page, editor, pageUtils );
	await page.evaluate( () => ( window as any ).wp.data.dispatch( 'core/block-editor' ).clearSelectedBlock() );
	await page.mouse.move( 5, 500 );
	await page.waitForTimeout( 2500 );
	const shots: [ string, string ][] = [
		[ 'add', 'mark.wp-suggestion-add' ], [ 'del', 'mark.wp-suggestion-del' ], [ 'format', 'mark.wp-suggestion-format' ],
		[ 'pending-insert', '.is-suggestion-pending-insert' ], [ 'pending-move', '.is-suggestion-pending-move' ], [ 'move-ghost', '.is-suggestion-move-ghost' ],
		[ 'pending-attributes', '.is-suggestion-pending' ], [ 'pending-remove', '.is-suggestion-pending-remove' ],
	];
	for ( const [ name, sel ] of shots ) {
		const loc = editor.canvas.locator( sel ).first();
		const block = name.length <= 6 ? loc.locator( 'xpath=ancestor::*[@data-block][1]' ) : loc;
		await block.scrollIntoViewIfNeeded();
		await page.waitForTimeout( 250 );
		await block.screenshot( { path: `${ SCREENSHOT_DIR }/AX-07-closeup-${ name }.png` } );
	}
	// canvas semantics of block-level treatments
	console.log( 'CANVAS BLOCK SEMANTICS', JSON.stringify( await editor.canvas.locator( 'body' ).evaluate( ( body: HTMLElement ) => Array.from( body.querySelectorAll( '[class*="is-suggestion-pending"]' ) ).map( ( el ) => { const w = body.ownerDocument.defaultView!; const cs = w.getComputedStyle( el ); const prev = el.previousElementSibling as HTMLElement | null; return { cls: Array.from( el.classList ).filter( ( c ) => c.includes( 'suggestion' ) ).join( ' ' ), ariaLabel: el.getAttribute( 'aria-label' ), ariaDescription: el.getAttribute( 'aria-description' ), describedby: el.getAttribute( 'aria-describedby' ), details: el.getAttribute( 'aria-details' ), hiddenTextInside: Array.from( el.querySelectorAll( '[data-visually-hidden], .screen-reader-text' ) ).map( ( e ) => e.textContent ), prevSibling: prev ? ( prev.className || '' ).toString().slice( 0, 50 ) + ':' + ( prev.textContent || '' ).slice( 0, 50 ) : null, outline: cs.outlineStyle + ' ' + cs.outlineWidth, bg: cs.backgroundColor, opacity: cs.opacity, deco: cs.textDecorationLine, before: w.getComputedStyle( el, '::before' ).content.slice( 0, 40 ), after: w.getComputedStyle( el, '::after' ).content.slice( 0, 40 ), afterBox: w.getComputedStyle( el, '::after' ).outlineStyle + '/' + w.getComputedStyle( el, '::after' ).borderTopStyle + '/' + w.getComputedStyle( el, '::after' ).backgroundColor }; } ) ), null, 1 ) );
	// the overlay that covered a card's buttons near the bottom edge
	await editor.canvas.locator( 'body' ).evaluate( ( b: HTMLElement ) => b.ownerDocument.defaultView!.scrollTo( 0, 0 ) );
	await page.waitForTimeout( 800 );
	const ov = await page.evaluate( () => {
		const out: any[] = [];
		document.querySelectorAll( '.editor-collab-sidebar-panel__thread.is-floating button[aria-label="Accept suggestion"]' ).forEach( ( btn ) => {
			const r = btn.getBoundingClientRect();
			const top = document.elementFromPoint( r.left + r.width / 2, r.top + r.height / 2 ) as HTMLElement | null;
			const covered = !! top && ! btn.contains( top ) && ! top.contains( btn );
			const tr = top?.getBoundingClientRect();
			out.push( { btnTop: Math.round( r.top ), inViewport: r.top < window.innerHeight && r.bottom > 0, covered, by: covered && top ? `${ top.tagName }.${ ( top.className || '' ).toString().slice( 0, 70 ) } aria-label=${ top.getAttribute( 'aria-label' ) } role=${ top.getAttribute( 'role' ) } rect=${ Math.round( tr!.left ) },${ Math.round( tr!.top ) },${ Math.round( tr!.width ) }x${ Math.round( tr!.height ) } children=${ top.childElementCount } parent=${ ( top.parentElement?.className || '' ).toString().slice( 0, 70 ) }/${ top.parentElement?.getAttribute( 'aria-label' ) } pe=${ getComputedStyle( top ).pointerEvents }` : null } );
		} );
		return { vh: window.innerHeight, out };
	} );
	console.log( 'ACCEPT BUTTON HIT TEST', JSON.stringify( ov, null, 1 ) );
	await shot( page, 'AX-07-visual-sweep-top' );
	const covered = ov.out.find( ( o: any ) => o.covered && o.inViewport );
	if ( covered ) {
		const btn = page.locator( '.editor-collab-sidebar-panel__thread.is-floating button[aria-label="Accept suggestion"]' ).nth( ov.out.indexOf( covered ) );
		const res = await btn.click( { timeout: 4000, trial: true } ).then( () => 'trial click OK (Playwright scrolled or it is clickable)', ( e: any ) => 'trial click FAILED: ' + String( e ).split( '\n' ).slice( 0, 8 ).join( ' / ' ).slice( 0, 600 ) );
		console.log( 'TRIAL CLICK on covered Accept', res );
		const r2 = await page.mouse.click( 1100, covered.btnTop + 12 ).then( () => 'clicked' );
		await page.waitForTimeout( 800 );
		console.log( 'RAW MOUSE CLICK at covered button', r2, 'snack', JSON.stringify( await page.locator( '.components-snackbar-list' ).allInnerTexts() ), 'notes', JSON.stringify( ( await getNotes( requestUtils, postId ) ).map( ( n: any ) => `${ n.id }:${ n.meta?._wp_suggestion_status }` ) ) );
	}
	await editor.canvas.locator( 'body' ).evaluate( ( b: HTMLElement ) => b.ownerDocument.defaultView!.scrollTo( 0, 100000 ) );
	await page.waitForTimeout( 800 );
	await shot( page, 'AX-07-visual-sweep-bottom' );
} );

for ( const [ label, vp, dsf ] of [ [ '1100', { width: 1100, height: 800 }, 1 ], [ '200pct', { width: 720, height: 450 }, 2 ] ] as const ) {
	test( `AX-06 viewport ${ label }`, async ( { browser, requestUtils } ) => {
		const postId = await seedPost( requestUtils, { title: `hjn AX-06 ${ label }` } );
		const context = await browser.newContext( { baseURL: process.env.WP_BASE_URL, storageState: process.env.STORAGE_STATE_PATH, viewport: vp, deviceScaleFactor: dsf } );
		const page = await context.newPage();
		await page.goto( `/wp-admin/post.php?post=${ postId }&action=edit` );
		const canvas = page.frameLocator( 'iframe[name="editor-canvas"]' );
		await canvas.locator( '.is-root-container' ).waitFor();
		console.log( label, 'innerWidth', await page.evaluate( () => [ window.innerWidth, window.innerHeight, window.devicePixelRatio ] ) );
		// switch intent
		const options = page.getByRole( 'region', { name: 'Editor top bar' } ).getByRole( 'button', { name: 'Options' } );
		console.log( label, 'Options visible', await options.isVisible() );
		await options.click();
		const item = page.getByRole( 'menuitemradio', { name: /^Suggesting/ } );
		console.log( label, 'Suggesting item visible', await item.isVisible().catch( () => false ) );
		await item.click();
		await page.keyboard.press( 'Escape' );
		const p = canvas.getByRole( 'document', { name: 'Block: Paragraph' } ).filter( { hasText: 'quick brown fox' } );
		const saved = page.waitForResponse( ( r ) => /\/wp\/v2\/comments/.test( r.url() ) && r.request().method() === 'POST' && r.ok(), { timeout: 20000 } ).then( () => 'saved', ( e ) => 'NO SAVE ' + e );
		await p.click();
		await page.keyboard.press( 'End' );
		await page.keyboard.type( ' ZOOMED', { delay: 20 } );
		console.log( label, 'suggestion', await saved );
		await page.waitForTimeout( 1500 );
		const metrics = async () => page.evaluate( () => {
			const de = document.documentElement;
			const cards = Array.from( document.querySelectorAll( '.editor-collab-sidebar-panel__thread' ) ).map( ( el ) => { const r = el.getBoundingClientRect(); return { cls: el.className.replace( /\S*stack\S* ?/, '' ).replace( 'editor-collab-sidebar-panel__', '' ), l: Math.round( r.left ), r: Math.round( r.right ), t: Math.round( r.top ), w: Math.round( r.width ), offRight: r.right > window.innerWidth, vis: getComputedStyle( el ).visibility + '/' + getComputedStyle( el ).display } } );
			const btns = Array.from( document.querySelectorAll( 'button[aria-label="Accept suggestion"], button[aria-label="Reject suggestion"]' ) ).map( ( b ) => { const r = b.getBoundingClientRect(); const top = document.elementFromPoint( r.left + r.width / 2, r.top + r.height / 2 ); return { label: b.getAttribute( 'aria-label' ), w: Math.round( r.width ), h: Math.round( r.height ), x: Math.round( r.left ), y: Math.round( r.top ), inViewport: r.left >= 0 && r.right <= window.innerWidth && r.top >= 0 && r.bottom <= window.innerHeight, hit: !! top && ( b.contains( top ) || top.contains( b ) ) }; } );
			return { bodyScrollsX: de.scrollWidth > de.clientWidth, scrollW: de.scrollWidth, clientW: de.clientWidth, cards, btns, allNotes: !! document.querySelector( 'button[aria-label="All notes"]' ) };
		} );
		console.log( label, 'METRICS (floating state)', JSON.stringify( await metrics() ) );
		const markBox = await canvas.locator( 'mark.wp-suggestion-add' ).first().boundingBox();
		console.log( label, 'marker box', JSON.stringify( markBox ), 'canvas scrollsX', await canvas.locator( 'body' ).evaluate( ( b: HTMLElement ) => { const de = b.ownerDocument.documentElement; return [ de.scrollWidth, de.clientWidth ]; } ) );
		await page.screenshot( { path: `${ SCREENSHOT_DIR }/AX-06-${ label }-floating.png` } );
		// open All notes
		const toggle = page.getByRole( 'region', { name: 'Editor top bar' } ).getByRole( 'button', { name: 'All notes', exact: true } );
		console.log( label, 'All notes button visible', await toggle.isVisible().catch( () => false ) );
		if ( await toggle.isVisible().catch( () => false ) ) {
			if ( ( await toggle.getAttribute( 'aria-expanded' ) ) === 'false' ) await toggle.click();
		} else {
			// small viewport: reach it through Options > Notes
			await options.click();
			console.log( label, 'OPTIONS MENU items', JSON.stringify( await page.locator( '[role="menu"] [role^="menuitem"]' ).allInnerTexts() ).slice( 0, 500 ) );
			const notesItem = page.getByRole( 'menuitem', { name: 'Notes' } ).or( page.getByRole( 'menuitemcheckbox', { name: 'Show all notes' } ) );
			if ( await notesItem.count() ) {
				await notesItem.first().click();
				const show = page.getByRole( 'menuitemcheckbox', { name: 'Show all notes' } );
				if ( await show.count() ) await show.click();
			}
			await page.keyboard.press( 'Escape' );
		}
		await page.waitForTimeout( 1000 );
		console.log( label, 'METRICS (All notes open)', JSON.stringify( await metrics() ) );
		await page.screenshot( { path: `${ SCREENSHOT_DIR }/AX-06-${ label }-all-notes.png` } );
		const accept = page.getByRole( 'button', { name: 'Accept suggestion' } ).first();
		const res = await accept.click( { timeout: 6000 } ).then( () => 'clicked', ( e: any ) => 'CLICK FAILED ' + String( e ).split( '\n' ).slice( 0, 6 ).join( ' / ' ).slice( 0, 500 ) );
		await page.waitForTimeout( 1000 );
		console.log( label, 'ACCEPT click', res, 'snack', JSON.stringify( await page.locator( '.components-snackbar-list' ).allInnerTexts() ), 'markers left', await canvas.locator( 'mark[class*="wp-suggestion"]' ).count() );
		await page.screenshot( { path: `${ SCREENSHOT_DIR }/AX-06-${ label }-after-accept.png` } );
		await context.close();
	} );
}
