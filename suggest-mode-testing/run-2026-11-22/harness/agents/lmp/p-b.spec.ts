import { test } from '@wordpress/e2e-test-utils-playwright';
import { shot, collectConsole, USERS } from '../../helpers';
import { log, savePost, blocksOf, markersIn, snackbars, canvasOf } from './lib';
import { newPost, adminOpen, gesture, report, cards, compact, session, spoken } from './plib';

test( 'OV-06 OV-09 OV-13 editor then admin', async ( { admin, editor, page, pageUtils, requestUtils, browser } ) => {
	const err = collectConsole( page );
	const id = await newPost( requestUtils, 'OV-06' );
	log( 'POST', id );
	const ed = await session( browser, USERS.editor );
	await ed.open( id );
	await gesture( ed.page, 'OV-06 editor add', 'brown', 'start', () => ed.page.keyboard.type( 'EDITOR SENTENCE HERE ', { delay: 20 } ) );
	log( 'ed save', await savePost( ed.page ) );
	await ed.leave();

	await adminOpen( { admin, editor, page }, id );
	await gesture( page, 'OV-06 admin types inside editor add', 'SENTENCE', 'start', () => page.keyboard.type( 'ADMIN ', { delay: 20 } ) );
	await report( page, requestUtils, id, 'OV-06 nested add' );
	await gesture( page, 'OV-06 admin deletes inside editor add', 'HERE', undefined, () => page.keyboard.press( 'Backspace' ) );
	await gesture( page, 'OV-06 admin bolds inside editor add', 'EDITOR', undefined, () => pageUtils.pressKeys( 'primary+b' ) );
	await report( page, requestUtils, id, 'OV-06 all' );
	const c = await cards( page, 'OV-09' );
	await shot( page, 'OV-06-admin-nests-in-editor-add' );
	log( 'admin save', await savePost( page ) );
	await page.reload();
	await editor.canvas.locator( '.is-root-container' ).first().waitFor();
	await page.waitForTimeout( 1500 );
	log( 'OV-06 after reload', compact( await markersIn( page ) ) );
	log( 'OV-06 after reload html', ( await blocksOf( page ) )[ 0 ].content );

	// OV-09: sidebar for stacked markers; click the doubly-marked text.
	await cards( page, 'OV-09 reloaded' );
	const nested = editor.canvas.locator( 'mark.wp-suggestion-add mark.wp-suggestion-add' ).first();
	const box = await nested.boundingBox();
	await page.mouse.click( box!.x + box!.width / 2, box!.y + box!.height / 2 );
	await page.waitForTimeout( 1000 );
	log( 'OV-09 after clicking nested text: active threads', await page.locator( '[id^="note-thread-"]' ).evaluateAll( ( els ) => els.map( ( el ) => ( { id: el.id, cls: el.className.replace( /editor-collab-sidebar-panel__/g, '' ), expanded: el.getAttribute( 'aria-expanded' ), selected: el.getAttribute( 'aria-selected' ), hasReply: !! el.querySelector( 'textarea, [role="textbox"]' ) } ) ) ) );
	log( 'OV-09 floating', await page.locator( '.editor-collab-sidebar-panel__thread.is-floating, [class*="floating"]' ).count() );
	await shot( page, 'OV-09-sidebar-stacked-markers' );
	const outer = editor.canvas.locator( 'mark.wp-suggestion-add' ).first();
	log( 'OV-09 marker a11y', await editor.canvas.locator( 'mark[data-suggestion-id]' ).evaluateAll( ( els ) => els.slice( 0, 6 ).map( ( el ) => ( { id: el.getAttribute( 'data-suggestion-id' ), title: el.getAttribute( 'title' ), aria: el.getAttribute( 'aria-label' ) || el.getAttribute( 'aria-describedby' ) || el.getAttribute( 'aria-details' ), role: el.getAttribute( 'role' ), before: getComputedStyle( el, '::before' ).content.slice( 0, 60 ), after: getComputedStyle( el, '::after' ).content.slice( 0, 60 ) } ) ) ) );

	log( 'console', err );
	await ed.context.close();
} );

test.skip( 'OV-07 admin then editor', async ( { admin, editor, page, requestUtils, browser } ) => {
	const id = await newPost( requestUtils, 'OV-07' );
	log( 'POST', id );
	await adminOpen( { admin, editor, page }, id );
	await gesture( page, 'OV-07 admin add', 'brown', 'start', () => page.keyboard.type( 'ADMIN WORDS ', { delay: 20 } ) );
	await gesture( page, 'OV-07 admin del', 'lazy dog', undefined, () => page.keyboard.press( 'Backspace' ) );
	log( 'admin save', await savePost( page ) );
	await page.goto( '/wp-admin/' );
	const ed = await session( browser, USERS.editor );
	const err = collectConsole( ed.page );
	await ed.open( id );
	await gesture( ed.page, 'OV-07 editor types inside admin add', 'WORDS', 'start', () => ed.page.keyboard.type( 'ED ', { delay: 20 } ) );
	await gesture( ed.page, 'OV-07 editor italic across add edge', 'WORDS brown', undefined, () => ed.page.keyboard.press( 'ControlOrMeta+i' ) );
	await gesture( ed.page, 'OV-07 editor deletes over admin del', 'the lazy', undefined, () => ed.page.keyboard.press( 'Backspace' ) );
	await gesture( ed.page, 'OV-07 editor types inside admin del', 'dog', 'start', () => ed.page.keyboard.type( 'Z', { delay: 20 } ) );
	await report( ed.page, requestUtils, id, 'OV-07' );
	await cards( ed.page, 'OV-07' );
	await shot( ed.page, 'OV-07-editor-over-admin' );
	// own Enter inside own nested addition, and inside admin's
	await gesture( ed.page, 'OV-07 editor Enter inside admin del', 'dog', 'start', () => ed.page.keyboard.press( 'Enter' ) );
	log( 'OV-13 Enter inside other del', { blocks: ( await blocksOf( ed.page ) ).length, snack: await snackbars( ed.page ), spoken: await spoken( ed.page ) } );
	log( 'ed save', await savePost( ed.page ) );
	await ed.page.reload();
	await canvasOf( ed.page ).locator( '.is-root-container' ).first().waitFor();
	await ed.page.waitForTimeout( 1500 );
	log( 'OV-07 after reload', compact( await markersIn( ed.page ) ) );
	log( 'console', err );
	await ed.context.close();
} );
