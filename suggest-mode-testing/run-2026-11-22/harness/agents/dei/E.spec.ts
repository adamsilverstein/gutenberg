import { test } from '@wordpress/e2e-test-utils-playwright';
import { seedPost, openPost, switchIntent, suggestionSaved, shot, collectConsole, getBlocks, getNotes, openNotesSidebar } from '../../helpers';
import { P, dump, selectWord, caretBefore, settle, selText } from './util';

async function start( { admin, editor, page, requestUtils }: any, title: string, mode = 'Suggesting' ) {
	const postId = await seedPost( requestUtils, { title } );
	await openPost( admin, editor, postId );
	const errors = collectConsole( page );
	if ( mode === 'Suggesting' ) await switchIntent( page, 'Suggesting' );
	return { postId, errors };
}

async function markStyle( editor: any ) {
	return editor.canvas.locator( 'mark.wp-suggestion-format' ).first().evaluate( ( el: HTMLElement ) => {
		const cs = el.ownerDocument.defaultView!.getComputedStyle( el );
		return { line: cs.textDecorationLine, style: cs.textDecorationStyle, weight: cs.fontWeight, fontStyle: cs.fontStyle, bg: cs.backgroundColor };
	} ).catch( ( e: Error ) => 'no format mark: ' + e.message.slice( 0, 80 ) );
}

async function snackbars( page: any ) {
	return page.locator( '.components-snackbar-list .components-snackbar' ).allInnerTexts();
}

test( 'FS-01 bold a run', async ( { admin, editor, page, requestUtils, pageUtils } ) => {
	const { postId, errors } = await start( { admin, editor, page, requestUtils }, 'dei FS-01' );
	await selectWord( editor, page, 0, 'jumps' );
	const saved = suggestionSaved( page );
	await pageUtils.pressKeys( 'primary+b' );
	await saved; await settle( page );
	await dump( 'FS-01', { editor, page, requestUtils, postId } );
	console.log( 'STYLE', JSON.stringify( await markStyle( editor ) ) );
	console.log( 'PTEXT', await editor.canvas.locator( P ).first().innerText() );
	await shot( page, 'FS-01-bold-a-run' );
	console.log( 'ERRORS', JSON.stringify( errors ) );
} );

test( 'FS-02 italic a run', async ( { admin, editor, page, requestUtils, pageUtils } ) => {
	const { postId, errors } = await start( { admin, editor, page, requestUtils }, 'dei FS-02' );
	await selectWord( editor, page, 0, 'jumps' );
	const saved = suggestionSaved( page );
	await pageUtils.pressKeys( 'primary+i' );
	await saved; await settle( page );
	await dump( 'FS-02', { editor, page, requestUtils, postId } );
	console.log( 'STYLE', JSON.stringify( await markStyle( editor ) ) );
	await shot( page, 'FS-02-italic-a-run' );
	console.log( 'ERRORS', JSON.stringify( errors ) );
} );

test( 'FS-03 add a link', async ( { admin, editor, page, requestUtils, pageUtils } ) => {
	const { postId, errors } = await start( { admin, editor, page, requestUtils }, 'dei FS-03' );
	await selectWord( editor, page, 0, 'jumps' );
	await pageUtils.pressKeys( 'primary+k' );
	await page.waitForTimeout( 500 );
	await shot( page, 'FS-03-link-popover' );
	const saved = suggestionSaved( page );
	await page.keyboard.type( 'https://example.com/target', { delay: 10 } );
	await page.keyboard.press( 'Enter' );
	await saved; await settle( page );
	await dump( 'FS-03', { editor, page, requestUtils, postId } );
	console.log( 'URL after', page.url() );
	const sidebar = await openNotesSidebar( page );
	console.log( 'SIDEBARTEXT', JSON.stringify( await sidebar.innerText() ).slice( 0, 800 ) );
	await shot( page, 'FS-03-add-link' );
	// Is the pending link navigable by a click in the canvas?
	const link = editor.canvas.locator( P ).first().locator( 'a' ).first();
	console.log( 'LINK count', await link.count(), await link.getAttribute( 'href' ).catch( () => null ) );
	await link.click().catch( ( e: Error ) => console.log( 'link click failed', e.message.slice( 0, 100 ) ) );
	await page.waitForTimeout( 800 );
	console.log( 'URL after click', page.url(), 'pages', page.context().pages().length );
	console.log( 'ERRORS', JSON.stringify( errors ) );
} );

test( 'FS-04 remove existing formatting', async ( { admin, editor, page, requestUtils, pageUtils } ) => {
	const { postId, errors } = await start( { admin, editor, page, requestUtils }, 'dei FS-04' );
	await selectWord( editor, page, 1, 'bold words' );
	const saved = suggestionSaved( page );
	await pageUtils.pressKeys( 'primary+b' );
	await saved; await settle( page );
	await dump( 'FS-04', { editor, page, requestUtils, postId, blocks: [ 2 ] } );
	console.log( 'DOM', await editor.canvas.locator( P ).nth( 1 ).innerHTML() );
	await shot( page, 'FS-04-remove-bold' );
	// Reject restores the bold.
	await switchIntent( page, 'Editing' );
	const sidebar = await openNotesSidebar( page );
	await sidebar.getByRole( 'button', { name: 'Reject suggestion' } ).click();
	await settle( page, 2000 );
	console.log( 'SNACK', JSON.stringify( await snackbars( page ) ) );
	console.log( 'AFTER REJECT', JSON.stringify( ( await getBlocks( page ) )[ 2 ].content ) );
	await shot( page, 'FS-04-reject-restores-bold' );
	console.log( 'ERRORS', JSON.stringify( errors ) );
} );

test( 'FS-05 stacked toggles on one run', async ( { admin, editor, page, requestUtils, pageUtils } ) => {
	const { postId, errors } = await start( { admin, editor, page, requestUtils }, 'dei FS-05' );
	await selectWord( editor, page, 0, 'jumps' );
	const saved = suggestionSaved( page );
	await pageUtils.pressKeys( 'primary+b' );
	await saved; await settle( page );
	console.log( 'SEL after bold', JSON.stringify( await selText( editor ) ) );
	await dump( 'FS-05 after bold', { editor, page, requestUtils, postId } );
	// The dump moved focus to the notes sidebar: reselect in the canvas.
	await selectWord( editor, page, 0, 'jumps' );
	const saved2 = suggestionSaved( page ).catch( () => console.log( 'NO SAVE after italic' ) );
	await pageUtils.pressKeys( 'primary+i' );
	await saved2; await settle( page );
	await dump( 'FS-05 after italic', { editor, page, requestUtils, postId } );
	console.log( 'DOM', await editor.canvas.locator( P ).first().innerHTML() );
	console.log( 'PTEXT', await editor.canvas.locator( P ).first().innerText() );
	await shot( page, 'FS-05-stacked-toggles' );
	console.log( 'ERRORS', JSON.stringify( errors ) );
} );

test( 'FS-06 format overlapping an add marker', async ( { admin, editor, page, requestUtils, pageUtils } ) => {
	const { postId, errors } = await start( { admin, editor, page, requestUtils }, 'dei FS-06' );
	await caretBefore( editor, page, 0, 'jumps' );
	const saved = suggestionSaved( page );
	await page.keyboard.type( 'NEW ', { delay: 25 } );
	await saved; await settle( page );
	await caretBefore( editor, page, 0, 'fox' );
	for ( let i = 0; i < 'fox NEW jumps'.length; i++ ) await page.keyboard.press( 'Shift+ArrowRight' );
	console.log( 'SELECTION', JSON.stringify( await selText( editor ) ) );
	const saved2 = suggestionSaved( page ).catch( () => console.log( 'NO SAVE after bold' ) );
	await pageUtils.pressKeys( 'primary+b' );
	await saved2; await settle( page );
	await dump( 'FS-06', { editor, page, requestUtils, postId } );
	console.log( 'DOM', await editor.canvas.locator( P ).first().innerHTML() );
	console.log( 'PTEXT', await editor.canvas.locator( P ).first().innerText() );
	console.log( 'SNACK', JSON.stringify( await snackbars( page ) ) );
	await shot( page, 'FS-06-format-over-add-marker' );
	console.log( 'ERRORS', JSON.stringify( errors ) );
} );

test( 'FS-07 format across two blocks', async ( { admin, editor, page, requestUtils, pageUtils } ) => {
	const { postId, errors } = await start( { admin, editor, page, requestUtils }, 'dei FS-07' );
	await caretBefore( editor, page, 0, 'near' );
	await pageUtils.pressKeys( 'shift+ArrowDown' );
	await pageUtils.pressKeys( 'shift+End' );
	console.log( 'SELECTION', JSON.stringify( await selText( editor ) ) );
	console.log( 'MULTI', await page.evaluate( () => ( window as any ).wp.data.select( 'core/block-editor' ).getMultiSelectedBlockClientIds().length ) );
	const before = JSON.stringify( ( await getBlocks( page ) ).map( ( b: any ) => b.content ) );
	await pageUtils.pressKeys( 'primary+b' );
	await page.waitForTimeout( 800 );
	console.log( 'SNACK', JSON.stringify( await snackbars( page ) ) );
	await shot( page, 'FS-07-format-across-blocks' );
	await settle( page, 2500 );
	const after = JSON.stringify( ( await getBlocks( page ) ).map( ( b: any ) => b.content ) );
	console.log( 'UNCHANGED', before === after );
	await dump( 'FS-07', { editor, page, requestUtils, postId, blocks: [ 1, 2 ] } );
	console.log( 'ERRORS', JSON.stringify( errors ) );
} );

for ( const mode of [ 'Suggesting', 'Editing' ] ) test( `FS-08 other formats (${ mode })`, async ( { admin, editor, page, requestUtils } ) => {
	const { postId, errors } = await start( { admin, editor, page, requestUtils }, `dei FS-08 ${ mode }`, mode );
	const plan: [ number, string, string ][] = [
		[ 0, 'quick', 'Inline code' ],
		[ 1, 'second', 'Strikethrough' ],
		[ 2, 'plain', 'Superscript' ],
		[ 3, 'closes', 'Highlight color' ],
	];
	let first = true;
	for ( const [ nth, word, format ] of plan ) {
		await selectWord( editor, page, nth, word );
		await editor.clickBlockToolbarButton( 'More' );
		const items = page.getByRole( 'menu' ).last().locator( '[role^="menuitem"]' );
		if ( first ) {
			console.log( 'MENU', JSON.stringify( await items.evaluateAll( ( els: HTMLElement[] ) => els.map( ( e ) => `${ e.innerText.trim() }${ ( e as any ).disabled || e.getAttribute( 'aria-disabled' ) === 'true' ? ' [disabled]' : '' }` ) ) ) );
			if ( mode === 'Suggesting' ) await shot( page, 'FS-08-more-formats-menu' );
			first = false;
		}
		const saved = mode === 'Suggesting' ? suggestionSaved( page ).catch( () => console.log( `NO SAVE for ${ format }` ) ) : Promise.resolve();
		await page.getByRole( 'menu' ).last().locator( '[role^="menuitem"]' ).filter( { hasText: new RegExp( `^${ format }$` ) } ).click();
		if ( format === 'Highlight color' ) {
			await page.waitForTimeout( 500 );
			const swatch = page.locator( '.components-circular-option-picker__option' ).first();
			console.log( 'SWATCHES', await page.locator( '.components-circular-option-picker__option' ).count() );
			await swatch.click().catch( ( e: Error ) => console.log( 'swatch click failed', e.message.slice( 0, 120 ) ) );
			await page.waitForTimeout( 300 );
		}
		await saved;
		await settle( page, 800 );
		console.log( `AFTER ${ format }`, JSON.stringify( ( await getBlocks( page ) )[ nth + 1 ] ) );
		console.log( `DOM ${ format }`, await editor.canvas.locator( P ).nth( nth ).innerHTML() );
		await page.keyboard.press( 'Escape' );
	}
	await dump( `FS-08 ${ mode }`, { editor, page, requestUtils, postId, blocks: [] } );
	await shot( page, mode === 'Suggesting' ? 'FS-08-other-formats' : 'FS-08-control-editing-mode' );
	console.log( 'ERRORS', JSON.stringify( errors ) );
} );
