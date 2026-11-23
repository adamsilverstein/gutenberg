import { test } from '@wordpress/e2e-test-utils-playwright';
import { setup, para, report, suggestionSaved, getMarkers, shot, log, brief } from './bc-util';

const safe = ( p: Promise< any > ) => p.catch( ( e ) => log( 'NO SAVE RESPONSE', String( e ).slice( 0, 100 ) ) );

test( 'IA-01 type mid paragraph', async ( { admin, editor, page, requestUtils, context } ) => {
	const f = { admin, editor, page, requestUtils, context };
	const ctx = await setup( f, 'abc IA-01' );
	await para( page, editor, 0, 20 );
	const s = safe( suggestionSaved( page ) );
	await page.keyboard.type( 'MIDWORD ', { delay: 25 } );
	await s;
	await report( ctx, 'IA-01', [ 1 ], f, 'IA-01-type-mid-paragraph' );
} );

test( 'IA-02 type at start', async ( { admin, editor, page, requestUtils, context } ) => {
	const f = { admin, editor, page, requestUtils, context };
	const ctx = await setup( f, 'abc IA-02' );
	await para( page, editor, 0, 0 );
	const s = safe( suggestionSaved( page ) );
	await page.keyboard.type( 'START ', { delay: 25 } );
	await s;
	await report( ctx, 'IA-02', [ 1 ], f, 'IA-02-type-at-start' );
} );

test( 'IA-03 type at end', async ( { admin, editor, page, requestUtils, context } ) => {
	const f = { admin, editor, page, requestUtils, context };
	const ctx = await setup( f, 'abc IA-03' );
	await para( page, editor, 0, 'end' );
	const s = safe( suggestionSaved( page ) );
	await page.keyboard.type( ' TRAILING ', { delay: 25 } );
	await s;
	await report( ctx, 'IA-03', [ 1 ], f, 'IA-03-type-at-end' );
} );

test( 'IA-04 continuous typing', async ( { admin, editor, page, requestUtils, context } ) => {
	const f = { admin, editor, page, requestUtils, context };
	const ctx = await setup( f, 'abc IA-04' );
	await para( page, editor, 0, 20 );
	const s = safe( suggestionSaved( page ) );
	await page.keyboard.type( 'and this is one whole sentence typed in one go ', { delay: 25 } );
	await s;
	await report( ctx, 'IA-04', [ 1 ], f, 'IA-04-continuous-typing-one-marker' );
} );

test( 'IA-05 two additions', async ( { admin, editor, page, requestUtils, context } ) => {
	const f = { admin, editor, page, requestUtils, context };
	const ctx = await setup( f, 'abc IA-05' );
	await para( page, editor, 0, 20 );
	let s = safe( suggestionSaved( page ) );
	await page.keyboard.type( 'FIRSTADD ', { delay: 25 } );
	await s;
	await ctx.writes.quiet();
	await para( page, editor, 2, 17 );
	s = safe( suggestionSaved( page ) );
	await page.keyboard.type( 'THIRDADD ', { delay: 25 } );
	await s;
	await report( ctx, 'IA-05', [ 0, 1, 2, 3, 4 ], f, 'IA-05-two-additions-two-notes' );
} );

test( 'IA-06 resume inside own marker (arrow keys)', async ( { admin, editor, page, requestUtils, context } ) => {
	const f = { admin, editor, page, requestUtils, context };
	const ctx = await setup( f, 'abc IA-06' );
	await para( page, editor, 0, 20 );
	let s = safe( suggestionSaved( page ) );
	await page.keyboard.type( 'ADDED', { delay: 25 } );
	await s;
	await ctx.writes.quiet();
	log( 'IA-06 before', brief( await getMarkers( editor ) ) );
	await page.keyboard.press( 'ArrowLeft' );
	await page.keyboard.press( 'ArrowLeft' );
	await page.keyboard.type( 'XX', { delay: 60 } );
	await report( ctx, 'IA-06', [ 1 ], f, 'IA-06-resume-inside-own-marker' );
} );

test( 'IA-06b resume inside own marker (mouse click)', async ( { admin, editor, page, requestUtils, context } ) => {
	const f = { admin, editor, page, requestUtils, context };
	const ctx = await setup( f, 'abc IA-06b' );
	await para( page, editor, 0, 20 );
	const s = safe( suggestionSaved( page ) );
	await page.keyboard.type( 'ADDEDWORDHERE', { delay: 25 } );
	await s;
	await ctx.writes.quiet();
	// click elsewhere first, then click into the middle of the marker
	await editor.canvas.locator( '[data-type="core/paragraph"]' ).nth( 2 ).click();
	const mark = editor.canvas.locator( 'mark.wp-suggestion-add' ).first();
	const box = await mark.boundingBox();
	await page.mouse.click( box!.x + box!.width / 2, box!.y + box!.height / 2 );
	await page.waitForTimeout( 300 );
	await page.keyboard.type( 'XX', { delay: 60 } );
	await report( ctx, 'IA-06b', [ 1 ], f, 'IA-06-resume-inside-own-marker-click' );
} );

test( 'IA-07 adjacent to existing marker', async ( { admin, editor, page, requestUtils, context } ) => {
	const f = { admin, editor, page, requestUtils, context };
	const ctx = await setup( f, 'abc IA-07' );
	await para( page, editor, 0, 20 );
	let s = safe( suggestionSaved( page ) );
	await page.keyboard.type( 'MID', { delay: 25 } );
	await s;
	await ctx.writes.quiet();
	// leave the block, come back with the caret immediately before the marker
	await para( page, editor, 2, 0 );
	await para( page, editor, 0, 20 );
	log( 'IA-07 sel before PRE', await editor.canvas.locator( 'body' ).evaluate( ( b: HTMLElement ) => { const s = b.ownerDocument.defaultView!.getSelection()!; return { node: s.focusNode?.nodeName, parent: ( s.focusNode as any )?.parentElement?.outerHTML?.slice( 0, 120 ), off: s.focusOffset }; } ) );
	await page.keyboard.type( 'PRE', { delay: 40 } );
	await ctx.writes.quiet();
	log( 'IA-07 after PRE', brief( await getMarkers( editor ) ) );
	await shot( page, 'IA-07-after-typing-before-marker' );
	// immediately after the marker(s): offset 20 + 6
	await para( page, editor, 2, 0 );
	await para( page, editor, 0, 26 );
	log( 'IA-07 sel before POST', await editor.canvas.locator( 'body' ).evaluate( ( b: HTMLElement ) => { const s = b.ownerDocument.defaultView!.getSelection()!; return { node: s.focusNode?.nodeName, parent: ( s.focusNode as any )?.parentElement?.outerHTML?.slice( 0, 120 ), off: s.focusOffset }; } ) );
	await page.keyboard.type( 'POST', { delay: 40 } );
	await report( ctx, 'IA-07', [ 1 ], f, 'IA-07-adjacent-markers' );
} );

test( 'IA-08 enter mid paragraph', async ( { admin, editor, page, requestUtils, context } ) => {
	const f = { admin, editor, page, requestUtils, context };
	const ctx = await setup( f, 'abc IA-08' );
	await para( page, editor, 0, 20 );
	const s = safe( suggestionSaved( page ) );
	await page.keyboard.press( 'Enter' );
	await s;
	await report( ctx, 'IA-08', [ 1, 2 ], f, 'IA-08-enter-mid-paragraph' );
} );

test( 'IA-09 whitespace only', async ( { admin, editor, page, requestUtils, context } ) => {
	const f = { admin, editor, page, requestUtils, context };
	const ctx = await setup( f, 'abc IA-09' );
	await para( page, editor, 0, 22 );
	const s = safe( suggestionSaved( page ) );
	await page.keyboard.type( '   ', { delay: 60 } );
	await s;
	await ctx.writes.quiet();
	log( 'IA-09 marker box', await editor.canvas.locator( 'mark[class*="wp-suggestion"]' ).evaluateAll( ( els: HTMLElement[] ) => els.map( ( e ) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle( e ); return { w: r.width, h: r.height, html: e.innerHTML, len: e.textContent!.length, codes: Array.from( e.textContent! ).map( ( c ) => c.charCodeAt( 0 ) ), bg: cs.backgroundColor, deco: cs.textDecorationLine, ws: cs.whiteSpace }; } ) ) );
	await report( ctx, 'IA-09', [ 1 ], f, 'IA-09-whitespace-only-addition' );
	log( 'IA-09 sidebar html', await page.getByRole( 'region', { name: 'Editor settings' } ).locator( '[role="treeitem"], [role="listitem"], .editor-collab-sidebar-panel__thread' ).first().evaluate( ( e: HTMLElement ) => e.innerHTML.replace( /<svg.*?<\/svg>/g, '' ).slice( 0, 1500 ) ).catch( ( e ) => String( e ).slice( 0, 100 ) ) );
} );
