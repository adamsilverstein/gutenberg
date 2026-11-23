import path from 'path';
import { test } from '@wordpress/e2e-test-utils-playwright';
import { seedPost, openPost, switchIntent, getBlocks, shot, collectConsole } from '../../helpers';
import { dump, maybeSaved, logWrites, para, settle, flat, summaries } from './util';

const GROUP_CONTENT = `<!-- wp:paragraph -->
<p>Outside paragraph before the group.</p>
<!-- /wp:paragraph -->

<!-- wp:group {"layout":{"type":"constrained"}} -->
<div class="wp-block-group"><!-- wp:paragraph -->
<p>Group child A.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>Group child B.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>Group child C.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>Group child D.</p>
<!-- /wp:paragraph --></div>
<!-- /wp:group -->

<!-- wp:paragraph -->
<p>Outside paragraph after the group.</p>
<!-- /wp:paragraph -->`;

const byText = ( editor: any, type: string, text: string ) =>
	editor.canvas.getByRole( 'document', { name: `Block: ${ type }` } ).filter( { hasText: text } );

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
	await para( editor, 4 ).click();
	await settle( page, 2500 );
	await dump( 'ST-02 after click away', { page, editor, requestUtils, postId } );
	const dirty = await page.evaluate( () => ( window as any ).wp.data.select( 'core/editor' ).isEditedPostDirty() );
	console.log( 'DIRTY', dirty );
	const saveBtn = page.getByRole( 'region', { name: 'Editor top bar' } ).getByRole( 'button', { name: /^Save/ } );
	console.log( 'SAVE BTN', await saveBtn.allInnerTexts(), await saveBtn.first().getAttribute( 'aria-disabled' ).catch( () => 'n/a' ) );
	if ( dirty && ( await saveBtn.count() ) ) {
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

for ( const mode of [ 'Editing', 'Suggesting' ] ) {
	test( `ST-06 remove via key (${ mode })`, async ( { admin, editor, page, requestUtils } ) => {
		const postId = await seedPost( requestUtils, { title: `fg ST-06 ${ mode }` } );
		await openPost( admin, editor, postId );
		logWrites( page );
		if ( mode === 'Suggesting' ) {
			await switchIntent( page, 'Suggesting' );
		}
		const state = async ( label: string ) => {
			const sel = await page.evaluate( () => {
				const s = ( window as any ).wp.data.select( 'core/block-editor' );
				return { start: s.getSelectionStart(), selected: s.getSelectedBlockClientIds().length };
			} );
			const active = await editor.canvas.locator( 'body' ).evaluate( () => ( { tag: document.activeElement?.tagName, cls: ( document.activeElement?.className || '' ).slice( 0, 80 ), type: document.activeElement?.getAttribute( 'data-type' ) } ) );
			console.log( label, JSON.stringify( sel ), JSON.stringify( active ) );
		};
		// Path A: caret in paragraph, Escape, Backspace.
		await para( editor, 1 ).click();
		await state( 'A before Escape' );
		await page.keyboard.press( 'Escape' );
		await settle( page, 500 );
		await state( 'A after Escape' );
		let s = maybeSaved( page, 6000 );
		await page.keyboard.press( 'Backspace' );
		console.log( 'path A save:', await s );
		await settle( page, 1500 );
		await dump( `ST-06 ${ mode } path A (click, Escape, Backspace)`, { page, editor, requestUtils, postId } );
		await shot( page, `ST-06-${ mode.toLowerCase() }-escape-backspace` );
		// Path B: block wrapper focused via selectBlocks, Delete key.
		await editor.selectBlocks( para( editor, 3 ) );
		await state( 'B after selectBlocks' );
		s = maybeSaved( page, 6000 );
		await page.keyboard.press( 'Delete' );
		console.log( 'path B save:', await s );
		await settle( page, 1500 );
		await dump( `ST-06 ${ mode } path B (selectBlocks, Delete)`, { page, editor, requestUtils, postId } );
		// Path C: image block (non-text) clicked, Backspace.
		await editor.canvas.getByRole( 'document', { name: 'Block: Image' } ).click();
		await state( 'C after image click' );
		s = maybeSaved( page, 6000 );
		await page.keyboard.press( 'Backspace' );
		console.log( 'path C save:', await s );
		await settle( page, 1500 );
		await dump( `ST-06 ${ mode } path C (click image, Backspace)`, { page, editor, requestUtils, postId } );
		await shot( page, mode === 'Suggesting' ? 'ST-06-remove-via-delete-key' : 'ST-06-editing-control' );
	} );
}

test( 'ST-07 multi remove full blocks', async ( { admin, editor, page, requestUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'fg ST-07 full' } );
	await openPost( admin, editor, postId );
	logWrites( page );
	await switchIntent( page, 'Suggesting' );
	// Heading (non-paragraph first) -> shift-click third block: paragraph, paragraph.
	await editor.selectBlocks( editor.canvas.getByRole( 'document', { name: 'Block: Heading' } ) );
	await page.keyboard.press( 'Shift+ArrowDown' );
	await page.keyboard.press( 'Shift+ArrowDown' );
	const ms = await page.evaluate( () => {
		const s = ( window as any ).wp.data.select( 'core/block-editor' );
		return { multi: s.getMultiSelectedBlockClientIds().length, full: s.__unstableIsFullySelected?.(), start: s.getSelectionStart(), end: s.getSelectionEnd() };
	} );
	console.log( 'MULTI', JSON.stringify( ms ) );
	await shot( page, 'ST-07-selection' );
	const s = maybeSaved( page, 15000 );
	await page.keyboard.press( 'Backspace' );
	console.log( 'save:', await s );
	await settle( page, 4000 );
	await dump( 'ST-07 full', { page, editor, requestUtils, postId } );
	await shot( page, 'ST-07-remove-multi-block' );
} );

test( 'ST-07b shift-click selection', async ( { admin, editor, page, requestUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'fg ST-07 shiftclick' } );
	await openPost( admin, editor, postId );
	logWrites( page );
	await switchIntent( page, 'Suggesting' );
	await para( editor, 0 ).click();
	await para( editor, 2 ).click( { modifiers: [ 'Shift' ] } );
	const ms = await page.evaluate( () => {
		const s = ( window as any ).wp.data.select( 'core/block-editor' );
		return { multi: s.getMultiSelectedBlockClientIds().length, full: s.__unstableIsFullySelected?.(), start: s.getSelectionStart(), end: s.getSelectionEnd() };
	} );
	console.log( 'MULTI', JSON.stringify( ms ) );
	const s = maybeSaved( page, 15000 );
	await page.keyboard.press( 'Backspace' );
	console.log( 'save:', await s );
	await settle( page, 4000 );
	await dump( 'ST-07b shift-click partial', { page, editor, requestUtils, postId } );
	await shot( page, 'ST-07-shift-click-partial' );
} );

test( 'ST-11 ghost detail', async ( { admin, editor, page, requestUtils, pageUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'fg ST-11' } );
	await openPost( admin, editor, postId );
	logWrites( page );
	await switchIntent( page, 'Suggesting' );
	const mover = byText( editor, 'Paragraph', 'quick brown fox' );
	await editor.selectBlocks( mover );
	const s = maybeSaved( page, 15000 );
	await editor.clickBlockToolbarButton( 'Move down' );
	console.log( 'save:', await s );
	await settle( page, 1500 );
	const ghost = editor.canvas.locator( '.is-suggestion-move-ghost' );
	// Deselect by clicking the title-free heading first.
	await editor.canvas.getByRole( 'document', { name: 'Block: Heading' } ).click();
	const sel0 = await page.evaluate( () => ( window as any ).wp.data.select( 'core/block-editor' ).getSelectionStart() );
	await ghost.click( { force: true } );
	await settle( page, 400 );
	const sel1 = await page.evaluate( () => {
		const s = ( window as any ).wp.data.select( 'core/block-editor' );
		const st = s.getSelectionStart();
		return { st, name: st.clientId && s.getBlockName( st.clientId ), content: st.clientId && String( s.getBlockAttributes( st.clientId )?.content ).slice( 0, 30 ) };
	} );
	console.log( 'SEL before ghost click', JSON.stringify( sel0 ), 'after', JSON.stringify( sel1 ) );
	const domSel = await editor.canvas.locator( 'body' ).evaluate( () => {
		const sel = document.getSelection();
		const g = document.querySelector( '.is-suggestion-move-ghost' );
		return { text: sel?.toString(), inGhost: !! ( g && sel?.anchorNode && g.contains( sel.anchorNode ) ) };
	} );
	console.log( 'DOM selection', JSON.stringify( domSel ) );
	const s2 = maybeSaved( page, 8000 );
	await page.keyboard.type( 'GHOSTTYPE', { delay: 20 } );
	console.log( 'type save:', await s2 );
	await settle( page, 1500 );
	console.log( 'GHOST TEXT AFTER', JSON.stringify( await ghost.allInnerTexts() ) );
	// dblclick / triple click to try to select the ghost text.
	await ghost.click( { force: true, clickCount: 3 } );
	const domSel2 = await editor.canvas.locator( 'body' ).evaluate( () => {
		const sel = document.getSelection();
		const g = document.querySelector( '.is-suggestion-move-ghost' );
		return { text: sel?.toString().slice( 0, 80 ), inGhost: !! ( g && sel?.anchorNode && g.contains( sel.anchorNode ) ) };
	} );
	console.log( 'DOM selection after triple click', JSON.stringify( domSel2 ) );
	await dump( 'ST-11', { page, editor, requestUtils, postId } );
	await pageUtils.pressKeys( 'access+o' );
	const lv = page.getByRole( 'treegrid', { name: 'Block navigation structure' } );
	await lv.waitFor();
	console.log( 'LIST VIEW', JSON.stringify( await lv.getByRole( 'row' ).evaluateAll( ( rows: HTMLElement[] ) => rows.map( ( r ) => ( { text: ( r.textContent || '' ).trim().slice( 0, 60 ), cls: Array.from( r.classList ).filter( ( c ) => /suggest/.test( c ) ).join( ' ' ), desc: r.querySelector( 'a' )?.getAttribute( 'aria-describedby' ) ? document.getElementById( r.querySelector( 'a' )!.getAttribute( 'aria-describedby' )!.split( ' ' )[ 0 ] )?.textContent : null } ) ) ) ) );
	await shot( page, 'ST-11-ghost-inert' );
} );

test( 'ST-17 transform', async ( { admin, editor, page, requestUtils } ) => {
	const errors = collectConsole( page );
	const postId = await seedPost( requestUtils, { title: 'fg ST-17' } );
	await openPost( admin, editor, postId );
	logWrites( page );
	await switchIntent( page, 'Suggesting' );
	await editor.selectBlocks( para( editor, 0 ) );
	const tb = page.getByRole( 'toolbar', { name: 'Block tools' } );
	await tb.getByRole( 'button', { name: /^Paragraph/ } ).first().click();
	const s = maybeSaved( page, 15000 );
	await page.getByRole( 'menuitem', { name: 'Quote', exact: true } ).click();
	console.log( 'save:', await s );
	await settle( page, 3500 );
	await dump( 'ST-17', { page, editor, requestUtils, postId } );
	await shot( page, 'ST-17-transform-block-type' );
	// Review: reject the first suggestion thread and see what remains.
	const sidebar = page.getByRole( 'region', { name: 'Editor settings' } );
	const rejects = sidebar.getByRole( 'button', { name: 'Reject suggestion' } );
	const accepts = sidebar.getByRole( 'button', { name: 'Accept suggestion' } );
	console.log( 'REVIEW BUTTONS accept', await accepts.count(), 'reject', await rejects.count() );
	if ( await rejects.count() ) {
		await rejects.first().click();
		await settle( page, 2500 );
		await dump( 'ST-17 after rejecting first thread', { page, editor, requestUtils, postId } );
		await shot( page, 'ST-17-after-reject' );
	}
	console.log( 'ERRORS', JSON.stringify( errors ) );
} );

test( 'ST-03 insert image with upload', async ( { admin, editor, page, requestUtils, browser } ) => {
	const errors = collectConsole( page );
	const postId = await seedPost( requestUtils, { title: 'fg ST-03', status: 'publish' } );
	await openPost( admin, editor, postId );
	logWrites( page );
	await switchIntent( page, 'Suggesting' );
	await para( editor, 0 ).click();
	await page.getByRole( 'region', { name: 'Editor top bar' } ).getByRole( 'button', { name: 'Block Inserter', exact: true } ).click();
	await page.getByRole( 'searchbox', { name: /Search/ } ).first().fill( 'Image' );
	let s = maybeSaved( page, 6000 );
	await page.getByRole( 'option', { name: 'Image', exact: true } ).click();
	console.log( 'insert save:', await s );
	await settle( page, 1000 );
	await dump( 'ST-03 after inserting empty image', { page, editor, requestUtils, postId } );
	await shot( page, 'ST-03-empty-image-placeholder' );
	const newImage = editor.canvas.getByRole( 'document', { name: 'Block: Image' } ).first();
	s = maybeSaved( page, 30000 );
	await newImage.locator( 'input[type="file"]' ).first().setInputFiles( '/Users/adamsilverstein/repositories/worktrees/suggest-mode-testing-1122/test/e2e/assets/10x10_e2e_test_image_z9T8jK.png' ).catch( async ( e: any ) => {
		console.log( 'setInputFiles failed', String( e ).slice( 0, 300 ), 'cwd', process.cwd() );
	} );
	console.log( 'upload save:', await s );
	await settle( page, 6000 );
	await dump( 'ST-03 after upload', { page, editor, requestUtils, postId } );
	await shot( page, 'ST-03-insert-image-block' );
	// Save the (published) post while suggesting, then read the front end signed out.
	const saveBtn = page.getByRole( 'region', { name: 'Editor top bar' } ).getByRole( 'button', { name: 'Save', exact: true } );
	console.log( 'SAVE count', await saveBtn.count() );
	if ( await saveBtn.count() ) {
		await saveBtn.click();
		await settle( page, 4000 );
	}
	const stored = await requestUtils.rest( { path: `/wp/v2/posts/${ postId }`, params: { context: 'edit' } } );
	console.log( 'STORED RAW image blocks', ( stored.content.raw.match( /<!-- wp:image[^>]*-->/g ) || [] ) );
	const ctx = await browser.newContext( { storageState: { cookies: [], origins: [] } } );
	const fp = await ctx.newPage();
	await fp.goto( `http://localhost:8947/?p=${ postId }` );
	const imgs = await fp.locator( '.entry-content img, .wp-block-post-content img, main img' ).evaluateAll( ( els: HTMLImageElement[] ) => els.map( ( e ) => e.src ) );
	console.log( 'FRONT END imgs', JSON.stringify( imgs ), 'title', await fp.title() );
	await fp.screenshot( { path: '/Users/adamsilverstein/repositories/worktrees/suggest-testing-docs-1122/suggest-mode-testing/run-2026-11-22/screenshots/ST-03-front-end.png' } );
	await ctx.close();
	console.log( 'ERRORS', JSON.stringify( errors ) );
} );

test( 'ST-10 drag handle', async ( { admin, editor, page, requestUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'fg ST-10' } );
	await openPost( admin, editor, postId );
	logWrites( page );
	await switchIntent( page, 'Suggesting' );
	const mover = byText( editor, 'Paragraph', 'quick brown fox' );
	await editor.selectBlocks( mover );
	const handle = page.locator( 'role=toolbar[name="Block tools"i] >> role=button[name="Drag"i][include-hidden]' );
	console.log( 'HANDLE count', await handle.count(), 'disabled', await handle.first().getAttribute( 'aria-disabled' ), await handle.first().isDisabled().catch( () => 'n/a' ) );
	await handle.hover();
	await page.mouse.down();
	const target = byText( editor, 'Paragraph', 'Third paragraph' );
	const box = await target.boundingBox();
	console.log( 'TARGET BOX', JSON.stringify( box ) );
	const s = maybeSaved( page, 15000 );
	if ( box ) {
		const x = box.x + box.width / 2;
		const y = box.y + box.height * 0.8;
		await page.mouse.move( x, y - 40, { steps: 10 } );
		await page.mouse.move( x, y, { steps: 10 } );
		await settle( page, 500 );
		console.log( 'DROP INDICATOR', await page.locator( '.block-editor-block-list__insertion-point-indicator, .block-editor-block-popover__drop-zone' ).count() );
		await shot( page, 'ST-10-dragging' );
		await page.mouse.up();
	}
	console.log( 'save:', await s );
	await settle( page, 2500 );
	await dump( 'ST-10', { page, editor, requestUtils, postId } );
	console.log( 'GHOST', JSON.stringify( await editor.canvas.locator( '.is-suggestion-move-ghost' ).allInnerTexts() ) );
	await shot( page, 'ST-10-move-via-drag' );
} );

test( 'ST-14 nested group', async ( { admin, editor, page, requestUtils, pageUtils } ) => {
	const errors = collectConsole( page );
	const postId = await seedPost( requestUtils, { title: 'fg ST-14', content: GROUP_CONTENT } );
	await openPost( admin, editor, postId );
	logWrites( page );
	await switchIntent( page, 'Suggesting' );
	// insert after child A
	await byText( editor, 'Paragraph', 'Group child A.' ).click();
	await page.keyboard.press( 'End' );
	await page.keyboard.press( 'Enter' );
	let s = maybeSaved( page, 15000 );
	await page.keyboard.type( 'Inserted group child.', { delay: 20 } );
	console.log( 'insert save:', await s );
	await settle( page, 1500 );
	// remove child D
	await editor.selectBlocks( byText( editor, 'Paragraph', 'Group child D.' ) );
	s = maybeSaved( page, 15000 );
	await editor.clickBlockOptionsMenuItem( 'Delete' );
	console.log( 'remove save:', await s );
	await settle( page, 1500 );
	// move child B down
	await editor.selectBlocks( byText( editor, 'Paragraph', 'Group child B.' ) );
	s = maybeSaved( page, 15000 );
	await editor.clickBlockToolbarButton( 'Move down' );
	console.log( 'move save:', await s );
	await settle( page, 2500 );
	await dump( 'ST-14', { page, editor, requestUtils, postId } );
	console.log( 'GHOST', JSON.stringify( await editor.canvas.locator( '.is-suggestion-move-ghost' ).evaluateAll( ( els: HTMLElement[] ) => els.map( ( e ) => ( { text: e.innerText, parent: e.parentElement?.className.slice( 0, 60 ) } ) ) ) ) );
	await page.keyboard.press( 'Escape' );
	await shot( page, 'ST-14-nested-group' );
	const threads = await page.getByRole( 'region', { name: 'Editor settings' } ).locator( '.editor-collab-sidebar-panel__thread' ).allInnerTexts();
	console.log( 'THREADS', JSON.stringify( threads ) );
	await pageUtils.pressKeys( 'access+o' );
	const lv = page.getByRole( 'treegrid', { name: 'Block navigation structure' } );
	await lv.waitFor();
	// expand all
	const rows = lv.getByRole( 'row' );
	console.log( 'LIST VIEW', JSON.stringify( await rows.evaluateAll( ( rs: HTMLElement[] ) => rs.map( ( r ) => ( { level: r.getAttribute( 'aria-level' ), text: ( r.textContent || '' ).trim().slice( 0, 70 ), cls: Array.from( r.classList ).join( ' ' ).slice( 0, 160 ), aria: r.querySelector( 'a' )?.getAttribute( 'aria-label' ) || null } ) ) ) ) );
	await shot( page, 'ST-14-list-view' );
	console.log( 'ERRORS', JSON.stringify( errors ) );
} );

test( 'ST-15 list items add + delete', async ( { admin, editor, page, requestUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'fg ST-15 a' } );
	await openPost( admin, editor, postId );
	logWrites( page );
	await switchIntent( page, 'Suggesting' );
	await byText( editor, 'List item', 'Third item' ).click();
	await page.keyboard.press( 'End' );
	await page.keyboard.press( 'Enter' );
	let s = maybeSaved( page, 15000 );
	await page.keyboard.type( 'Fourth item', { delay: 20 } );
	console.log( 'add save:', await s );
	await settle( page, 1500 );
	await editor.selectBlocks( byText( editor, 'List item', 'First item' ) );
	s = maybeSaved( page, 15000 );
	await editor.clickBlockOptionsMenuItem( 'Delete' );
	console.log( 'delete save:', await s );
	await settle( page, 2500 );
	await dump( 'ST-15 add + delete', { page, editor, requestUtils, postId } );
	await shot( page, 'ST-15-list-items' );
} );

test( 'ST-15 list items reorder', async ( { admin, editor, page, requestUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'fg ST-15 b' } );
	await openPost( admin, editor, postId );
	logWrites( page );
	await switchIntent( page, 'Suggesting' );
	await editor.selectBlocks( byText( editor, 'List item', 'First item' ) );
	const s = maybeSaved( page, 15000 );
	await editor.clickBlockToolbarButton( 'Move down' );
	console.log( 'move save:', await s );
	await settle( page, 2500 );
	await dump( 'ST-15 reorder', { page, editor, requestUtils, postId } );
	console.log( 'GHOST', JSON.stringify( await editor.canvas.locator( '.is-suggestion-move-ghost' ).allInnerTexts() ) );
	console.log( 'LIST DOM', JSON.stringify( await editor.canvas.locator( 'ul.wp-block-list > *' ).evaluateAll( ( els: HTMLElement[] ) => els.map( ( e ) => `${ e.tagName }.${ Array.from( e.classList ).filter( ( c ) => /suggest/.test( c ) ).join( '.' ) }:${ ( e.textContent || '' ).slice( 0, 50 ) }` ) ) ) );
	await page.keyboard.press( 'Escape' );
	await shot( page, 'ST-15-list-reorder' );
} );
