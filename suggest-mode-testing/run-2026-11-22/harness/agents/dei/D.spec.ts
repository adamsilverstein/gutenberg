import { test } from '@wordpress/e2e-test-utils-playwright';
import { seedPost, openPost, switchIntent, suggestionSaved, shot, collectConsole, getBlocks, getMarkers, getNotes } from '../../helpers';
import { P, dump, selectWord, caretBefore, settle, selText } from './util';

async function start( { admin, editor, page, requestUtils }: any, title: string ) {
	const postId = await seedPost( requestUtils, { title } );
	await openPost( admin, editor, postId );
	const errors = collectConsole( page );
	await switchIntent( page, 'Suggesting' );
	return { postId, errors };
}

test( 'IR-01 type over selection', async ( { admin, editor, page, requestUtils } ) => {
	const { postId, errors } = await start( { admin, editor, page, requestUtils }, 'dei IR-01' );
	await selectWord( editor, page, 0, 'jumps' );
	const saved = suggestionSaved( page );
	await page.keyboard.type( 'leaps', { delay: 25 } );
	await saved; await settle( page );
	await dump( 'IR-01', { editor, page, requestUtils, postId } );
	console.log( 'PTEXT', await editor.canvas.locator( P ).first().innerText() );
	await shot( page, 'IR-01-type-over-selection' );
	console.log( 'ERRORS', JSON.stringify( errors ) );
} );

test( 'IR-02 paste single line', async ( { admin, editor, page, requestUtils, pageUtils } ) => {
	const { postId, errors } = await start( { admin, editor, page, requestUtils }, 'dei IR-02' );
	await caretBefore( editor, page, 0, 'jumps' );
	pageUtils.setClipboardData( { plainText: 'PASTEDLINE ' } );
	const saved = suggestionSaved( page );
	await pageUtils.pressKeys( 'primary+v' );
	await saved; await settle( page );
	await dump( 'IR-02', { editor, page, requestUtils, postId } );
	await shot( page, 'IR-02-paste-single-line' );
	console.log( 'ERRORS', JSON.stringify( errors ) );
} );

test( 'IR-03 paste over selection', async ( { admin, editor, page, requestUtils, pageUtils } ) => {
	const { postId, errors } = await start( { admin, editor, page, requestUtils }, 'dei IR-03' );
	await selectWord( editor, page, 0, 'jumps' );
	pageUtils.setClipboardData( { plainText: 'REPLACED' } );
	const saved = suggestionSaved( page );
	await pageUtils.pressKeys( 'primary+v' );
	await saved; await settle( page );
	await dump( 'IR-03', { editor, page, requestUtils, postId } );
	console.log( 'PTEXT', await editor.canvas.locator( P ).first().innerText() );
	await shot( page, 'IR-03-paste-over-selection' );
	console.log( 'ERRORS', JSON.stringify( errors ) );
} );

test( 'IR-04 paste multiple lines', async ( { admin, editor, page, requestUtils, pageUtils } ) => {
	const { postId, errors } = await start( { admin, editor, page, requestUtils }, 'dei IR-04' );
	await caretBefore( editor, page, 0, 'jumps' );
	pageUtils.setClipboardData( { plainText: 'LINE ONE\nLINE TWO\nLINE THREE' } );
	const saved = suggestionSaved( page );
	await pageUtils.pressKeys( 'primary+v' );
	await saved; await settle( page, 3000 );
	await dump( 'IR-04', { editor, page, requestUtils, postId, blocks: [ 1, 2, 3, 4 ] } );
	console.log( 'CANVAS', JSON.stringify( await editor.canvas.locator( P ).allInnerTexts() ) );
	console.log( 'CLASSES', JSON.stringify( await editor.canvas.locator( P ).evaluateAll( ( els: HTMLElement[] ) => els.map( ( e ) => e.className ) ) ) );
	await shot( page, 'IR-04-paste-multiple-lines' );
	console.log( 'ERRORS', JSON.stringify( errors ) );
} );

test( 'IR-05 paste rich text', async ( { admin, editor, page, requestUtils, pageUtils } ) => {
	const { postId, errors } = await start( { admin, editor, page, requestUtils }, 'dei IR-05' );
	await caretBefore( editor, page, 0, 'jumps' );
	pageUtils.setClipboardData( {
		plainText: 'rich bold and a link ',
		html: 'rich <strong>bold</strong> and a <a href="https://example.com">link</a> ',
	} );
	const saved = suggestionSaved( page );
	await pageUtils.pressKeys( 'primary+v' );
	await saved; await settle( page );
	await dump( 'IR-05', { editor, page, requestUtils, postId } );
	console.log( 'DOM', await editor.canvas.locator( P ).first().innerHTML() );
	await shot( page, 'IR-05-paste-rich-text' );
	console.log( 'ERRORS', JSON.stringify( errors ) );
} );

async function replaceInDom( paragraph: any, from: string, to: string ) {
	await paragraph.evaluate( ( node: HTMLElement, [ f, t ]: string[] ) => {
		const view = node.ownerDocument.defaultView!;
		node.dispatchEvent( new view.InputEvent( 'beforeinput', { inputType: 'insertReplacementText', data: t, bubbles: true, cancelable: true, composed: true } ) );
		const walker = node.ownerDocument.createTreeWalker( node, view.NodeFilter.SHOW_TEXT );
		let textNode: any;
		while ( ( textNode = walker.nextNode() ) ) {
			if ( textNode.data.includes( f ) ) { textNode.data = textNode.data.replace( f, t ); break; }
		}
		node.dispatchEvent( new view.InputEvent( 'input', { inputType: 'insertReplacementText', data: t, bubbles: true, composed: true } ) );
	}, [ from, to ] );
}

test( 'IR-06 autocorrect seam', async ( { admin, editor, page, requestUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'dei IR-06', content: '<!-- wp:paragraph -->\n<p>Pass teh salt across the table.</p>\n<!-- /wp:paragraph -->' } );
	await openPost( admin, editor, postId );
	const errors = collectConsole( page );
	await switchIntent( page, 'Suggesting' );
	const p = editor.canvas.locator( P ).first();
	await p.click();
	await page.keyboard.press( 'End' );
	const saved = suggestionSaved( page );
	await replaceInDom( p, 'teh ', 'the ' );
	await saved; await settle( page );
	await dump( 'IR-06', { editor, page, requestUtils, postId, blocks: [ 0 ] } );
	console.log( 'PTEXT', await p.innerText() );
	await shot( page, 'IR-06-autocorrect-seam' );
	console.log( 'ERRORS', JSON.stringify( errors ) );
} );

test( 'IR-07 IME composition', async ( { admin, editor, page, requestUtils } ) => {
	const { postId, errors } = await start( { admin, editor, page, requestUtils }, 'dei IR-07' );
	await selectWord( editor, page, 0, 'brown' );
	const saved = suggestionSaved( page );
	const session = await page.context().newCDPSession( page );
	await session.send( 'Input.imeSetComposition', { text: 'こ', selectionStart: 1, selectionEnd: 1 } );
	await session.send( 'Input.imeSetComposition', { text: 'こんにちは', selectionStart: 5, selectionEnd: 5 } );
	await session.send( 'Input.insertText', { text: 'こんにちは' } );
	await saved; await settle( page );
	await dump( 'IR-07', { editor, page, requestUtils, postId } );
	console.log( 'PTEXT', await editor.canvas.locator( P ).first().innerText() );
	await shot( page, 'IR-07-ime-composition' );

	// Second variant: composition at a collapsed caret.
	await caretBefore( editor, page, 1, 'second' );
	const saved2 = suggestionSaved( page );
	await session.send( 'Input.imeSetComposition', { text: 'ねこ', selectionStart: 2, selectionEnd: 2 } );
	await session.send( 'Input.insertText', { text: 'ねこ' } );
	await saved2; await settle( page );
	await dump( 'IR-07 caret', { editor, page, requestUtils, postId, blocks: [ 2 ] } );
	console.log( 'PTEXT2', await editor.canvas.locator( P ).nth( 1 ).innerText() );
	await shot( page, 'IR-07-ime-composition-caret' );
	console.log( 'ERRORS', JSON.stringify( errors ) );
} );

test( 'IR-08 spellcheck replace', async ( { admin, editor, page, requestUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'dei IR-08', content: '<!-- wp:paragraph -->\n<p>Pass teh salt across the table.</p>\n<!-- /wp:paragraph -->' } );
	await openPost( admin, editor, postId );
	const errors = collectConsole( page );
	await switchIntent( page, 'Suggesting' );
	const p = editor.canvas.locator( P ).first();
	// Caret inside the misspelled word, as a right-click would place it.
	await caretBefore( editor, page, 0, 'eh salt' );
	const saved = suggestionSaved( page );
	await replaceInDom( p, 'teh', 'the' );
	await saved; await settle( page );
	await dump( 'IR-08', { editor, page, requestUtils, postId, blocks: [ 0 ] } );
	console.log( 'PTEXT', await p.innerText() );
	await shot( page, 'IR-08-spellcheck-replace' );
	console.log( 'ERRORS', JSON.stringify( errors ) );
} );

for ( const mode of [ 'Suggesting', 'Editing' ] ) test( `IR-09 drag-drop text within a block (${ mode })`, async ( { admin, editor, page, requestUtils } ) => {
	const postId = await seedPost( requestUtils, { title: `dei IR-09 ${ mode }` } );
	await openPost( admin, editor, postId );
	const errors = collectConsole( page );
	if ( mode === 'Suggesting' ) await switchIntent( page, 'Suggesting' );
	const p = await selectWord( editor, page, 0, 'brown ' );
	const rects = await p.evaluate( ( el: HTMLElement ) => {
		const doc = el.ownerDocument;
		const r = doc.getSelection()!.getRangeAt( 0 ).getBoundingClientRect();
		// Target: just before "lazy".
		const walker = doc.createTreeWalker( el, 4 );
		const node: any = walker.nextNode();
		const idx = node.data.indexOf( 'lazy' );
		const range = doc.createRange();
		range.setStart( node, idx ); range.setEnd( node, idx + 1 );
		const t = range.getBoundingClientRect();
		return { sx: r.x + r.width / 2, sy: r.y + r.height / 2, tx: t.x + 1, ty: t.y + t.height / 2 };
	} );
	const frame = await page.locator( 'iframe[name="editor-canvas"]' ).boundingBox();
	const ox = frame ? frame.x : 0, oy = frame ? frame.y : 0;
	console.log( 'RECTS', JSON.stringify( rects ), JSON.stringify( frame ) );
	const events: string[] = [];
	await p.evaluate( ( el: HTMLElement ) => {
		( el.ownerDocument.defaultView as any ).__dnd = [];
		for ( const t of [ 'dragstart', 'drop', 'dragend', 'beforeinput', 'input' ] ) {
			el.ownerDocument.addEventListener( t, ( e: any ) => ( el.ownerDocument.defaultView as any ).__dnd.push( t + ( e.inputType ? ':' + e.inputType : '' ) ), true );
		}
	} );
	await page.mouse.move( ox + rects.sx, oy + rects.sy );
	await page.mouse.down();
	await page.waitForTimeout( 600 );
	await page.mouse.move( ox + rects.sx + 15, oy + rects.sy + 2, { steps: 5 } );
	await page.mouse.move( ox + rects.tx, oy + rects.ty, { steps: 20 } );
	if ( mode === 'Suggesting' ) await shot( page, 'IR-09-drag-in-flight' );
	await page.mouse.up();
	await settle( page, 4000 );
	console.log( 'DNDEVENTS', JSON.stringify( await p.evaluate( ( el: HTMLElement ) => ( el.ownerDocument.defaultView as any ).__dnd ) ), events.length );
	await dump( 'IR-09', { editor, page, requestUtils, postId } );
	console.log( 'PTEXT', await editor.canvas.locator( P ).first().innerText() );
	await shot( page, mode === 'Suggesting' ? 'IR-09-drag-drop-text' : 'IR-09-control-editing-mode' );
	console.log( 'ERRORS', JSON.stringify( errors ) );
} );

test( 'IR-10 marker/overlay invariant', async ( { admin, editor, page, requestUtils, pageUtils } ) => {
	const { postId, errors } = await start( { admin, editor, page, requestUtils }, 'dei IR-10' );
	const step = async ( label: string, fn: () => Promise< void > ) => {
		const saved = suggestionSaved( page ).catch( () => console.log( `NO SAVE for ${ label }` ) );
		await fn();
		await saved; await settle( page, 1200 );
	};
	// IR-01 type over (block 1 = paragraph 0)
	await selectWord( editor, page, 0, 'jumps' );
	await step( 'typeover', () => page.keyboard.type( 'leaps', { delay: 25 } ) );
	// IR-02 paste single line (paragraph 1)
	await caretBefore( editor, page, 1, 'second' );
	pageUtils.setClipboardData( { plainText: 'PASTEDLINE ' } );
	await step( 'paste', () => pageUtils.pressKeys( 'primary+v' ) );
	// IR-03 paste over selection (paragraph 2)
	await selectWord( editor, page, 2, 'plain' );
	pageUtils.setClipboardData( { plainText: 'REPLACED' } );
	await step( 'pasteover', () => pageUtils.pressKeys( 'primary+v' ) );
	// IR-07 IME on paragraph 2
	await caretBefore( editor, page, 2, 'used' );
	const session = await page.context().newCDPSession( page );
	await step( 'ime', async () => {
		await session.send( 'Input.imeSetComposition', { text: 'ねこ', selectionStart: 2, selectionEnd: 2 } );
		await session.send( 'Input.insertText', { text: 'ねこ' } );
	} );
	// IR-05 rich paste (paragraph 3)
	await caretBefore( editor, page, 3, 'closes' );
	pageUtils.setClipboardData( { plainText: 'rich bold link ', html: 'rich <strong>bold</strong> <a href="https://example.com">link</a> ' } );
	await step( 'richpaste', () => pageUtils.pressKeys( 'primary+v' ) );
	// IR-06/08 replacement text on paragraph 3
	const p3 = editor.canvas.locator( P ).nth( 3 );
	await caretBefore( editor, page, 3, 'section' );
	await step( 'autocorrect', () => replaceInDom( p3, 'opening', 'opened' ) );
	// August's breaking gesture: delete inside own pending add on paragraph 0.
	const p0 = editor.canvas.locator( P ).first();
	const add = p0.locator( 'mark.wp-suggestion-add' ).first();
	console.log( 'ADD MARK', await add.count(), await add.textContent().catch( () => null ) );
	await selectWord( editor, page, 0, 'eap' );
	await step( 'delete-inside-own-add', () => page.keyboard.press( 'Backspace' ) );
	// IR-04 multi-line paste last (paragraph 1).
	await caretBefore( editor, page, 1, 'bold' );
	pageUtils.setClipboardData( { plainText: 'LINE ONE\nLINE TWO' } );
	await step( 'multiline', () => pageUtils.pressKeys( 'primary+v' ) );
	await settle( page, 2000 );

	await dump( 'IR-10', { editor, page, requestUtils, postId, blocks: [ 1, 2, 3, 4, 5, 6 ] } );
	const blocks = await getBlocks( page );
	const notes = await getNotes( requestUtils, postId );
	const report = blocks.map( ( b: any, i: number ) => {
		const hasMark = /data-suggestion-id|wp-suggestion/.test( b.content || '' );
		const sug = b.metadata?.suggestion;
		return { i, name: b.name, hasInlineMark: hasMark, suggestion: sug ? sug.type : null, suggestionKeys: sug ? Object.keys( sug ) : null, noteId: b.metadata?.noteId };
	} );
	console.log( 'INVARIANT', JSON.stringify( report ) );
	console.log( 'VIOLATIONS', JSON.stringify( report.filter( ( r: any ) => r.hasInlineMark && r.suggestion === 'pending-attributes' ) ) );
	console.log( 'NOTEMETA', JSON.stringify( notes.map( ( n: any ) => ( { id: n.id, status: n.status, meta: n.meta } ) ) ).slice( 0, 6000 ) );
	console.log( 'CANVAS', JSON.stringify( await editor.canvas.locator( P ).allInnerTexts() ) );
	console.log( 'RENDERED', ( await getMarkers( editor ) ).length );
	await shot( page, 'IR-10-marker-overlay-invariant' );
	console.log( 'ERRORS', JSON.stringify( errors ) );
} );

test( 'IR-04 control: multi-line paste in Editing mode', async ( { admin, editor, page, requestUtils, pageUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'dei IR-04 control' } );
	await openPost( admin, editor, postId );
	await caretBefore( editor, page, 0, 'jumps' );
	pageUtils.setClipboardData( { plainText: 'LINE ONE\nLINE TWO\nLINE THREE' } );
	await pageUtils.pressKeys( 'primary+v' );
	await settle( page, 1500 );
	console.log( 'CONTROL', JSON.stringify( ( await getBlocks( page ) ).map( ( b: any ) => b.content ) ) );
} );

test( 'IR-10b marker + overlay on one block: review consequence', async ( { admin, editor, page, requestUtils, pageUtils } ) => {
	const { postId, errors } = await start( { admin, editor, page, requestUtils }, 'dei IR-10b' );
	await caretBefore( editor, page, 1, 'second' );
	pageUtils.setClipboardData( { plainText: 'PASTEDLINE ' } );
	let saved = suggestionSaved( page );
	await pageUtils.pressKeys( 'primary+v' );
	await saved; await settle( page );
	await caretBefore( editor, page, 1, 'bold' );
	pageUtils.setClipboardData( { plainText: 'LINE ONE\nLINE TWO' } );
	saved = suggestionSaved( page );
	await pageUtils.pressKeys( 'primary+v' );
	await saved; await settle( page, 3000 );
	await dump( 'IR-10b made', { editor, page, requestUtils, postId, blocks: [ 2, 3 ] } );
	console.log( 'OVERLAYDOM', await editor.canvas.locator( 'ins.has-suggestion-addition, del.has-suggestion-deletion' ).count() );
	await shot( page, 'IR-10-marker-plus-overlay-one-block' );
	await switchIntent( page, 'Editing' );
	const sidebar = page.getByRole( 'region', { name: 'Editor settings' } );
	const threads = sidebar.locator( '.editor-collab-sidebar-panel__thread' );
	console.log( 'THREADS', await threads.count() );
	const addThread = threads.filter( { hasText: 'Add: “PASTEDLINE”' } ).first();
	await addThread.click();
	await addThread.getByRole( 'button', { name: 'Reject suggestion' } ).click();
	await settle( page, 2500 );
	await dump( 'IR-10b after rejecting the inline add', { editor, page, requestUtils, postId, blocks: [ 2, 3 ] } );
	const repThread = threads.filter( { hasText: 'LINE ONE' } ).first();
	await repThread.click();
	await repThread.getByRole( 'button', { name: 'Accept suggestion' } ).click();
	await page.waitForTimeout( 800 );
	const dialog = page.getByRole( 'dialog' );
	console.log( 'DIALOG', await dialog.count(), JSON.stringify( await dialog.first().innerText().catch( () => '' ) ) );
	await shot( page, 'IR-10-accept-overlay-confirm' );
	await page.getByRole( 'button', { name: 'Apply anyway' } ).click().catch( ( e: Error ) => console.log( 'no Apply anyway', e.message.slice( 0, 80 ) ) );
	await settle( page, 2500 );
	await dump( 'IR-10b after accepting the overlay', { editor, page, requestUtils, postId, blocks: [ 2, 3 ] } );
	await shot( page, 'IR-10-reject-inline-accept-overlay' );
	console.log( 'ERRORS', JSON.stringify( errors ) );
} );
