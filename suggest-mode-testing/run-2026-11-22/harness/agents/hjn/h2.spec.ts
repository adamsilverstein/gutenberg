import { test } from '@wordpress/e2e-test-utils-playwright';
import { seedPost, openPost, switchIntent, suggestionSaved, getMarkers, getBlocks, getNotes, openNotesSidebar, shot, collectConsole, SEED_CONTENT } from '../../helpers';
import { allKinds, summaries, treatments, sugMeta, para, step } from './kit';

const area = ( page: any ) =>
	page.evaluate( () => ( window as any ).wp.data.select( 'core/interface' ).getActiveComplementaryArea( 'core' ) );
const floating = ( page: any ) =>
	page.evaluate( () =>
		Array.from( document.querySelectorAll( '.editor-collab-sidebar-panel__thread' ) ).map( ( el ) => {
			const r = el.getBoundingClientRect();
			const cs = getComputedStyle( el );
			return { cls: el.className, id: el.id, x: Math.round( r.x ), y: Math.round( r.y ), w: Math.round( r.width ), h: Math.round( r.height ), op: cs.opacity, pe: cs.pointerEvents, text: ( el as HTMLElement ).innerText.slice( 0, 80 ) };
		} )
	);

test( 'NS-02 settings sidebar open', async ( { admin, editor, page, requestUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'hjn NS-02' } );
	await openPost( admin, editor, postId );
	await editor.openDocumentSettingsSidebar();
	console.log( 'AREA before', await area( page ) );
	await switchIntent( page, 'Suggesting' );
	await step( page, 'add', async () => {
		await para( editor, 'quick brown fox' ).click();
		await page.keyboard.press( 'End' );
		await page.keyboard.type( ' NS02', { delay: 20 } );
	} );
	await page.waitForTimeout( 1000 );
	console.log( 'AREA after', await area( page ) );
	console.log( 'CARDS', JSON.stringify( await floating( page ) ) );
	console.log( 'MARKERS', JSON.stringify( await getMarkers( editor ) ) );
	console.log( 'ALLNOTES expanded', await page.getByRole( 'region', { name: 'Editor top bar' } ).getByRole( 'button', { name: 'All notes', exact: true } ).getAttribute( 'aria-expanded' ) );
	await shot( page, 'NS-02-settings-sidebar-open' );
} );

test( 'NS-03 closed sidebar', async ( { admin, editor, page, requestUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'hjn NS-03' } );
	await openPost( admin, editor, postId );
	const a0 = await area( page );
	console.log( 'AREA at load', a0 );
	if ( a0 ) {
		await page.evaluate( () => ( window as any ).wp.data.dispatch( 'core/interface' ).disableComplementaryArea( 'core' ) );
	}
	console.log( 'AREA before', await area( page ) );
	await switchIntent( page, 'Suggesting' );
	await step( page, 'add', async () => {
		await para( editor, 'quick brown fox' ).click();
		await page.keyboard.press( 'End' );
		await page.keyboard.type( ' NS03', { delay: 20 } );
	} );
	await page.waitForTimeout( 1500 );
	console.log( 'AREA after', await area( page ) );
	console.log( 'CARDS', JSON.stringify( await floating( page ) ) );
	console.log( 'SETTINGS REGION visible', await page.locator( '.interface-complementary-area' ).count() );
	await shot( page, 'NS-03-closed-sidebar-stays-closed' );
} );

test( 'NS-04 linkage', async ( { admin, editor, page, requestUtils } ) => {
	let filler = '';
	for ( let i = 0; i < 30; i++ ) {
		filler += `\n\n<!-- wp:paragraph -->\n<p>Filler paragraph number ${ i } to make the post long.</p>\n<!-- /wp:paragraph -->`;
	}
	const postId = await seedPost( requestUtils, { title: 'hjn NS-04', content: SEED_CONTENT + filler } );
	await openPost( admin, editor, postId );
	await switchIntent( page, 'Suggesting' );
	await step( page, 'add', async () => {
		await para( editor, 'quick brown fox' ).click();
		await page.keyboard.press( 'End' );
		await page.keyboard.type( ' FIRSTMARK', { delay: 20 } );
	} );
	await step( page, 'add2', async () => {
		await para( editor, 'Third paragraph' ).click();
		await page.keyboard.press( 'End' );
		await page.keyboard.type( ' SECONDMARK', { delay: 20 } );
	} );
	const markers = await getMarkers( editor );
	console.log( 'MARKERS', JSON.stringify( markers ) );
	const sidebar = await openNotesSidebar( page );
	const first = editor.canvas.locator( 'mark.wp-suggestion-add' ).filter( { hasText: 'FIRSTMARK' } );
	const second = editor.canvas.locator( 'mark.wp-suggestion-add' ).filter( { hasText: 'SECONDMARK' } );
	const firstId = await first.getAttribute( 'data-suggestion-id' );
	const secondId = await second.getAttribute( 'data-suggestion-id' );
	await page.evaluate( () => ( window as any ).wp.data.dispatch( 'core/block-editor' ).clearSelectedBlock() );
	await editor.canvas.getByRole( 'document', { name: 'Block: Paragraph' } ).last().scrollIntoViewIfNeeded();
	await page.waitForTimeout( 300 );
	const inView = async ( loc: any ) => loc.evaluate( ( el: HTMLElement ) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < ( el.ownerDocument.defaultView as Window ).innerHeight; } );
	const thick = async ( loc: any ) => loc.evaluate( ( el: HTMLElement ) => { const cs = getComputedStyle( el ); return { thickness: cs.textDecorationThickness, bg: cs.backgroundColor, cls: el.className }; } );
	console.log( 'BEFORE click note: first in viewport', await inView( first ), JSON.stringify( await thick( first ) ) );
	await sidebar.locator( `#note-thread-${ firstId }` ).click();
	await page.waitForTimeout( 800 );
	console.log( 'AFTER click note1: first in viewport', await inView( first ), JSON.stringify( await thick( first ) ), 'second', JSON.stringify( await thick( second ) ) );
	console.log( 'SELECTED BLOCK', await page.evaluate( () => { const s = ( window as any ).wp.data.select( 'core/block-editor' ); const id = s.getSelectedBlockClientId(); return id ? String( s.getBlock( id ).attributes.content ).slice( 0, 50 ) : null; } ) );
	console.log( 'THREAD classes', await sidebar.locator( `#note-thread-${ firstId }` ).getAttribute( 'class' ), '|', await sidebar.locator( `#note-thread-${ secondId }` ).getAttribute( 'class' ) );
	await shot( page, 'NS-04-note-to-marker' );
	// marker -> note
	const box = await second.boundingBox();
	await page.mouse.click( box!.x + box!.width / 2, box!.y + box!.height / 2 );
	await page.waitForTimeout( 800 );
	console.log( 'AFTER click marker2: THREAD classes', await sidebar.locator( `#note-thread-${ firstId }` ).getAttribute( 'class' ), '|', await sidebar.locator( `#note-thread-${ secondId }` ).getAttribute( 'class' ) );
	console.log( 'thick first/second', JSON.stringify( await thick( first ) ), JSON.stringify( await thick( second ) ) );
	console.log( 'FOCUS', await page.evaluate( () => { const a = document.activeElement; return a ? a.tagName + '#' + a.id + '.' + a.className : null; } ) );
	await shot( page, 'NS-04-marker-to-note' );
} );

test( 'NS-05 NS-06 reply and resolve', async ( { admin, editor, page, requestUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'hjn NS-05' } );
	await openPost( admin, editor, postId );
	await switchIntent( page, 'Suggesting' );
	await step( page, 'add', async () => {
		await para( editor, 'quick brown fox' ).click();
		await page.keyboard.press( 'End' );
		await page.keyboard.type( ' REPLYME', { delay: 20 } );
	} );
	const sidebar = await openNotesSidebar( page );
	const thread = sidebar.locator( '.editor-collab-sidebar-panel__thread' );
	console.log( 'THREADS', await thread.count() );
	console.log( 'NS-06 BUTTONS before select', JSON.stringify( await thread.first().getByRole( 'button' ).evaluateAll( ( els ) => els.map( ( e ) => e.getAttribute( 'aria-label' ) || e.textContent ) ) ) );
	await thread.locator( '.editor-collab-sidebar-panel__suggestion-summary' ).click();
	await page.waitForTimeout( 500 );
	console.log( 'NS-06 BUTTONS selected', JSON.stringify( await thread.first().getByRole( 'button' ).evaluateAll( ( els ) => els.map( ( e ) => e.getAttribute( 'aria-label' ) || e.textContent ) ) ) );
	await shot( page, 'NS-06-resolve-vs-accept' );
	// open actions menu if any
	const actions = thread.first().getByRole( 'button', { name: /Actions|Options|More/ } );
	console.log( 'ACTIONS count', await actions.count() );
	if ( await actions.count() ) {
		await actions.first().click();
		await page.waitForTimeout( 300 );
		console.log( 'NS-06 MENU', JSON.stringify( await page.locator( 'body > :not(#wpadminbar) [role="menuitem"], .components-popover [role="menuitem"]' ).allInnerTexts() ) );
		await shot( page, 'NS-06-actions-menu' );
		await page.keyboard.press( 'Escape' );
	}
	const replyBox = sidebar.getByRole( 'textbox', { name: /^Reply to note/ } );
	console.log( 'REPLYBOX', await replyBox.count(), await replyBox.first().getAttribute( 'aria-label' ).catch( () => null ) );
	await replyBox.click();
	await replyBox.pressSequentially( 'Why this change?' );
	const saved = suggestionSaved( page );
	await sidebar.getByRole( 'button', { name: 'Reply', exact: true } ).click();
	await saved;
	await page.waitForTimeout( 800 );
	console.log( 'SNACK', JSON.stringify( await page.locator( '.components-snackbar-list' ).allInnerTexts() ) );
	let notes = await getNotes( requestUtils, postId );
	console.log( 'NOTES after reply', JSON.stringify( notes.map( ( n ) => ( { id: n.id, parent: n.parent, status: n.status, content: n.content, st: n.meta?._wp_suggestion_status, hasSug: !! n.meta?._wp_suggestion } ) ) ) );
	console.log( 'THREAD TEXT', JSON.stringify( await thread.first().innerText() ) );
	await shot( page, 'NS-05-reply-to-suggestion' );
	// accept and save, check reply survives
	await sidebar.getByRole( 'button', { name: 'Accept suggestion' } ).click();
	await page.waitForTimeout( 1000 );
	console.log( 'SNACK2', JSON.stringify( await page.locator( '.components-snackbar-list' ).allInnerTexts() ) );
	await editor.saveDraft();
	await page.waitForTimeout( 1000 );
	notes = await getNotes( requestUtils, postId );
	console.log( 'NOTES after accept+save', JSON.stringify( notes.map( ( n ) => ( { id: n.id, parent: n.parent, status: n.status, content: n.content, st: n.meta?._wp_suggestion_status, ns: n.meta?._wp_note_status } ) ) ) );
	console.log( 'SIDEBAR after accept', JSON.stringify( await sidebar.innerText() ).slice( 0, 600 ) );
	console.log( 'MARKERS', JSON.stringify( await getMarkers( editor ) ) );
	await shot( page, 'NS-05-reply-after-accept' );
	await page.reload();
	await editor.canvas.locator( '.is-root-container' ).waitFor();
	const sb2 = await openNotesSidebar( page );
	await page.waitForTimeout( 1500 );
	console.log( 'SIDEBAR after reload', JSON.stringify( await sb2.innerText() ).slice( 0, 600 ) );
	await shot( page, 'NS-05-reply-after-accept-reload' );
} );

test( 'NS-07 plain note coexists', async ( { admin, editor, page, requestUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'hjn NS-07' } );
	await openPost( admin, editor, postId );
	await para( editor, 'quick brown fox' ).click();
	const tb = page.getByRole( 'toolbar', { name: 'Block tools' } );
	console.log( 'TOOLBAR BUTTONS', JSON.stringify( await tb.getByRole( 'button' ).evaluateAll( ( els ) => els.map( ( e ) => e.getAttribute( 'aria-label' ) || e.textContent ) ) ) );
	const addNote = tb.getByRole( 'button', { name: /^Add note/ } );
	if ( await addNote.count() ) {
		await addNote.click();
	} else {
		await editor.clickBlockOptionsMenuItem( 'Add note' );
	}
	const box = page.getByRole( 'textbox', { name: 'New note', exact: true } );
	await box.click();
	await box.pressSequentially( 'A plain note here' );
	const saved = suggestionSaved( page );
	await page.getByRole( 'button', { name: 'Add note', exact: true } ).last().click();
	await saved;
	await page.waitForTimeout( 800 );
	console.log( 'SNACK', JSON.stringify( await page.locator( '.components-snackbar-list' ).allInnerTexts() ) );
	await switchIntent( page, 'Suggesting' );
	await step( page, 'add', async () => {
		await para( editor, 'quick brown fox' ).click();
		await page.keyboard.press( 'End' );
		await page.keyboard.type( ' WITHNOTE', { delay: 20 } );
	} );
	const sidebar = await openNotesSidebar( page );
	await page.waitForTimeout( 800 );
	const threads = sidebar.locator( '.editor-collab-sidebar-panel__thread' );
	const n = await threads.count();
	console.log( 'THREADS', n );
	for ( let i = 0; i < n; i++ ) {
		console.log( 'THREAD', i, await threads.nth( i ).getAttribute( 'id' ), await threads.nth( i ).getAttribute( 'class' ), JSON.stringify( await threads.nth( i ).innerText() ), 'BUTTONS', JSON.stringify( await threads.nth( i ).getByRole( 'button' ).evaluateAll( ( els ) => els.map( ( e ) => e.getAttribute( 'aria-label' ) || e.textContent ) ) ), 'hasSummary', await threads.nth( i ).locator( '.editor-collab-sidebar-panel__suggestion-summary' ).count() );
	}
	console.log( 'META', JSON.stringify( sugMeta( await getBlocks( page ) ) ) );
	console.log( 'NOTES', JSON.stringify( ( await getNotes( requestUtils, postId ) ).map( ( x ) => ( { id: x.id, content: x.content, hasSug: !! x.meta?._wp_suggestion } ) ) ) );
	await shot( page, 'NS-07-plain-note-and-suggestion' );
	// anchors: click each, read selected block
	for ( let i = 0; i < n; i++ ) {
		await page.evaluate( () => ( window as any ).wp.data.dispatch( 'core/block-editor' ).clearSelectedBlock() );
		await threads.nth( i ).click( { position: { x: 20, y: 12 } } );
		await page.waitForTimeout( 600 );
		console.log( 'CLICK THREAD', i, 'selected block', await page.evaluate( () => { const s = ( window as any ).wp.data.select( 'core/block-editor' ); const id = s.getSelectedBlockClientId(); return id ? String( s.getBlock( id ).attributes.content ).slice( 0, 60 ) : null; } ), 'classes', await threads.nth( i ).getAttribute( 'class' ) );
	}
	console.log( 'CANVAS note highlight', JSON.stringify( await editor.canvas.locator( 'body' ).evaluate( ( b: HTMLElement ) => Array.from( b.querySelectorAll( '[class*="note"], [class*="has-note"]' ) ).map( ( e ) => e.tagName + '.' + e.className ).slice( 0, 10 ) ) ) );
} );

test( 'NS-08 display modes', async ( { admin, editor, page, pageUtils, requestUtils } ) => {
	// Keep the display-mode preference local to this page: other runners share the admin user.
	await page.route( /users\/me/, async ( route ) => {
		const m = route.request().method();
		if ( m === 'PUT' || m === 'POST' ) {
			console.log( 'BLOCKED pref write', m );
			return route.fulfill( { status: 200, contentType: 'application/json', body: '{}' } );
		}
		return route.fallback();
	} );
	const postId = await seedPost( requestUtils, { title: 'hjn NS-08' } );
	await openPost( admin, editor, postId );
	await allKinds( page, editor, pageUtils, [ 'add', 'del', 'insert', 'remove', 'move' ] );
	const pref = () => page.evaluate( () => ( window as any ).wp.data.select( 'core/preferences' ).get( 'core', 'notesDisplayMode' ) );
	const state = async ( label: string ) => {
		await page.waitForTimeout( 800 );
		const cards = await floating( page );
		console.log( 'STATE', label, 'pref', await pref(), 'area', await area( page ), 'cards', cards.length, JSON.stringify( cards.map( ( c ) => ( { cls: c.cls.replace( /editor-collab-sidebar-panel__/g, '' ), w: c.w, h: c.h, op: c.op } ) ) ) );
		console.log( '   markers', ( await getMarkers( editor ) ).length, 'treatments', JSON.stringify( ( await treatments( editor ) ).map( ( t: any ) => t.cls ) ) );
		console.log( '   board class', JSON.stringify( await page.evaluate( () => Array.from( document.querySelectorAll( '[class*="collab-sidebar"], [class*="collab-board"], [class*="canvas-margin"]' ) ).map( ( e ) => e.className ).filter( ( c ) => /minimized|hidden|floating-container|board|margin/.test( c ) ).slice( 0, 6 ) ) ) );
	};
	await state( 'initial' );
	const pick = async ( name: string ) => {
		await page.getByRole( 'region', { name: 'Editor top bar' } ).getByRole( 'button', { name: 'Options' } ).click();
		const sub = page.getByRole( 'menuitem', { name: 'Notes' } );
		await sub.click();
		await page.waitForTimeout( 300 );
		console.log( 'SUBMENU', JSON.stringify( await page.locator( '[role="menuitemradio"], [role="menuitemcheckbox"]' ).evaluateAll( ( els ) => els.map( ( e ) => ( e as HTMLElement ).innerText + ' checked=' + e.getAttribute( 'aria-checked' ) + ' disabled=' + e.getAttribute( 'aria-disabled' ) ) ) ) );
		await page.getByRole( 'menuitemradio', { name: new RegExp( name ) } ).click();
		await page.keyboard.press( 'Escape' );
		await page.keyboard.press( 'Escape' );
	};
	await shot( page, 'NS-08-notes-expanded' );
	await pick( 'Minimize notes' );
	await state( 'minimized' );
	await shot( page, 'NS-08-notes-minimized' );
	await pick( 'Hide notes' );
	await state( 'hidden' );
	await shot( page, 'NS-08-notes-hidden' );
	await pick( 'Expand notes' );
	await state( 'expanded again' );
	console.log( 'SUMMARIES', JSON.stringify( await summaries( page ) ) );
} );

test( 'NS-09 long excerpt', async ( { admin, editor, page, requestUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'hjn NS-09' } );
	await openPost( admin, editor, postId );
	await switchIntent( page, 'Suggesting' );
	const long = ' This is a very long suggested addition that keeps going and going so that the note summary in the sidebar has to deal with far more text than fits on a couple of lines, and it should truncate gracefully instead of overflowing the card or breaking the layout of the rail entirely.';
	await step( page, 'add', async () => {
		await para( editor, 'quick brown fox' ).click();
		await page.keyboard.press( 'End' );
		await page.keyboard.type( long, { delay: 5 } );
	} );
	await page.waitForTimeout( 1500 );
	console.log( 'LEN typed', long.length, 'MARKER LEN', JSON.stringify( ( await getMarkers( editor ) ).map( ( m: any ) => [ m.id, m.type, m.text.length ] ) ) );
	const cards = await floating( page );
	console.log( 'FLOATING', JSON.stringify( cards ) );
	await shot( page, 'NS-09-long-excerpt-floating' );
	const sidebar = await openNotesSidebar( page );
	const summary = sidebar.locator( '.editor-collab-sidebar-panel__suggestion-summary' ).first();
	const measure = () => summary.evaluate( ( el: HTMLElement ) => { const t = el.closest( '.editor-collab-sidebar-panel__thread' ) as HTMLElement; return { text: el.innerText, len: el.innerText.length, sw: el.scrollWidth, cw: el.clientWidth, sh: el.scrollHeight, ch: el.clientHeight, tsw: t.scrollWidth, tcw: t.clientWidth, tw: Math.round( t.getBoundingClientRect().width ), th: Math.round( t.getBoundingClientRect().height ) }; } );
	console.log( 'COLLAPSED', JSON.stringify( await measure() ) );
	await shot( page, 'NS-09-long-suggestion-excerpt' );
	const toggle = summary.getByRole( 'button', { name: 'Show more' } );
	console.log( 'TOGGLE', await toggle.count(), await toggle.getAttribute( 'aria-expanded' ).catch( () => null ) );
	if ( await toggle.count() ) {
		await toggle.click();
		await page.waitForTimeout( 300 );
		console.log( 'EXPANDED', JSON.stringify( await measure() ) );
		await shot( page, 'NS-09-long-excerpt-expanded' );
	}
	console.log( 'NOTES', ( await getNotes( requestUtils, postId ) ).length );
} );

test( 'NS-06b delete action on suggestion note', async ( { admin, editor, page, requestUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'hjn NS-06b' } );
	await openPost( admin, editor, postId );
	await switchIntent( page, 'Suggesting' );
	await step( page, 'add', async () => {
		await para( editor, 'quick brown fox' ).click();
		await page.keyboard.press( 'End' );
		await page.keyboard.type( ' DELNOTE', { delay: 20 } );
	} );
	const sidebar = await openNotesSidebar( page );
	const thread = sidebar.locator( '.editor-collab-sidebar-panel__thread' ).first();
	await thread.locator( '.editor-collab-sidebar-panel__suggestion-summary' ).click();
	await thread.getByRole( 'button', { name: 'Actions' } ).click();
	await page.waitForTimeout( 300 );
	const items = page.locator( '[role="menu"]:not(#wpadminbar *) [role="menuitem"]' );
	console.log( 'MENU', JSON.stringify( await items.allInnerTexts() ) );
	await shot( page, 'NS-06-actions-menu' );
	await page.getByRole( 'menuitem', { name: 'Delete', exact: true } ).last().click();
	await page.waitForTimeout( 500 );
	console.log( 'DIALOG', JSON.stringify( await page.getByRole( 'dialog' ).allInnerTexts() ) );
	const confirm = page.getByRole( 'dialog' ).getByRole( 'button', { name: /Delete/ } );
	if ( await confirm.count() ) {
		await confirm.click();
	}
	await page.waitForTimeout( 1500 );
	console.log( 'SNACK', JSON.stringify( await page.locator( '.components-snackbar-list' ).allInnerTexts() ) );
	console.log( 'MARKERS after delete', JSON.stringify( await getMarkers( editor ) ) );
	console.log( 'BLOCK1', JSON.stringify( ( await getBlocks( page ) )[ 1 ] ) );
	console.log( 'NOTES', JSON.stringify( ( await getNotes( requestUtils, postId ) ).map( ( n ) => ( { id: n.id, status: n.status, st: n.meta?._wp_suggestion_status } ) ) ) );
	console.log( 'THREADS', await sidebar.locator( '.editor-collab-sidebar-panel__thread' ).count() );
	await shot( page, 'NS-06-after-delete-note' );
} );
