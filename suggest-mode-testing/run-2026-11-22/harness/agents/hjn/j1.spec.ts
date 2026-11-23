import { test } from '@wordpress/e2e-test-utils-playwright';
import { seedPost, openPost, switchIntent, getMarkers, getBlocks, getNotes, openNotesSidebar, shot, collectConsole } from '../../helpers';
import { allKinds, summaries, treatments, sugMeta, para, step } from './kit';

const dirty = ( page: any ) => page.evaluate( () => ( window as any ).wp.data.select( 'core/editor' ).isEditedPostDirty() );

export function frontReport( html: string ) {
	const count = ( re: RegExp ) => ( html.match( re ) || [] ).length;
	const idx = ( s: string ) => html.indexOf( s );
	return {
		length: html.length,
		hasADDEDTEXT: html.includes( 'ADDEDTEXT' ),
		hasINSERTED: html.includes( 'INSERTED BLOCK' ),
		hasDeletedOriginal: html.includes( 'replacements.' ),
		fourth: ( html.match( /<p[^>]*>Fourth paragraph[\s\S]*?<\/p>/ ) || [ null ] )[ 0 ],
		third: ( html.match( /<p[^>]*>Third paragraph[\s\S]*?<\/p>/ ) || [ null ] )[ 0 ],
		first: ( html.match( /<p[^>]*>The quick[\s\S]*?<\/p>/ ) || [ null ] )[ 0 ],
		heading: ( html.match( /<h\d[^>]*>Field notes[\s\S]*?<\/h\d>/ ) || [ null ] )[ 0 ],
		markTags: count( /<mark/g ),
		insDel: count( /<(ins|del)[\s>]/g ),
		dataSuggestion: count( /data-suggestion/g ),
		wpSuggestionClass: count( /wp-suggestion/g ),
		isSuggestionClass: count( /is-suggestion/g ),
		suggestionJson: count( /"suggestion"/g ),
		noteId: count( /noteId/g ),
		ghost: html.includes( 'Moved from here' ) || html.includes( 'move-ghost' ),
		order: { fourthPara: idx( 'Fourth paragraph' ), list: idx( 'First item' ), image: idx( 'MtBlanc1' ), thirdPara: idx( 'Third paragraph' ) },
	};
}

test( 'PS-01..08,11 pipeline', async ( { admin, editor, page, pageUtils, requestUtils, browser } ) => {
	test.setTimeout( 300_000 );
	const errors = collectConsole( page );
	const postId = await seedPost( requestUtils, { title: 'hjn PS pipeline' } );
	await openPost( admin, editor, postId );
	await allKinds( page, editor, pageUtils );
	const snap = async ( label: string ) => {
		const m = await getMarkers( editor );
		const t = await treatments( editor );
		console.log( `SNAP ${ label }: markers`, JSON.stringify( m.map( ( x: any ) => `${ x.type }#${ x.id }:${ x.text }` ) ) );
		console.log( `SNAP ${ label }: treatments`, JSON.stringify( t.map( ( x: any ) => `${ x.tag }.${ x.cls }` ) ) );
		console.log( `SNAP ${ label }: blocks`, JSON.stringify( ( await getBlocks( page ) ).map( ( b: any ) => b.name.replace( 'core/', '' ) + ( b.metadata?.suggestion ? ':' + b.metadata.suggestion.type : '' ) + ( b.name === 'core/heading' ? ':L' + b.attributes.level : '' ) ) ) );
		console.log( `SNAP ${ label }: summaries`, JSON.stringify( await summaries( page ) ) );
		console.log( `SNAP ${ label }: notes`, JSON.stringify( ( await getNotes( requestUtils, postId ) ).map( ( n: any ) => `${ n.id }:${ n.status }:${ n.meta?._wp_suggestion_status }` ) ) );
	};
	console.log( 'POST', postId );
	await snap( 'before save' );
	// PS-01
	const saveBtn = page.getByRole( 'region', { name: 'Editor top bar' } ).getByRole( 'button', { name: 'Save draft' } );
	console.log( 'PS-01 dirty before', await dirty( page ), 'save enabled', await saveBtn.isEnabled(), 'aria-disabled', await saveBtn.getAttribute( 'aria-disabled' ) );
	await shot( page, 'PS-01-save-with-pending' );
	await saveBtn.click();
	await page.getByRole( 'button', { name: 'Dismiss this notice' } ).filter( { hasText: 'Draft saved' } ).waitFor( { timeout: 20000 } ).catch( ( e: any ) => console.log( 'NO Draft saved notice', String( e ).slice( 0, 100 ) ) );
	console.log( 'PS-01 dirty after save', await dirty( page ), 'snack', JSON.stringify( await page.locator( '.components-snackbar-list' ).allInnerTexts() ) );
	await shot( page, 'PS-01-after-save' );
	const raw1 = ( await requestUtils.rest( { path: `/wp/v2/posts/${ postId }`, params: { context: 'edit' } } ) as any ).content.raw;
	console.log( 'PS-11 RAW1', raw1 );
	// PS-02
	let dialogs = 0;
	page.on( 'dialog', async ( d ) => { dialogs++; console.log( 'DIALOG', d.type(), d.message() ); await d.accept(); } );
	await page.goto( '/wp-admin/edit.php' );
	console.log( 'PS-02 navigated to', page.url(), 'dialogs fired', dialogs );
	await shot( page, 'PS-02-navigated-away' );
	// PS-03
	await openPost( admin, editor, postId );
	await page.waitForTimeout( 1500 );
	await snap( 'after reload' );
	await page.evaluate( () => ( window as any ).wp.data.dispatch( 'core/interface' ).disableComplementaryArea( 'core' ) );
	await page.waitForTimeout( 500 );
	await shot( page, 'PS-03-reload-round-trip', { fullPage: false } );
	await editor.canvas.locator( '.is-suggestion-move-ghost' ).first().scrollIntoViewIfNeeded().catch( () => console.log( 'NO GHOST to scroll to' ) );
	await shot( page, 'PS-03-reload-ghost' );
	console.log( 'PS-03 dirty after reload', await dirty( page ) );
	// PS-08 preview (draft)
	try {
		const preview = await editor.openPreviewPage();
		await preview.waitForLoadState( 'domcontentloaded' );
		console.log( 'PS-08 preview url', preview.url() );
		const html = await preview.locator( '.entry-content, .wp-block-post-content' ).first().innerHTML();
		console.log( 'PS-08 PREVIEW REPORT', JSON.stringify( frontReport( html ) ) );
		await preview.screenshot( { path: '/Users/adamsilverstein/repositories/worktrees/suggest-testing-docs-1122/suggest-mode-testing/run-2026-11-22/screenshots/PS-08-preview.png', fullPage: true } );
		await preview.close();
	} catch ( e ) {
		console.log( 'PS-08 preview error', String( e ).slice( 0, 400 ) );
	}
	// publish
	await editor.publishPost();
	console.log( 'PUBLISHED status', ( await requestUtils.rest( { path: `/wp/v2/posts/${ postId }` } ) as any ).status );
	const anon = await browser.newContext( { storageState: { cookies: [], origins: [] } } );
	const fp = await anon.newPage();
	const resp = await fp.goto( `http://localhost:8947/?p=${ postId }` );
	console.log( 'FRONT status', resp?.status(), fp.url(), 'logged-in?', await fp.locator( '#wpadminbar' ).count() );
	const fullHtml = await fp.content();
	const content = await fp.locator( '.entry-content, .wp-block-post-content' ).first().innerHTML();
	console.log( 'FRONT CONTENT HTML', content );
	console.log( 'FRONT REPORT (content)', JSON.stringify( frontReport( content ) ) );
	console.log( 'FRONT REPORT (whole page)', JSON.stringify( frontReport( fullHtml ) ) );
	await fp.screenshot( { path: '/Users/adamsilverstein/repositories/worktrees/suggest-testing-docs-1122/suggest-mode-testing/run-2026-11-22/screenshots/PS-04-07-front-end-strip.png', fullPage: true } );
	// feed + REST anon
	const anonRest = await fp.request.get( `http://localhost:8947/?rest_route=/wp/v2/posts/${ postId }` );
	const j = await anonRest.json();
	console.log( 'ANON REST status', anonRest.status(), 'REPORT', JSON.stringify( frontReport( j?.content?.rendered || '' ) ), 'raw exposed?', j?.content?.raw !== undefined );
	await anon.close();
	// PS-08 preview after publish with a published post
	try {
		await page.keyboard.press( 'Escape' );
		const closePanel = page.getByRole( 'button', { name: 'Close panel' } );
		if ( await closePanel.count() ) await closePanel.click();
		const preview = await editor.openPreviewPage();
		await preview.waitForLoadState( 'domcontentloaded' );
		const html = await preview.locator( '.entry-content, .wp-block-post-content' ).first().innerHTML();
		console.log( 'PS-08 PREVIEW(published) url', preview.url(), 'REPORT', JSON.stringify( frontReport( html ) ) );
		await preview.close();
	} catch ( e ) {
		console.log( 'PS-08 preview2 error', String( e ).slice( 0, 400 ) );
	}
	// PS-11 second cycle
	await page.reload();
	await editor.canvas.locator( '.is-root-container' ).waitFor();
	await page.waitForTimeout( 1500 );
	await snap( 'after publish + reload 2' );
	const raw2 = ( await requestUtils.rest( { path: `/wp/v2/posts/${ postId }`, params: { context: 'edit' } } ) as any ).content.raw;
	console.log( 'PS-11 RAW2 identical to RAW1?', raw1 === raw2 );
	if ( raw1 !== raw2 ) console.log( 'PS-11 RAW2', raw2 );
	const c = ( re: RegExp ) => ( raw2.match( re ) || [] ).length;
	console.log( 'PS-11 counts', JSON.stringify( { markOpen: c( /<mark/g ), markClose: c( /<\/mark>/g ), suggestionMeta: c( /"suggestion":\{/g ), doubleEnc: c( /&lt;mark|&amp;lt;/g ), noteId: c( /"noteId"/g ) } ) );
	console.log( 'ERRORS', JSON.stringify( errors ) );
	// PS-03 reviewable after reload: accept the add, reject the move
	const sidebar = await openNotesSidebar( page );
	const accept = sidebar.locator( '.editor-collab-sidebar-panel__thread' ).filter( { hasText: 'Add: ' } ).getByRole( 'button', { name: 'Accept suggestion' } );
	await accept.click();
	await page.waitForTimeout( 800 );
	const reject = sidebar.locator( '.editor-collab-sidebar-panel__thread' ).filter( { hasText: /(^|\n)Move block:/ } ).getByRole( 'button', { name: 'Reject suggestion' } );
	await reject.click();
	await page.waitForTimeout( 800 );
	console.log( 'PS-03 snack', JSON.stringify( await page.locator( '.components-snackbar-list' ).allInnerTexts() ) );
	await snap( 'after accept add + reject move' );
	await shot( page, 'PS-03-review-after-reload' );
} );
