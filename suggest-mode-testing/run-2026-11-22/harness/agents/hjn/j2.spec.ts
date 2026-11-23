import { test } from '@wordpress/e2e-test-utils-playwright';
import { seedPost, openPost, switchIntent, getMarkers, getBlocks, getNotes, openNotesSidebar, shot, collectConsole } from '../../helpers';
import { allKinds, summaries, treatments, sugMeta, para, step } from './kit';

const dirty = ( page: any ) => page.evaluate( () => ( window as any ).wp.data.select( 'core/editor' ).isEditedPostDirty() );
const notices = ( page: any ) => page.evaluate( () => ( window as any ).wp.data.select( 'core/notices' ).getNotices().map( ( n: any ) => `${ n.type }/${ n.status }: ${ n.content }` ) );
const blockLine = async ( page: any ) => JSON.stringify( ( await getBlocks( page ) ).map( ( b: any ) => b.name.replace( 'core/', '' ) + ( b.metadata?.suggestion ? ':' + b.metadata.suggestion.type : '' ) + ( b.metadata?.noteId ? ':n' + b.metadata.noteId : '' ) + ( b.content !== undefined ? '=' + b.content.slice( 0, 150 ) : '' ) ) );
const noteLine = async ( requestUtils: any, postId: number ) => JSON.stringify( ( await getNotes( requestUtils, postId ) ).map( ( n: any ) => `${ n.id }:${ n.status }:${ n.meta?._wp_suggestion_status }` ) );

test( 'PS-03b review after reload', async ( { admin, editor, page, pageUtils, requestUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'hjn PS-03b' } );
	await openPost( admin, editor, postId );
	await allKinds( page, editor, pageUtils, [ 'add', 'move', 'remove' ] );
	await editor.saveDraft();
	await page.reload();
	await editor.canvas.locator( '.is-root-container' ).waitFor();
	const sidebar = await openNotesSidebar( page );
	await page.waitForTimeout( 1500 );
	const addId = ( await getMarkers( editor ) ).find( ( m: any ) => m.type === 'add' )?.id;
	const moveId = ( await getBlocks( page ) ).find( ( b: any ) => b.metadata?.suggestion?.type === 'pending-move' )?.metadata.suggestion.commentId;
	console.log( 'ids', addId, moveId, 'blocks', await blockLine( page ) );
	await sidebar.locator( `#note-thread-${ addId }` ).getByRole( 'button', { name: 'Accept suggestion' } ).click();
	await page.waitForTimeout( 800 );
	await sidebar.locator( `#note-thread-${ moveId }` ).getByRole( 'button', { name: 'Reject suggestion' } ).click();
	await page.waitForTimeout( 800 );
	console.log( 'snack', JSON.stringify( await page.locator( '.components-snackbar-list' ).allInnerTexts() ) );
	console.log( 'after decide blocks', await blockLine( page ) );
	console.log( 'markers', JSON.stringify( await getMarkers( editor ) ), 'treat', JSON.stringify( ( await treatments( editor ) ).map( ( t: any ) => t.cls ) ) );
	console.log( 'notes pre-save', await noteLine( requestUtils, postId ) );
	await editor.saveDraft();
	await page.waitForTimeout( 800 );
	console.log( 'notes post-save', await noteLine( requestUtils, postId ) );
	await shot( page, 'PS-03-review-after-reload' );
} );

test( 'PS-09a autosave draft', async ( { admin, editor, page, requestUtils } ) => {
	const errors = collectConsole( page );
	const postId = await seedPost( requestUtils, { title: 'hjn PS-09a draft' } );
	await openPost( admin, editor, postId );
	await switchIntent( page, 'Suggesting' );
	await step( page, 'add', async () => {
		await para( editor, 'quick brown fox' ).click();
		await page.keyboard.press( 'End' );
		await page.keyboard.type( ' AUTOSAVED', { delay: 20 } );
	} );
	console.log( 'before autosave: markers', JSON.stringify( await getMarkers( editor ) ), 'notes', await noteLine( requestUtils, postId ), 'dirty', await dirty( page ) );
	const auto = page.waitForResponse( ( r ) => /autosaves|\/posts\/\d+/.test( r.url() ) && r.request().method() !== 'GET', { timeout: 30000 } ).then( ( r ) => `${ r.request().method() } ${ r.url().slice( 0, 120 ) } ${ r.status() }` ).catch( ( e ) => 'NO AUTOSAVE RESPONSE ' + e );
	await page.evaluate( () => ( window as any ).wp.data.dispatch( 'core/editor' ).autosave() );
	console.log( 'autosave response', await auto );
	await page.waitForTimeout( 1000 );
	console.log( 'after autosave: markers', JSON.stringify( await getMarkers( editor ) ), 'notes', await noteLine( requestUtils, postId ), 'dirty', await dirty( page ), 'notices', JSON.stringify( await notices( page ) ) );
	let dialogs = 0;
	page.on( 'dialog', async ( d ) => { dialogs++; console.log( 'DIALOG', d.type() ); await d.accept(); } );
	await page.reload();
	await editor.canvas.locator( '.is-root-container' ).waitFor();
	await page.waitForTimeout( 2000 );
	console.log( 'after reload: dialogs', dialogs, 'markers', JSON.stringify( await getMarkers( editor ) ), 'notes', await noteLine( requestUtils, postId ), 'dirty', await dirty( page ) );
	console.log( 'notices', JSON.stringify( await notices( page ) ) );
	console.log( 'summaries', JSON.stringify( await summaries( page ) ) );
	console.log( 'block1', ( await getBlocks( page ) )[ 1 ].content );
	console.log( 'ERRORS', JSON.stringify( errors ) );
	await shot( page, 'PS-09-autosave-draft-reload' );
} );

test( 'PS-09b autosave published', async ( { admin, editor, page, requestUtils } ) => {
	const errors = collectConsole( page );
	const postId = await seedPost( requestUtils, { title: 'hjn PS-09b published', status: 'publish' } );
	await openPost( admin, editor, postId );
	await switchIntent( page, 'Suggesting' );
	await step( page, 'add', async () => {
		await para( editor, 'quick brown fox' ).click();
		await page.keyboard.press( 'End' );
		await page.keyboard.type( ' AUTOSAVED', { delay: 20 } );
	} );
	console.log( 'before autosave: markers', JSON.stringify( await getMarkers( editor ) ), 'notes', await noteLine( requestUtils, postId ), 'dirty', await dirty( page ) );
	const auto = page.waitForResponse( ( r ) => /autosaves/.test( r.url() ) && r.request().method() === 'POST', { timeout: 30000 } ).then( async ( r ) => `${ r.status() } ${ ( await r.text() ).slice( 0, 700 ) }` ).catch( ( e ) => 'NO AUTOSAVE RESPONSE ' + e );
	await page.evaluate( () => ( window as any ).wp.data.dispatch( 'core/editor' ).autosave() );
	console.log( 'autosave response', await auto );
	await page.waitForTimeout( 1000 );
	console.log( 'after autosave: notes', await noteLine( requestUtils, postId ), 'dirty', await dirty( page ) );
	let dialogs = 0;
	page.on( 'dialog', async ( d ) => { dialogs++; console.log( 'DIALOG', d.type() ); await d.accept(); } );
	await page.reload();
	await editor.canvas.locator( '.is-root-container' ).waitFor();
	await page.waitForTimeout( 2500 );
	console.log( 'after reload: dialogs', dialogs, 'markers', JSON.stringify( await getMarkers( editor ) ), 'notes', await noteLine( requestUtils, postId ), 'dirty', await dirty( page ) );
	console.log( 'notices', JSON.stringify( await notices( page ) ) );
	console.log( 'summaries', JSON.stringify( await summaries( page ) ) );
	console.log( 'block1', ( await getBlocks( page ) )[ 1 ].content, JSON.stringify( ( await getBlocks( page ) )[ 1 ].metadata ) );
	await shot( page, 'PS-09-autosave-published-reload' );
	// follow the autosave banner if there is one
	const link = page.getByRole( 'link', { name: /View the autosave/ } ).or( page.getByRole( 'button', { name: /View the autosave|Restore the backup/ } ) );
	console.log( 'autosave link count', await link.count() );
	if ( await link.count() ) {
		await link.first().click();
		await page.waitForTimeout( 3000 );
		console.log( 'after following banner url', page.url() );
		await shot( page, 'PS-09-autosave-banner-followed' );
		const restore = page.getByRole( 'button', { name: 'Restore' } );
		console.log( 'restore buttons', await restore.count() );
		if ( await restore.count() ) {
			await restore.first().click();
			await page.waitForTimeout( 2500 );
			console.log( 'after restore: markers', JSON.stringify( await getMarkers( editor ) ), 'notes', await noteLine( requestUtils, postId ), 'notices', JSON.stringify( await notices( page ) ) );
			console.log( 'summaries', JSON.stringify( await summaries( page ) ) );
			console.log( 'block1', ( await getBlocks( page ) )[ 1 ].content, JSON.stringify( ( await getBlocks( page ) )[ 1 ].metadata ) );
			await shot( page, 'PS-09-autosave-restored' );
		}
	}
	console.log( 'ERRORS', JSON.stringify( errors ) );
} );

test( 'PS-10 revisions', async ( { admin, editor, page, pageUtils, requestUtils } ) => {
	test.setTimeout( 240_000 );
	const errors = collectConsole( page );
	const postId = await seedPost( requestUtils, { title: 'hjn PS-10 revisions' } );
	await openPost( admin, editor, postId );
	// rev: plain edit
	await para( editor, 'A second paragraph' ).click();
	await page.keyboard.press( 'End' );
	await page.keyboard.type( ' PLAIN-EDIT-ONE' );
	await editor.saveDraft();
	// rev: suggestions
	await allKinds( page, editor, pageUtils, [ 'add', 'del', 'insert', 'move' ] );
	await editor.saveDraft();
	console.log( 'with suggestions saved: notes', await noteLine( requestUtils, postId ) );
	// rev: another plain edit in Editing
	await switchIntent( page, 'Editing' );
	await para( editor, 'Fourth paragraph' ).click();
	await page.keyboard.press( 'End' );
	await page.keyboard.type( ' PLAIN-EDIT-TWO' );
	await editor.saveDraft();
	const revs: any = await requestUtils.rest( { path: `/wp/v2/posts/${ postId }/revisions`, params: { context: 'edit', per_page: 20 } } );
	console.log( 'REVISIONS', JSON.stringify( revs.map( ( r: any ) => ( { id: r.id, marks: ( r.content.raw.match( /<mark/g ) || [] ).length, placeholders: ( r.content.raw.match( /suggestion-placeholder/g ) || [] ).length, sug: ( r.content.raw.match( /"suggestion":/g ) || [] ).length, added: r.content.raw.includes( 'ADDEDTEXT' ), inserted: r.content.raw.includes( 'INSERTED BLOCK' ), one: r.content.raw.includes( 'PLAIN-EDIT-ONE' ), two: r.content.raw.includes( 'PLAIN-EDIT-TWO' ) } ) ) ) );
	await page.reload();
	await editor.canvas.locator( '.is-root-container' ).waitFor();
	await editor.openDocumentSettingsSidebar();
	const settings = page.getByRole( 'region', { name: 'Editor settings' } );
	await settings.getByRole( 'tab', { name: 'Post' } ).click();
	const revBtn = settings.getByRole( 'button', { name: /Open revisions screen/ } );
	console.log( 'REV BUTTON', await revBtn.getAttribute( 'aria-label' ) );
	await revBtn.click();
	const restore = page.getByRole( 'button', { name: 'Restore' } );
	await restore.waitFor();
	await page.waitForTimeout( 1500 );
	const canvasText = async () => ( await editor.canvas.locator( 'body' ).innerText() ).replace( /\n+/g, ' | ' ).slice( 0, 700 );
	console.log( 'REVISIONS SCREEN latest: text', await canvasText() );
	console.log( '  markers in revision view', JSON.stringify( await getMarkers( editor ) ), 'treat', JSON.stringify( ( await treatments( editor ) ).map( ( t: any ) => t.cls ) ) );
	await shot( page, 'PS-10-revisions-latest' );
	const slider = page.getByRole( 'slider', { name: 'Revision' } );
	await slider.focus();
	console.log( 'slider', await slider.getAttribute( 'aria-valuenow' ), await slider.getAttribute( 'aria-valuemin' ), await slider.getAttribute( 'aria-valuemax' ) );
	await page.keyboard.press( 'ArrowLeft' );
	await page.waitForTimeout( 1500 );
	console.log( 'REVISIONS SCREEN -1 (with suggestions): text', await canvasText() );
	console.log( '  markers', JSON.stringify( await getMarkers( editor ) ), 'treat', JSON.stringify( ( await treatments( editor ) ).map( ( t: any ) => t.cls ) ) );
	await shot( page, 'PS-10-revisions-with-suggestions' );
	await page.keyboard.press( 'ArrowLeft' );
	await page.waitForTimeout( 1500 );
	console.log( 'REVISIONS SCREEN -2 (plain edit one): text', await canvasText(), 'slider', await slider.getAttribute( 'aria-valuenow' ) );
	console.log( '  markers', JSON.stringify( await getMarkers( editor ) ) );
	await shot( page, 'PS-10-revisions-pre-suggestion' );
	await restore.click();
	await page.waitForTimeout( 3000 );
	console.log( 'AFTER RESTORE notices', JSON.stringify( await notices( page ) ) );
	console.log( '  blocks', await blockLine( page ) );
	console.log( '  markers', JSON.stringify( await getMarkers( editor ) ), 'treat', JSON.stringify( ( await treatments( editor ) ).map( ( t: any ) => t.cls ) ) );
	console.log( '  notes', await noteLine( requestUtils, postId ), 'dirty', await dirty( page ) );
	const sidebar = await openNotesSidebar( page );
	await page.waitForTimeout( 1500 );
	console.log( '  sidebar', JSON.stringify( await sidebar.innerText() ).slice( 0, 900 ) );
	await shot( page, 'PS-10-after-restore' );
	await page.reload();
	await editor.canvas.locator( '.is-root-container' ).waitFor();
	await page.waitForTimeout( 2000 );
	console.log( 'AFTER RESTORE+RELOAD blocks', await blockLine( page ) );
	console.log( '  markers', JSON.stringify( await getMarkers( editor ) ), 'notes', await noteLine( requestUtils, postId ) );
	const sb2 = await openNotesSidebar( page );
	await page.waitForTimeout( 1500 );
	console.log( '  sidebar', JSON.stringify( await sb2.innerText() ).slice( 0, 900 ) );
	await shot( page, 'PS-10-after-restore-reload' );
	console.log( 'ERRORS', JSON.stringify( errors ) );
} );

test( 'PS-12 copy content out', async ( { admin, editor, page, pageUtils, requestUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'hjn PS-12 source' } );
	await openPost( admin, editor, postId );
	await allKinds( page, editor, pageUtils );
	await editor.saveDraft();
	console.log( 'SOURCE blocks', await blockLine( page ) );
	await para( editor, 'quick brown fox' ).click();
	await pageUtils.pressKeys( 'primary+a' );
	await pageUtils.pressKeys( 'primary+a' );
	console.log( 'selected count', await page.evaluate( () => ( window as any ).wp.data.select( 'core/block-editor' ).getSelectedBlockClientIds().length ) );
	await pageUtils.pressKeys( 'primary+c' );
	await shot( page, 'PS-12-source-selected' );
	await admin.createNewPost( { title: 'hjn PS-12 paste target' } );
	const optBtn = page.getByRole( 'region', { name: 'Editor top bar' } ).getByRole( 'button', { name: 'Options' } );
	await optBtn.click();
	console.log( 'TARGET intent', JSON.stringify( await page.getByRole( 'menuitemradio', { name: /^(Editing|Suggesting)/ } ).evaluateAll( ( els ) => els.map( ( e ) => ( e as HTMLElement ).innerText.split( '\n' )[ 0 ] + '=' + e.getAttribute( 'aria-checked' ) ) ) ) );
	await page.keyboard.press( 'Escape' );
	await editor.canvas.locator( 'role=document[name="Add default block"i]' ).click();
	await pageUtils.pressKeys( 'primary+v' );
	await page.waitForTimeout( 1500 );
	const content = await editor.getEditedPostContent();
	console.log( 'PASTED CONTENT', content );
	console.log( 'PASTED markers', JSON.stringify( await getMarkers( editor ) ), 'treat', JSON.stringify( ( await treatments( editor ) ).map( ( t: any ) => t.cls ) ) );
	console.log( 'PASTED counts', JSON.stringify( { mark: ( content.match( /<mark/g ) || [] ).length, wpSug: ( content.match( /wp-suggestion/g ) || [] ).length, dataSug: ( content.match( /data-suggestion/g ) || [] ).length, noteId: ( content.match( /noteId/g ) || [] ).length, sugMeta: ( content.match( /"suggestion"/g ) || [] ).length, added: content.includes( 'ADDEDTEXT' ), inserted: content.includes( 'INSERTED BLOCK' ), deleted: content.includes( 'replacements.' ), strong: /<strong>post\.<\/strong>/.test( content ), h: ( content.match( /<h\d/ ) || [] )[ 0 ], image: content.includes( 'MtBlanc1' ) } ) );
	const newId = await page.evaluate( () => ( window as any ).wp.data.select( 'core/editor' ).getCurrentPostId() );
	console.log( 'TARGET post', newId, 'notes', await noteLine( requestUtils, newId ) );
	await shot( page, 'PS-12-copy-content-out' );
	await editor.saveDraft();
} );

test( 'NS-06c deleted suggestion note leaves marker', async ( { admin, editor, page, requestUtils, browser } ) => {
	const postId = await seedPost( requestUtils, { title: 'hjn NS-06c' } );
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
	await page.getByRole( 'menuitem', { name: 'Delete', exact: true } ).last().click();
	await page.getByRole( 'dialog' ).getByRole( 'button', { name: /Delete/ } ).click();
	await page.waitForTimeout( 4000 );
	console.log( 'after delete (4s): markers', JSON.stringify( await getMarkers( editor ) ), 'threads', await sidebar.locator( '.editor-collab-sidebar-panel__thread' ).count() );
	await editor.saveDraft();
	await page.reload();
	await editor.canvas.locator( '.is-root-container' ).waitFor();
	await page.waitForTimeout( 2000 );
	console.log( 'after save+reload: markers', JSON.stringify( await getMarkers( editor ) ), 'blocks', await blockLine( page ), 'notes', await noteLine( requestUtils, postId ) );
	const sb = await openNotesSidebar( page );
	await page.waitForTimeout( 1000 );
	console.log( 'sidebar', JSON.stringify( await sb.innerText() ).slice( 0, 400 ), 'notices', JSON.stringify( await notices( page ) ) );
	await shot( page, 'NS-06-orphan-marker-after-note-delete' );
	await editor.publishPost();
	const anon = await browser.newContext( { storageState: { cookies: [], origins: [] } } );
	const fp = await anon.newPage();
	await fp.goto( `http://localhost:8947/?p=${ postId }` );
	console.log( 'FRONT first para', ( ( await fp.content() ).match( /<p[^>]*>The quick[\s\S]*?<\/p>/ ) || [ null ] )[ 0 ] );
	await anon.close();
} );
