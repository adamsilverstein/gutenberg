import { test } from '@wordpress/e2e-test-utils-playwright';
import { seedPost, openPost, switchIntent, getBlocks, shot, collectConsole } from '../../helpers';
import { dump, maybeSaved, logWrites, para, settle, flat, summaries } from './util';

test( 'ST-01 insert block and type', async ( { admin, editor, page, requestUtils } ) => {
	const errors = collectConsole( page );
	const postId = await seedPost( requestUtils, { title: 'fg ST-01' } );
	await openPost( admin, editor, postId );
	logWrites( page );
	await switchIntent( page, 'Suggesting' );
	await para( editor, 0 ).click();
	await page.keyboard.press( 'End' );
	let s = maybeSaved( page, 4000 );
	await page.keyboard.press( 'Enter' );
	console.log( 'after Enter save:', await s );
	await dump( 'ST-01 after Enter (empty)', { page, editor, requestUtils, postId }, { sidebar: false } );
	s = maybeSaved( page, 15000 );
	await page.keyboard.type( 'New inserted paragraph', { delay: 20 } );
	console.log( 'after type save:', await s );
	await settle( page, 2500 );
	await dump( 'ST-01 after typing', { page, editor, requestUtils, postId } );
	await shot( page, 'ST-01-insert-block-and-type' );
	console.log( 'ERRORS', JSON.stringify( errors ) );
} );

test( 'ST-02 empty inserted block', async ( { admin, editor, page, requestUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'fg ST-02' } );
	await openPost( admin, editor, postId );
	logWrites( page );
	await switchIntent( page, 'Suggesting' );
	await para( editor, 0 ).click();
	await page.keyboard.press( 'End' );
	const s = maybeSaved( page, 6000 );
	await page.keyboard.press( 'Enter' );
	console.log( 'after Enter save:', await s );
	await dump( 'ST-02 empty block', { page, editor, requestUtils, postId } );
	await shot( page, 'ST-02-empty-inserted-block' );
	// click away
	await para( editor, 3 ).click();
	await settle( page, 2000 );
	await dump( 'ST-02 after click away', { page, editor, requestUtils, postId } );
	const dirty = await page.evaluate( () => ( window as any ).wp.data.select( 'core/editor' ).isEditedPostDirty() );
	console.log( 'DIRTY', dirty );
	const saveBtn = page.getByRole( 'region', { name: 'Editor top bar' } ).getByRole( 'button', { name: /^Save/ } );
	console.log( 'SAVE BTN', await saveBtn.allInnerTexts(), await saveBtn.first().getAttribute( 'aria-disabled' ).catch( () => 'n/a' ) );
	if ( dirty ) {
		await saveBtn.first().click();
		await settle( page, 3000 );
	}
	const stored = await requestUtils.rest( { path: `/wp/v2/posts/${ postId }`, params: { context: 'edit' } } );
	console.log( 'STORED empty paragraphs:', ( stored.content.raw.match( /<p><\/p>/g ) || [] ).length, 'len', stored.content.raw.length );
	await page.reload();
	await editor.canvas.locator( '.is-root-container' ).first().waitFor();
	await settle( page, 2000 );
	console.log( 'AFTER RELOAD\n' + flat( await getBlocks( page ) ).join( '\n' ) );
	await shot( page, 'ST-02-after-reload' );
} );

test( 'ST-04 slash command', async ( { admin, editor, page, requestUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'fg ST-04' } );
	await openPost( admin, editor, postId );
	logWrites( page );
	await switchIntent( page, 'Suggesting' );
	await para( editor, 0 ).click();
	await page.keyboard.press( 'End' );
	await page.keyboard.press( 'Enter' );
	await page.keyboard.type( '/heading', { delay: 40 } );
	await settle( page, 800 );
	console.log( 'OPTIONS', await page.getByRole( 'option' ).allInnerTexts() );
	await shot( page, 'ST-04-slash-menu-open' );
	await page.keyboard.press( 'Enter' );
	const s = maybeSaved( page, 15000 );
	await page.keyboard.type( 'Slash title', { delay: 20 } );
	console.log( 'save:', await s );
	await settle( page, 2500 );
	await dump( 'ST-04', { page, editor, requestUtils, postId } );
	await shot( page, 'ST-04-slash-command' );
} );

test( 'ST-05 remove a block', async ( { admin, editor, page, requestUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'fg ST-05' } );
	await openPost( admin, editor, postId );
	logWrites( page );
	await switchIntent( page, 'Suggesting' );
	await editor.selectBlocks( para( editor, 2 ) );
	const s = maybeSaved( page, 15000 );
	await editor.clickBlockOptionsMenuItem( 'Delete' );
	console.log( 'save:', await s );
	await settle( page, 2000 );
	await dump( 'ST-05', { page, editor, requestUtils, postId } );
	const deco = await para( editor, 2 ).evaluate( ( el: HTMLElement ) => ( { cls: el.className, td: getComputedStyle( el ).textDecorationLine, op: getComputedStyle( el ).opacity } ) );
	console.log( 'DECO', JSON.stringify( deco ) );
	await shot( page, 'ST-05-remove-block' );
} );

test( 'ST-06 remove via key', async ( { admin, editor, page, requestUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'fg ST-06' } );
	await openPost( admin, editor, postId );
	logWrites( page );
	await switchIntent( page, 'Suggesting' );
	// Path A: caret in paragraph, Escape, Backspace.
	await para( editor, 1 ).click();
	await page.keyboard.press( 'Escape' );
	await settle( page, 500 );
	const sel = await page.evaluate( () => {
		const s = ( window as any ).wp.data.select( 'core/block-editor' );
		return { start: s.getSelectionStart(), selected: s.getSelectedBlockClientIds().length, active: document.activeElement?.tagName };
	} );
	const activeInCanvas = await editor.canvas.locator( 'body' ).evaluate( () => ( { tag: document.activeElement?.tagName, cls: document.activeElement?.className, ce: ( document.activeElement as HTMLElement )?.isContentEditable } ) );
	console.log( 'AFTER ESCAPE', JSON.stringify( sel ), JSON.stringify( activeInCanvas ) );
	let s = maybeSaved( page, 8000 );
	await page.keyboard.press( 'Backspace' );
	console.log( 'path A save:', await s );
	await settle( page, 1500 );
	await dump( 'ST-06 path A (Escape, Backspace)', { page, editor, requestUtils, postId } );
	await shot( page, 'ST-06-escape-backspace' );
	// Path B: block selected (wrapper focused), Delete key.
	await editor.selectBlocks( para( editor, 3 ) );
	const sel2 = await page.evaluate( () => ( window as any ).wp.data.select( 'core/block-editor' ).getSelectionStart() );
	console.log( 'PATH B selection', JSON.stringify( sel2 ) );
	s = maybeSaved( page, 8000 );
	await page.keyboard.press( 'Delete' );
	console.log( 'path B save:', await s );
	await settle( page, 1500 );
	await dump( 'ST-06 path B (selectBlocks, Delete)', { page, editor, requestUtils, postId } );
	await shot( page, 'ST-06-remove-via-delete-key' );
} );

test( 'ST-07 multi remove', async ( { admin, editor, page, requestUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'fg ST-07' } );
	await openPost( admin, editor, postId );
	logWrites( page );
	await switchIntent( page, 'Suggesting' );
	await para( editor, 0 ).click();
	await para( editor, 2 ).click( { modifiers: [ 'Shift' ] } );
	console.log( 'MULTI', await page.evaluate( () => ( window as any ).wp.data.select( 'core/block-editor' ).getMultiSelectedBlockClientIds().length ) );
	const s = maybeSaved( page, 15000 );
	await page.keyboard.press( 'Backspace' );
	console.log( 'save:', await s );
	await settle( page, 4000 );
	await dump( 'ST-07', { page, editor, requestUtils, postId } );
	await shot( page, 'ST-07-remove-multi-block' );
} );

test( 'ST-08/09/11/12 move', async ( { admin, editor, page, requestUtils, pageUtils } ) => {
	const errors = collectConsole( page );
	const postId = await seedPost( requestUtils, { title: 'fg ST-08' } );
	await openPost( admin, editor, postId );
	logWrites( page );
	await switchIntent( page, 'Suggesting' );
	const mover = editor.canvas.getByRole( 'document', { name: 'Block: Paragraph' } ).filter( { hasText: 'quick brown fox' } );
	await editor.selectBlocks( mover );
	let s = maybeSaved( page, 15000 );
	await editor.clickBlockToolbarButton( 'Move down' );
	console.log( 'save:', await s );
	await settle( page, 2000 );
	const n1 = await dump( 'ST-08 moved down once', { page, editor, requestUtils, postId } );
	const ghost = editor.canvas.locator( '.is-suggestion-move-ghost' );
	console.log( 'GHOST count', await ghost.count(), 'text', await ghost.allInnerTexts() );
	const order = () => editor.canvas.locator( '.is-root-container > *' ).evaluateAll( ( els: HTMLElement[] ) => els.map( ( e ) => `${ e.className.includes( 'move-ghost' ) ? 'GHOST' : e.getAttribute( 'data-type' ) }:${ ( e.textContent || '' ).slice( 0, 30 ) }` ) );
	console.log( 'DOM ORDER', JSON.stringify( await order() ) );
	await page.keyboard.press( 'Escape' );
	await shot( page, 'ST-08-move-block-down' );

	// ST-09
	await editor.selectBlocks( mover );
	s = maybeSaved( page, 15000 );
	await editor.clickBlockToolbarButton( 'Move down' );
	console.log( 'save 2:', await s );
	await settle( page, 2000 );
	const n2 = await dump( 'ST-09 moved down twice', { page, editor, requestUtils, postId } );
	console.log( 'NOTE IDS', JSON.stringify( n1.map( ( n ) => [ n.id, n.status ] ) ), '->', JSON.stringify( n2.map( ( n ) => [ n.id, n.status ] ) ) );
	console.log( 'DOM ORDER', JSON.stringify( await order() ) );
	await shot( page, 'ST-09-move-block-twice' );

	// ST-11
	const g = await ghost.first().evaluate( ( el: HTMLElement ) => {
		const cs = getComputedStyle( el );
		return {
			pe: cs.pointerEvents, us: cs.userSelect, ariaHidden: el.getAttribute( 'aria-hidden' ), role: el.getAttribute( 'role' ), label: el.getAttribute( 'aria-label' ),
			inert: el.hasAttribute( 'inert' ), tabindex: el.getAttribute( 'tabindex' ),
			ce: el.querySelectorAll( '[contenteditable="true"]' ).length, selfCe: el.isContentEditable,
			tabbable: el.querySelectorAll( 'a[href],button,input,textarea,select,[tabindex]:not([tabindex="-1"])' ).length,
			html: el.outerHTML.slice( 0, 600 ),
		};
	} );
	console.log( 'GHOST PROPS', JSON.stringify( g ) );
	const before = JSON.stringify( await getBlocks( page ) );
	const selBefore = await page.evaluate( () => ( window as any ).wp.data.select( 'core/block-editor' ).getSelectedBlockClientIds() );
	await ghost.first().click( { force: true } );
	await page.keyboard.type( 'GHOSTTYPE' );
	await settle( page, 1500 );
	const after = JSON.stringify( await getBlocks( page ) );
	const selAfter = await page.evaluate( () => ( window as any ).wp.data.select( 'core/block-editor' ).getSelectedBlockClientIds() );
	console.log( 'GHOST click+type changed blocks?', before !== after, 'contains GHOSTTYPE', after.includes( 'GHOSTTYPE' ), 'sel', JSON.stringify( selBefore ), JSON.stringify( selAfter ) );
	if ( before !== after ) {
		console.log( 'AFTER GHOST TYPE\n' + flat( await getBlocks( page ) ).join( '\n' ) );
	}
	await pageUtils.pressKeys( 'access+o' );
	const lv = page.getByRole( 'treegrid', { name: 'Block navigation structure' } );
	await lv.waitFor();
	console.log( 'LIST VIEW ROWS', JSON.stringify( await lv.getByRole( 'row' ).allInnerTexts() ) );
	await shot( page, 'ST-11-ghost-inert' );
	await pageUtils.pressKeys( 'access+o' );
	console.log( 'ERRORS', JSON.stringify( errors ) );
} );

test( 'ST-12 move then edit', async ( { admin, editor, page, requestUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'fg ST-12' } );
	await openPost( admin, editor, postId );
	logWrites( page );
	await switchIntent( page, 'Suggesting' );
	const mover = editor.canvas.getByRole( 'document', { name: 'Block: Paragraph' } ).filter( { hasText: 'quick brown fox' } );
	await editor.selectBlocks( mover );
	let s = maybeSaved( page, 15000 );
	await editor.clickBlockToolbarButton( 'Move down' );
	console.log( 'save:', await s );
	await settle( page, 1500 );
	await mover.click();
	await page.keyboard.press( 'Home' );
	s = maybeSaved( page, 15000 );
	await page.keyboard.type( 'EDITED ', { delay: 25 } );
	console.log( 'save 2:', await s );
	await settle( page, 2500 );
	await dump( 'ST-12', { page, editor, requestUtils, postId } );
	console.log( 'GHOST', await editor.canvas.locator( '.is-suggestion-move-ghost' ).allInnerTexts() );
	await shot( page, 'ST-12-move-then-edit' );
} );

test( 'ST-13 insert then remove', async ( { admin, editor, page, requestUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'fg ST-13' } );
	await openPost( admin, editor, postId );
	logWrites( page );
	await switchIntent( page, 'Suggesting' );
	await para( editor, 0 ).click();
	await page.keyboard.press( 'End' );
	await page.keyboard.press( 'Enter' );
	let s = maybeSaved( page, 15000 );
	await page.keyboard.type( 'Short lived block', { delay: 20 } );
	console.log( 'save:', await s );
	await settle( page, 2000 );
	await dump( 'ST-13 inserted', { page, editor, requestUtils, postId } );
	const inserted = editor.canvas.getByRole( 'document', { name: 'Block: Paragraph' } ).filter( { hasText: 'Short lived block' } );
	await editor.selectBlocks( inserted );
	s = maybeSaved( page, 15000 );
	await editor.clickBlockOptionsMenuItem( 'Delete' );
	console.log( 'save 2:', await s );
	await settle( page, 3000 );
	await dump( 'ST-13 after delete', { page, editor, requestUtils, postId } );
	await shot( page, 'ST-13-insert-then-remove' );
} );

test( 'ST-16 duplicate', async ( { admin, editor, page, requestUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'fg ST-16' } );
	await openPost( admin, editor, postId );
	logWrites( page );
	await switchIntent( page, 'Suggesting' );
	await editor.selectBlocks( para( editor, 0 ) );
	const s = maybeSaved( page, 15000 );
	await editor.clickBlockOptionsMenuItem( 'Duplicate' );
	console.log( 'save:', await s );
	await settle( page, 2500 );
	await dump( 'ST-16', { page, editor, requestUtils, postId } );
	await shot( page, 'ST-16-duplicate-block' );
} );

test( 'ST-17 transform', async ( { admin, editor, page, requestUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'fg ST-17' } );
	await openPost( admin, editor, postId );
	logWrites( page );
	await switchIntent( page, 'Suggesting' );
	await editor.selectBlocks( para( editor, 0 ) );
	const tb = page.getByRole( 'toolbar', { name: 'Block tools' } );
	console.log( 'TOOLBAR BUTTONS', JSON.stringify( await tb.getByRole( 'button' ).evaluateAll( ( els: HTMLElement[] ) => els.map( ( e ) => e.getAttribute( 'aria-label' ) || e.textContent ) ) ) );
	await tb.getByRole( 'button', { name: /^Paragraph/ } ).first().click();
	await settle( page, 500 );
	console.log( 'MENU', JSON.stringify( await page.getByRole( 'menuitem' ).allInnerTexts() ) );
	const s = maybeSaved( page, 15000 );
	await page.getByRole( 'menuitem', { name: 'Quote' } ).click();
	console.log( 'save:', await s );
	await settle( page, 3500 );
	await dump( 'ST-17', { page, editor, requestUtils, postId } );
	await shot( page, 'ST-17-transform-block-type' );
	console.log( 'SUM', await summaries( page ) );
} );
