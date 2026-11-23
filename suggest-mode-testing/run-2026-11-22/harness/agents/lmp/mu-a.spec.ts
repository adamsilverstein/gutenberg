import { test } from '@wordpress/e2e-test-utils-playwright';
import { seedPost, openPost, switchIntent, shot, USERS, collectConsole } from '../../helpers';
import { log, takeOver, openAs, markersIn, blocksOf, selectIn, focusBlock, withSave, savePost, snackbars, notesFull, sidebarCards } from './lib';

test( 'MU-01..05 attribution', async ( { admin, editor, page, requestUtils, browser } ) => {
	const postId = await seedPost( requestUtils, { title: 'lmp MU-01-05' } );
	log( 'POST', postId );
	// editor-user
	const ed = await openAs( browser, USERS.editor, postId );
	const edErr = collectConsole( ed.page );
	log( 'ED open', { status: ed.status, hasEditor: ed.hasEditor, title: await ed.page.title() } );
	await switchIntent( ed.page, 'Suggesting' );
	await focusBlock( ed.page, 1 );
	await selectIn( ed.page, 1, 'brown', 'start' );
	log( 'ED inline save', await withSave( ed.page, () => ed.page.keyboard.type( 'EDITORSAYS ', { delay: 20 } ) ) );
	// structural: Enter at end of paragraph 3 then type
	await focusBlock( ed.page, 3 );
	await selectIn( ed.page, 3, 'replacements.', 'end' );
	log( 'ED struct save', await withSave( ed.page, async () => {
		await ed.page.keyboard.press( 'Enter' );
		await ed.page.keyboard.type( 'Editor new block', { delay: 20 } );
	} ) );
	await ed.page.waitForTimeout( 1500 );
	log( 'ED markers', await markersIn( ed.page ) );
	log( 'ED blocks', ( await blocksOf( ed.page ) ).slice( 0, 6 ) );
	log( 'ED snack', await snackbars( ed.page ) );
	log( 'ED dirty', await ed.page.evaluate( () => ( window as any ).wp.data.select( 'core/editor' ).isEditedPostDirty() ) );
	log( 'ED cards', await sidebarCards( ed.page ) );
	await shot( ed.page, 'MU-01-second-user-suggests' );
	log( 'ED save', await savePost( ed.page ) );
	log( 'NOTES after ED', await notesFull( requestUtils, postId ) );
	log( 'ED console', edErr );

	// admin loads after editor saved (MU-05), then suggests (MU-02/03)
	const err = collectConsole( page );
	await openPost( admin, editor, postId );
	log( 'ADMIN lock dialog', await takeOver( page ) );
	log( 'MU-05 ADMIN markers on load', await markersIn( page ) );
	log( 'MU-05 ADMIN blocks', ( await blocksOf( page ) ).slice( 0, 6 ) );
	log( 'MU-05 ADMIN cards', await sidebarCards( page ) );
	await shot( page, 'MU-05-admin-sees-editor-suggestions' );
	await switchIntent( page, 'Suggesting' );
	await focusBlock( page, 2 );
	await selectIn( page, 2, 'second', 'start' );
	log( 'ADMIN inline save', await withSave( page, () => page.keyboard.type( 'ADMINSAYS ', { delay: 20 } ) ) );
	await focusBlock( page, 5 );
	await selectIn( page, 5, 'closes ' );
	log( 'ADMIN del save', await withSave( page, () => page.keyboard.press( 'Backspace' ) ) );
	const before = await markersIn( page );
	log( 'MU-03 markers both', before );
	log( 'MU-03 block treatments', await editor.canvas.locator( 'body' ).evaluate( ( body: HTMLElement ) =>
		Array.from( body.querySelectorAll( '.is-root-container > [data-block]' ) ).map( ( el ) => {
			const cs = getComputedStyle( el ); const b = getComputedStyle( el, '::before' ); const a = getComputedStyle( el, '::after' );
			return { cls: el.className.replace( /block-editor-\S+|wp-block\S*|rich-text|is-selected|has-child-selected/g, '' ).trim(), outline: cs.outlineColor, shadow: cs.boxShadow.slice( 0, 60 ), bl: cs.borderLeftColor, before: b.backgroundColor + '/' + b.borderLeftColor, after: a.backgroundColor, style: ( el as HTMLElement ).getAttribute( 'style' ) };
		} ) ) );
	log( 'MU-02 cards', await sidebarCards( page ) );
	log( 'MU-02 notes', await notesFull( requestUtils, postId ) );
	await shot( page, 'MU-03-per-author-tinting' );
	log( 'ADMIN save', await savePost( page ) );
	await page.reload();
	await editor.canvas.locator( '.is-root-container' ).first().waitFor();
	log( 'ADMIN lock after reload', await takeOver( page ) );
	await page.waitForTimeout( 1500 );
	const after = await markersIn( page );
	log( 'MU-04 markers after reload', after );
	log( 'MU-04 same', JSON.stringify( before.map( ( m: any ) => [ m.id, m.author, m.color ] ) ) === JSON.stringify( after.map( ( m: any ) => [ m.id, m.author, m.color ] ) ) );
	await sidebarCards( page );
	await shot( page, 'MU-04-tint-across-reload' );
	log( 'ADMIN console', err );
	await ed.context.close();
} );
