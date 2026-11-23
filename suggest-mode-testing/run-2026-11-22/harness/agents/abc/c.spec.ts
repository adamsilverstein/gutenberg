import { test } from '@wordpress/e2e-test-utils-playwright';
import { setup, para, report, caretOffset, suggestionSaved, getMarkers, getBlocks, shot, log, brief } from './bc-util';

const safe = ( p: Promise< any > ) => p.catch( ( e ) => log( 'NO SAVE RESPONSE', String( e ).slice( 0, 100 ) ) );
const selText = ( editor: any ) => editor.canvas.locator( 'body' ).evaluate( ( b: HTMLElement ) => b.ownerDocument.defaultView!.getSelection()!.toString() );
const shiftRight = async ( page: any, n: number ) => { for ( let i = 0; i < n; i++ ) await page.keyboard.press( 'Shift+ArrowRight' ); };
const delStyle = ( editor: any ) => editor.canvas.locator( 'mark.wp-suggestion-del' ).evaluateAll( ( els: HTMLElement[] ) => els.map( ( e ) => { const cs = getComputedStyle( e ); return { deco: cs.textDecorationLine, color: cs.color, decoColor: cs.textDecorationColor, bg: cs.backgroundColor }; } ) );

test( 'ID-01 delete selection', async ( { admin, editor, page, requestUtils } ) => {
	const f = { admin, editor, page, requestUtils };
	const ctx = await setup( f, 'abc ID-01' );
	await para( page, editor, 0, 20 );
	await shiftRight( page, 5 );
	log( 'ID-01 selection', await selText( editor ) );
	const s = safe( suggestionSaved( page ) );
	await page.keyboard.press( 'Delete' );
	await s;
	await ctx.writes.quiet();
	log( 'ID-01 style', await delStyle( editor ) );
	await report( ctx, 'ID-01', [ 1 ], f, 'ID-01-delete-selection' );
} );

test( 'ID-01b backspace selection', async ( { admin, editor, page, requestUtils } ) => {
	const f = { admin, editor, page, requestUtils };
	const ctx = await setup( f, 'abc ID-01b' );
	await para( page, editor, 0, 20 );
	await shiftRight( page, 5 );
	const s = safe( suggestionSaved( page ) );
	await page.keyboard.press( 'Backspace' );
	await s;
	await report( ctx, 'ID-01b', [ 1 ], f, 'ID-01-backspace-selection' );
} );

test( 'ID-02 backspace repeat', async ( { admin, editor, page, requestUtils } ) => {
	const f = { admin, editor, page, requestUtils };
	const ctx = await setup( f, 'abc ID-02' );
	await para( page, editor, 0, 25 );
	const s = safe( suggestionSaved( page ) );
	for ( let i = 0; i < 5; i++ ) {
		await page.keyboard.press( 'Backspace' );
		await page.waitForTimeout( 150 );
		log( `ID-02 after press ${ i + 1 }`, brief( await getMarkers( editor ) ) );
	}
	await s;
	await report( ctx, 'ID-02', [ 1 ], f, 'ID-02-repeated-backspace' );
} );

test( 'ID-03 forward delete', async ( { admin, editor, page, requestUtils } ) => {
	const f = { admin, editor, page, requestUtils };
	const ctx = await setup( f, 'abc ID-03' );
	const p = await para( page, editor, 0, 20 );
	const s = safe( suggestionSaved( page ) );
	for ( let i = 0; i < 5; i++ ) {
		await page.keyboard.press( 'Delete' );
		await page.waitForTimeout( 150 );
		log( `ID-03 after press ${ i + 1 }`, { markers: brief( await getMarkers( editor ) ), rendered: await p.innerText(), caret: await caretOffset( editor, 0 ) } );
		if ( i === 0 ) await shot( page, 'ID-03-forward-delete-one-press' );
	}
	await s;
	await report( ctx, 'ID-03', [ 1 ], f, 'ID-03-forward-delete' );
} );

test( 'ID-04 word delete', async ( { admin, editor, page, requestUtils } ) => {
	const f = { admin, editor, page, requestUtils };
	const ctx = await setup( f, 'abc ID-04' );
	await para( page, editor, 0, 25 );
	const s = safe( suggestionSaved( page ) );
	await page.keyboard.press( 'Alt+Backspace' );
	await s;
	await report( ctx, 'ID-04', [ 1 ], f, 'ID-04-word-delete' );
} );

test( 'ID-05 line delete', async ( { admin, editor, page, requestUtils } ) => {
	const f = { admin, editor, page, requestUtils };
	const ctx = await setup( f, 'abc ID-05' );
	await para( page, editor, 0, 25 );
	const s = safe( suggestionSaved( page ) );
	await page.keyboard.press( 'Meta+Backspace' );
	await s;
	await report( ctx, 'ID-05', [ 1 ], f, 'ID-05-line-delete' );
} );

test( 'ID-06 cut keeps clipboard', async ( { admin, editor, page, requestUtils, context } ) => {
	const f = { admin, editor, page, requestUtils };
	await context.grantPermissions( [ 'clipboard-read', 'clipboard-write' ] );
	const ctx = await setup( f, 'abc ID-06' );
	await page.evaluate( () => navigator.clipboard.writeText( 'SENTINEL-before-cut' ) );
	await para( page, editor, 0, 20 );
	await shiftRight( page, 5 );
	log( 'ID-06 selection', await selText( editor ) );
	const s = safe( suggestionSaved( page ) );
	await page.keyboard.press( 'Meta+x' );
	await s;
	log( 'ID-06 clipboard', await page.evaluate( () => navigator.clipboard.readText() ) );
	await report( ctx, 'ID-06', [ 1 ], f, 'ID-06-cut-keeps-clipboard' );
} );

const EMOJI = `<!-- wp:paragraph -->
<p>Flag \u{1F1EF}\u{1F1F5} here.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>Family \u{1F468}‍\u{1F469}‍\u{1F467} here.</p>
<!-- /wp:paragraph -->`;

test( 'ID-07 emoji graphemes', async ( { admin, editor, page, requestUtils } ) => {
	const f = { admin, editor, page, requestUtils };
	const ctx = await setup( f, 'abc ID-07', EMOJI );
	const cps = ( editor2: any ) => editor2.canvas.locator( 'mark.wp-suggestion-del' ).evaluateAll( ( els: HTMLElement[] ) => els.map( ( e ) => Array.from( e.textContent! ).map( ( c ) => c.codePointAt( 0 )!.toString( 16 ) ) ) );
	// Flag: caret right after the flag = "Flag " (5) + flag (4 UTF-16 units).
	await editor.canvas.locator( '[data-type="core/paragraph"]' ).nth( 0 ).click();
	await page.keyboard.press( 'Home' );
	for ( let i = 0; i < 6; i++ ) await page.keyboard.press( 'ArrowRight' );
	log( 'ID-07 caret flag', await caretOffset( editor, 0 ) );
	let s = safe( suggestionSaved( page ) );
	await page.keyboard.press( 'Backspace' );
	await s;
	await ctx.writes.quiet();
	log( 'ID-07 flag codepoints', await cps( editor ) );
	await shot( page, 'ID-07-emoji-grapheme' );
	await editor.canvas.locator( '[data-type="core/paragraph"]' ).nth( 1 ).click();
	await page.keyboard.press( 'Home' );
	for ( let i = 0; i < 8; i++ ) await page.keyboard.press( 'ArrowRight' );
	log( 'ID-07 caret family', await caretOffset( editor, 1 ) );
	s = safe( suggestionSaved( page ) );
	await page.keyboard.press( 'Backspace' );
	await s;
	await ctx.writes.quiet();
	log( 'ID-07 all codepoints', await cps( editor ) );
	const blocks = await getBlocks( page );
	log( 'ID-07 lone surrogates', blocks.map( ( b: any ) => /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test( b.content ) ) );
	await report( ctx, 'ID-07', [ 0, 1 ], f, 'ID-07b-zwj-family-emoji' );
} );

test( 'ID-08 delete spanning two blocks', async ( { admin, editor, page, requestUtils } ) => {
	const f = { admin, editor, page, requestUtils };
	const ctx = await setup( f, 'abc ID-08' );
	await para( page, editor, 2, 40 );
	// from mid paragraph 3 ("Third paragraph…", 64 chars) into mid paragraph 4.
	await shiftRight( page, 24 + 17 );
	log( 'ID-08 selection', { text: await selText( editor ), multi: await page.evaluate( () => ( window as any ).wp.data.select( 'core/block-editor' ).getMultiSelectedBlockClientIds().length ), sel: await page.evaluate( () => { const s = ( window as any ).wp.data.select( 'core/block-editor' ); return [ s.getSelectionStart().offset, s.getSelectionEnd().offset ]; } ) } );
	await shot( page, 'ID-08-selection-before-delete' );
	const s = safe( suggestionSaved( page ) );
	await page.keyboard.press( 'Delete' );
	await s;
	await report( ctx, 'ID-08', [ 3, 4 ], f, 'ID-08-delete-spanning-two-blocks' );
} );

test( 'ID-08b backspace spanning two blocks', async ( { admin, editor, page, requestUtils } ) => {
	const f = { admin, editor, page, requestUtils };
	const ctx = await setup( f, 'abc ID-08b' );
	await para( page, editor, 2, 40 );
	await shiftRight( page, 24 + 17 );
	const s = safe( suggestionSaved( page ) );
	await page.keyboard.press( 'Backspace' );
	await s;
	await report( ctx, 'ID-08b', [ 3, 4 ], f, 'ID-08-backspace-spanning-two-blocks' );
} );

test( 'ID-09 select all in block delete', async ( { admin, editor, page, requestUtils } ) => {
	const f = { admin, editor, page, requestUtils };
	const ctx = await setup( f, 'abc ID-09' );
	await para( page, editor, 0, 10 );
	await page.keyboard.press( 'Meta+a' );
	log( 'ID-09 selection', await selText( editor ) );
	const s = safe( suggestionSaved( page ) );
	await page.keyboard.press( 'Delete' );
	await s;
	await report( ctx, 'ID-09', [ 1 ], f, 'ID-09-select-all-in-block-delete' );
} );

test( 'ID-10 backspace at block start', async ( { admin, editor, page, requestUtils } ) => {
	const f = { admin, editor, page, requestUtils };
	const ctx = await setup( f, 'abc ID-10' );
	await para( page, editor, 0, 0 );
	const s = safe( suggestionSaved( page ) );
	await page.keyboard.press( 'Backspace' );
	await s;
	await report( ctx, 'ID-10', [ 0, 1 ], f, 'ID-10-backspace-at-block-start' );
} );

test( 'ID-10b backspace at start, paragraph after paragraph', async ( { admin, editor, page, requestUtils } ) => {
	const f = { admin, editor, page, requestUtils };
	const ctx = await setup( f, 'abc ID-10b' );
	await para( page, editor, 2, 0 );
	const s = safe( suggestionSaved( page ) );
	await page.keyboard.press( 'Backspace' );
	await s;
	await report( ctx, 'ID-10b', [ 2, 3 ], f, 'ID-10-backspace-at-paragraph-start-after-paragraph' );
} );

test( 'ID-11 delete straddling marker', async ( { admin, editor, page, requestUtils } ) => {
	const f = { admin, editor, page, requestUtils };
	const ctx = await setup( f, 'abc ID-11' );
	await para( page, editor, 0, 20 );
	let s = safe( suggestionSaved( page ) );
	await page.keyboard.type( 'PENDING', { delay: 25 } );
	await s;
	await ctx.writes.quiet();
	// leave and come back: caret after "PEND" (offset 24), select "INGjumps" (8)
	await para( page, editor, 2, 0 );
	await para( page, editor, 0, 24 );
	await shiftRight( page, 8 );
	log( 'ID-11 selection', await selText( editor ) );
	await shot( page, 'ID-11-selection-before-delete' );
	await page.keyboard.press( 'Delete' );
	await report( ctx, 'ID-11', [ 1 ], f, 'ID-11-delete-straddling-marker' );
} );

test( 'ID-12 delete inside own addition', async ( { admin, editor, page, requestUtils } ) => {
	const f = { admin, editor, page, requestUtils };
	const ctx = await setup( f, 'abc ID-12' );
	await para( page, editor, 0, 20 );
	const s = safe( suggestionSaved( page ) );
	await page.keyboard.type( 'PENDING', { delay: 25 } );
	await s;
	await ctx.writes.quiet();
	await para( page, editor, 2, 0 );
	await para( page, editor, 0, 22 );
	await shiftRight( page, 3 );
	log( 'ID-12 selection', await selText( editor ) );
	await page.keyboard.press( 'Delete' );
	await report( ctx, 'ID-12', [ 1 ], f, 'ID-12-delete-inside-own-addition' );
	// then delete the remainder entirely: does the suggestion withdraw?
	await page.getByRole( 'region', { name: 'Editor top bar' } ).getByRole( 'button', { name: 'All notes', exact: true } ).click().catch( () => {} );
	await para( page, editor, 2, 0 );
	await para( page, editor, 0, 20 );
	await shiftRight( page, 4 );
	log( 'ID-12 second selection', await selText( editor ) );
	await page.keyboard.press( 'Backspace' );
	await report( ctx, 'ID-12 whole', [ 1 ], f, 'ID-12-delete-whole-own-addition' );
} );
