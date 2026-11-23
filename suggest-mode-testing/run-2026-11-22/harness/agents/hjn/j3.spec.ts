import { test } from '@wordpress/e2e-test-utils-playwright';
import { seedPost, openPost, switchIntent, getMarkers, getBlocks, getNotes, shot, collectConsole } from '../../helpers';
import { allKinds, treatments, para, step } from './kit';

const dirty = ( page: any ) => page.evaluate( () => ( window as any ).wp.data.select( 'core/editor' ).isEditedPostDirty() );
const notices = ( page: any ) => page.evaluate( () => ( window as any ).wp.data.select( 'core/notices' ).getNotices().map( ( n: any ) => `${ n.type }/${ n.status }: ${ n.content }` ) );
const blockLine = async ( page: any ) => JSON.stringify( ( await getBlocks( page ) ).map( ( b: any ) => b.name.replace( 'core/', '' ) + ( b.metadata?.suggestion ? ':' + JSON.stringify( b.metadata.suggestion ) : '' ) + ( b.metadata?.noteId ? ':n' + b.metadata.noteId : '' ) + ( b.content !== undefined ? '=' + b.content.slice( 0, 170 ) : '' ) ) );
const noteLine = async ( requestUtils: any, postId: number ) => {
	const out: string[] = [];
	for ( const status of [ 'hold', 'approve', 'trash', 'spam' ] ) {
		const notes: any = await requestUtils.rest( { path: '/wp/v2/comments', params: { post: postId, type: 'note', status, per_page: 100, context: 'edit' } } ).catch( ( e: any ) => [ { id: 'ERR ' + String( e?.message || e ).slice( 0, 60 ) } ] );
		notes.forEach( ( n: any ) => out.push( `${ n.id }:${ status }:${ n.meta?._wp_suggestion_status }` ) );
	}
	return JSON.stringify( out );
};
const sidebarText = async ( page: any ) => {
	const toggle = page.getByRole( 'region', { name: 'Editor top bar' } ).getByRole( 'button', { name: 'All notes', exact: true } );
	if ( ! ( await toggle.count() ) ) return 'NO "All notes" BUTTON';
	if ( ( await toggle.getAttribute( 'aria-expanded' ) ) === 'false' ) await toggle.click();
	await page.waitForTimeout( 1200 );
	return JSON.stringify( await page.getByRole( 'region', { name: 'Editor settings' } ).innerText() ).slice( 0, 900 );
};

test( 'PS-10 revisions', async ( { admin, editor, page, pageUtils, requestUtils } ) => {
	test.setTimeout( 240_000 );
	const errors = collectConsole( page );
	const postId = await seedPost( requestUtils, { title: 'hjn PS-10 revisions' } );
	await openPost( admin, editor, postId );
	await para( editor, 'A second paragraph' ).click();
	await page.keyboard.press( 'End' );
	await page.keyboard.type( ' PLAIN-EDIT-ONE' );
	await editor.saveDraft();
	await allKinds( page, editor, pageUtils, [ 'add', 'del', 'insert', 'move' ] );
	await editor.saveDraft();
	console.log( 'POST', postId, 'with suggestions saved: notes', await noteLine( requestUtils, postId ) );
	await switchIntent( page, 'Editing' );
	await page.evaluate( () => ( window as any ).wp.data.dispatch( 'core/block-editor' ).clearSelectedBlock() );
	await para( editor, 'Fourth paragraph' ).click();
	await page.keyboard.press( 'End' );
	await page.keyboard.type( ' PLAIN-EDIT-TWO' );
	await editor.saveDraft();
	const revs: any = await requestUtils.rest( { path: `/wp/v2/posts/${ postId }/revisions`, params: { context: 'edit', per_page: 20 } } );
	console.log( 'REVISIONS', JSON.stringify( revs.map( ( r: any ) => ( { id: r.id, marks: ( r.content.raw.match( /<mark/g ) || [] ).length, placeholders: ( r.content.raw.match( /suggestion-placeholder/g ) || [] ).length, sug: ( r.content.raw.match( /"suggestion":/g ) || [] ).length, added: r.content.raw.includes( 'ADDEDTEXT' ), inserted: r.content.raw.includes( 'INSERTED BLOCK' ), one: r.content.raw.includes( 'PLAIN-EDIT-ONE' ), two: r.content.raw.includes( 'PLAIN-EDIT-TWO' ) } ) ) ) );
	await page.reload();
	await editor.canvas.locator( '.is-root-container' ).waitFor();
	const openRevisions = async () => {
		await editor.openDocumentSettingsSidebar();
		const settings = page.getByRole( 'region', { name: 'Editor settings' } );
		await settings.getByRole( 'tab', { name: 'Post' } ).click();
		const revBtn = settings.getByRole( 'button', { name: /Open revisions screen/ } );
		console.log( 'REV BUTTON', await revBtn.getAttribute( 'aria-label' ) );
		await revBtn.click();
		await page.getByRole( 'button', { name: 'Restore' } ).waitFor();
		await page.waitForTimeout( 1500 );
	};
	const canvasText = async () => ( await editor.canvas.locator( 'body' ).innerText() ).replace( /\n+/g, ' | ' ).slice( 0, 700 );
	const view = async ( label: string ) => {
		console.log( `REV VIEW ${ label }: text`, await canvasText() );
		console.log( '   markers', JSON.stringify( ( await getMarkers( editor ) ).map( ( m: any ) => `${ m.tag }.${ m.className }#${ m.id }:${ m.text }` ) ), 'treat', JSON.stringify( ( await treatments( editor ) ).map( ( t: any ) => t.cls ) ) );
	};
	await openRevisions();
	await view( 'latest' );
	await shot( page, 'PS-10-revisions-latest' );
	const slider = page.getByRole( 'slider', { name: 'Revision' } );
	await slider.focus();
	await page.keyboard.press( 'ArrowLeft' );
	await page.waitForTimeout( 1500 );
	await view( 'one back (suggestions save)' );
	await shot( page, 'PS-10-revisions-with-suggestions' );
	await page.keyboard.press( 'ArrowLeft' );
	await page.waitForTimeout( 1500 );
	await view( 'two back (pre-suggestion)' );
	await shot( page, 'PS-10-revisions-pre-suggestion' );
	await page.getByRole( 'button', { name: 'Restore' } ).click();
	await page.waitForTimeout( 3000 );
	console.log( 'AFTER RESTORE(pre-suggestion) notices', JSON.stringify( await notices( page ) ) );
	console.log( '  blocks', await blockLine( page ) );
	console.log( '  markers', JSON.stringify( await getMarkers( editor ) ), 'treat', JSON.stringify( ( await treatments( editor ) ).map( ( t: any ) => t.cls ) ) );
	console.log( '  notes(all statuses)', await noteLine( requestUtils, postId ), 'dirty', await dirty( page ) );
	console.log( '  sidebar', await sidebarText( page ) );
	await shot( page, 'PS-10-after-restore' );
	// Now restore the revision that had the suggestions in it.
	await page.reload();
	await editor.canvas.locator( '.is-root-container' ).waitFor();
	await openRevisions();
	await slider.focus();
	for ( let i = 0; i < 6; i++ ) {
		const t = await canvasText();
		const hasGhost = t.includes( 'Moved from here' );
		const hasTwo = t.includes( 'PLAIN-EDIT-TWO' );
		console.log( 'scan', i, 'ghost', hasGhost, 'two', hasTwo );
		if ( hasGhost && ! hasTwo ) break;
		await page.keyboard.press( 'ArrowLeft' );
		await page.waitForTimeout( 1200 );
	}
	await view( 'chosen for second restore' );
	await page.getByRole( 'button', { name: 'Restore' } ).click();
	await page.waitForTimeout( 3000 );
	console.log( 'AFTER RESTORE(with suggestions) notices', JSON.stringify( await notices( page ) ) );
	console.log( '  blocks', await blockLine( page ) );
	console.log( '  markers', JSON.stringify( await getMarkers( editor ) ), 'treat', JSON.stringify( ( await treatments( editor ) ).map( ( t: any ) => t.cls ) ) );
	console.log( '  notes(all statuses)', await noteLine( requestUtils, postId ), 'dirty', await dirty( page ) );
	console.log( '  sidebar', await sidebarText( page ) );
	await shot( page, 'PS-10-after-restore-suggestion-revision' );
	await page.reload();
	await editor.canvas.locator( '.is-root-container' ).waitFor();
	await page.waitForTimeout( 2000 );
	console.log( 'AFTER 2nd RESTORE + RELOAD blocks', await blockLine( page ) );
	console.log( '  markers', JSON.stringify( await getMarkers( editor ) ), 'treat', JSON.stringify( ( await treatments( editor ) ).map( ( t: any ) => t.cls ) ), 'notes', await noteLine( requestUtils, postId ) );
	console.log( '  sidebar', await sidebarText( page ) );
	await shot( page, 'PS-10-after-restore-suggestion-revision-reload' );
	console.log( 'ERRORS', JSON.stringify( errors ) );
} );

for ( const intent of [ 'Suggesting', 'Editing' ] ) {
	test( `NS-06c delete suggestion note in ${ intent }`, async ( { admin, editor, page, requestUtils, browser } ) => {
		const postId = await seedPost( requestUtils, { title: `hjn NS-06c ${ intent }` } );
		await openPost( admin, editor, postId );
		await switchIntent( page, 'Suggesting' );
		await step( page, 'add', async () => {
			await para( editor, 'quick brown fox' ).click();
			await page.keyboard.press( 'End' );
			await page.keyboard.type( ' DELNOTE', { delay: 20 } );
		} );
		await editor.saveDraft();
		if ( intent === 'Editing' ) await switchIntent( page, 'Editing' );
		const toggle = page.getByRole( 'region', { name: 'Editor top bar' } ).getByRole( 'button', { name: 'All notes', exact: true } );
		await toggle.click();
		const sidebar = page.getByRole( 'region', { name: 'Editor settings' } );
		const thread = sidebar.locator( '.editor-collab-sidebar-panel__thread' ).first();
		await thread.locator( '.editor-collab-sidebar-panel__suggestion-summary' ).click();
		await thread.getByRole( 'button', { name: 'Actions' } ).click();
		await page.getByRole( 'menuitem', { name: 'Delete', exact: true } ).last().click();
		await page.getByRole( 'dialog' ).getByRole( 'button', { name: /Delete/ } ).click();
		await page.waitForTimeout( 4000 );
		console.log( intent, 'after delete (4s): markers', JSON.stringify( await getMarkers( editor ) ), 'treat', JSON.stringify( ( await treatments( editor ) ).map( ( t: any ) => t.tag + '.' + t.cls ) ) );
		console.log( '  blocks', await blockLine( page ) );
		console.log( '  notes', await noteLine( requestUtils, postId ), 'sidebar', await sidebarText( page ), 'dirty', await dirty( page ) );
		await shot( page, `NS-06-orphan-marker-after-note-delete-${ intent.toLowerCase() }` );
		await editor.saveDraft();
		await page.reload();
		await editor.canvas.locator( '.is-root-container' ).waitFor();
		await page.waitForTimeout( 2000 );
		console.log( intent, 'after save+reload: markers', JSON.stringify( await getMarkers( editor ) ), 'treat', JSON.stringify( ( await treatments( editor ) ).map( ( t: any ) => t.tag + '.' + t.cls ) ) );
		console.log( '  blocks', await blockLine( page ) );
		console.log( '  notes', await noteLine( requestUtils, postId ), 'sidebar', await sidebarText( page ), 'notices', JSON.stringify( await notices( page ) ) );
		await shot( page, `NS-06-after-note-delete-reload-${ intent.toLowerCase() }` );
	} );
}
