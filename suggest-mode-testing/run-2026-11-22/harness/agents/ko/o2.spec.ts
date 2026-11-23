import { test } from '@wordpress/e2e-test-utils-playwright';
import { seedPost, openPost, collectConsole, suggestionSaved, openNotesSidebar, getMarkers, getNotes, getBlocks } from '../../helpers';
import { snap, savePost, reload, rawContent, suggest, switchIntent, shot, P, flat, threads } from './lib';

const intent = ( page: any ) => page.evaluate( () => { const s = ( window as any ).wp.data.select( 'core/editor' ); try { return s.getEditorIntent ? s.getEditorIntent() : ( window as any ).wp.data.select( 'core/editor' ).getEditorSettings?.().intent ?? 'n/a'; } catch ( e ) { return 'err'; } } );
const optionsItems = async ( page: any ) => {
	await page.getByRole( 'region', { name: 'Editor top bar' } ).getByRole( 'button', { name: 'Options' } ).click();
	await page.waitForTimeout( 400 );
	const items = await page.locator( '[role="menuitemradio"], [role="menuitem"], [role="menuitemcheckbox"]' ).evaluateAll( ( els ) => els.map( ( e ) => `${ ( e.textContent || '' ).replace( /\s+/g, ' ' ).trim().slice( 0, 50 ) }${ e.getAttribute( 'aria-disabled' ) === 'true' || ( e as any ).disabled ? ' [disabled]' : '' }${ e.getAttribute( 'aria-checked' ) === 'true' ? ' [checked]' : '' }` ) );
	await page.keyboard.press( 'Escape' );
	return items;
};

test( 'EX-03 synced pattern', async ( { admin, editor, page, requestUtils } ) => {
	const errors = collectConsole( page );
	const pattern = await requestUtils.rest( { method: 'POST', path: '/wp/v2/blocks', data: { title: 'ko EX-03 synced pattern', status: 'publish', content: '<!-- wp:paragraph -->\n<p>Synced pattern text shared everywhere.</p>\n<!-- /wp:paragraph -->' } } );
	const postId = await seedPost( requestUtils, { title: 'ko EX-03', content: `<!-- wp:paragraph -->\n<p>Host paragraph before the pattern.</p>\n<!-- /wp:paragraph -->\n\n<!-- wp:block {"ref":${ pattern.id }} /-->` } );
	console.log( 'pattern id', pattern.id, 'post', postId );
	await openPost( admin, editor, postId );
	page.on( 'response', async ( r: any ) => { if ( /wp\/v2\/(comments|blocks)/.test( r.url() ) && r.request().method() !== 'GET' ) console.log( 'RESP', r.status(), r.request().method(), decodeURIComponent( r.url() ).slice( 0, 120 ), ( r.request().postData() || '' ).slice( 0, 300 ) ); } );
	await switchIntent( page, 'Suggesting' );
	const inner = editor.canvas.locator( '[data-type="core/block"] [data-type="core/paragraph"]' ).first();
	await inner.waitFor();
	console.log( 'inner contenteditable', await inner.getAttribute( 'contenteditable' ), 'text', await inner.innerText() );
	await inner.click( { force: true } );
	await page.keyboard.press( 'End' );
	await page.keyboard.type( ' INPATTERN', { delay: 25 } );
	await page.waitForTimeout( 3500 );
	const state = async ( label: string ) => {
		const s = await page.evaluate( ( ref: number ) => {
			const core = ( window as any ).wp.data.select( 'core' );
			const be = ( window as any ).wp.data.select( 'core/block-editor' );
			const rec = core.getEditedEntityRecord( 'postType', 'wp_block', ref );
			const sel = be.getSelectedBlockClientId();
			return {
				patternDirty: core.hasEditsForEntityRecord( 'postType', 'wp_block', ref ),
				patternContent: typeof rec?.content === 'function' ? rec.content( rec ) : rec?.content,
				selected: sel ? be.getBlockName( sel ) : null,
				editingMode: sel ? be.getBlockEditingMode( sel ) : null,
				postType: ( window as any ).wp.data.select( 'core/editor' ).getCurrentPostType(),
				currentPostId: ( window as any ).wp.data.select( 'core/editor' ).getCurrentPostId(),
				dirtyEntities: ( core.__experimentalGetDirtyEntityRecords?.() || [] ).map( ( d: any ) => d.name + ':' + d.key ),
			};
		}, pattern.id );
		console.log( label, JSON.stringify( s ) );
	};
	await state( 'AFTER typing in pattern (host post, Suggesting)' );
	console.log( 'MARKERS', JSON.stringify( await getMarkers( editor ) ) );
	console.log( 'BLOCKS', JSON.stringify( await flat( page ) ) );
	console.log( 'NOTES host', JSON.stringify( await getNotes( requestUtils, postId ) ) );
	console.log( 'NOTES pattern', JSON.stringify( await getNotes( requestUtils, pattern.id ).catch( ( e: any ) => 'ERR ' + e.message ) ) );
	console.log( 'TOOLBAR', JSON.stringify( await page.getByRole( 'toolbar', { name: 'Block tools' } ).getByRole( 'button' ).evaluateAll( ( els: any[] ) => els.map( ( e ) => e.getAttribute( 'aria-label' ) || e.textContent ) ).catch( () => [] ) ) );
	console.log( 'SNACK', JSON.stringify( await page.locator( '.components-snackbar' ).allInnerTexts() ) );
	await shot( page, 'EX-03-synced-pattern-in-host' );
	// "Edit original" path
	const editOriginal = page.getByRole( 'toolbar', { name: 'Block tools' } ).getByRole( 'button', { name: /Edit original/ } );
	await editor.canvas.locator( '[data-type="core/block"]' ).first().click( { force: true } );
	await page.waitForTimeout( 500 );
	console.log( 'Edit original button', await editOriginal.count() );
	if ( await editOriginal.count() ) {
		await editOriginal.click();
		await page.waitForTimeout( 2500 );
		console.log( 'URL', page.url(), 'INTENT in pattern editor', await intent( page ) );
		await state( 'IN pattern editor' );
		console.log( 'OPTIONS', JSON.stringify( await optionsItems( page ) ) );
		const p = editor.canvas.locator( '[data-type="core/paragraph"]' ).first();
		await p.click();
		await page.keyboard.press( 'End' );
		await page.keyboard.type( ' ORIGINAL', { delay: 25 } );
		await page.waitForTimeout( 3500 );
		await state( 'AFTER typing in pattern editor' );
		console.log( 'MARKERS', JSON.stringify( await getMarkers( editor ) ) );
		console.log( 'NOTES pattern', JSON.stringify( await getNotes( requestUtils, pattern.id ).catch( ( e: any ) => 'ERR ' + e.message ) ) );
		console.log( 'NOTES host', JSON.stringify( ( await getNotes( requestUtils, postId ) ).length ) );
		await shot( page, 'EX-03-synced-pattern-edit-original' );
	}
	const saved = await requestUtils.rest( { path: `/wp/v2/blocks/${ pattern.id }`, params: { context: 'edit' } } );
	console.log( 'PATTERN saved content (nothing was saved by the test)', saved.content.raw );
	console.log( 'CONSOLE', JSON.stringify( errors ) );
} );

test( 'EX-04 template context', async ( { admin, editor, page, requestUtils, pageUtils } ) => {
	const errors = collectConsole( page );
	page.on( 'response', async ( r: any ) => { if ( /wp\/v2\/comments/.test( r.url() ) && r.request().method() !== 'GET' ) console.log( 'RESP', r.status(), r.request().method(), decodeURIComponent( r.url() ).slice( 0, 120 ) ); } );
	await page.goto( '/wp-admin/site-editor.php?canvas=edit' );
	await page.waitForTimeout( 6000 );
	console.log( 'URL', page.url(), 'TITLE', await page.title() );
	console.log( 'BODY', ( await page.locator( 'body' ).innerText() ).replace( /\s+/g, ' ' ).slice( 0, 300 ) );
	const hasTop = await page.getByRole( 'region', { name: 'Editor top bar' } ).count();
	console.log( 'top bar', hasTop );
	if ( hasTop ) {
		console.log( 'postType', await page.evaluate( () => ( window as any ).wp.data.select( 'core/editor' ).getCurrentPostType() ), 'INTENT', await intent( page ) );
		console.log( 'SITE EDITOR OPTIONS', JSON.stringify( await optionsItems( page ) ) );
		await pageUtils.pressKeys( 'secondary+x' );
		await page.waitForTimeout( 800 );
		console.log( 'INTENT after secondary+x', await intent( page ), 'SNACK', JSON.stringify( await page.locator( '.components-snackbar' ).allInnerTexts() ) );
		console.log( 'All notes button', await page.getByRole( 'button', { name: 'All notes', exact: true } ).count() );
		await shot( page, 'EX-04-site-editor-template' );
	} else {
		await shot( page, 'EX-04-site-editor-template' );
	}
	// Template mode from the post editor
	const postId = await seedPost( requestUtils, { title: 'ko EX-04' } );
	await openPost( admin, editor, postId );
	await editor.openDocumentSettingsSidebar();
	const settings = page.getByRole( 'region', { name: 'Editor settings' } );
	const tplBtn = settings.getByRole( 'button', { name: /Template options|^Template/ } );
	console.log( 'template buttons', JSON.stringify( await settings.getByRole( 'button' ).evaluateAll( ( els: any[] ) => els.map( ( e ) => e.getAttribute( 'aria-label' ) || e.textContent ).filter( ( t ) => /emplate/.test( t ) ) ) ) );
	if ( await tplBtn.count() ) {
		await tplBtn.first().click();
		await page.waitForTimeout( 500 );
		console.log( 'template menu', JSON.stringify( await page.getByRole( 'menuitem' ).allInnerTexts() ) );
		const edit = page.getByRole( 'menuitem', { name: /Edit template/ } );
		if ( await edit.count() ) {
			await edit.click();
			await page.waitForTimeout( 3000 );
			console.log( 'TEMPLATE MODE postType', await page.evaluate( () => ( window as any ).wp.data.select( 'core/editor' ).getCurrentPostType() ), 'intent', await intent( page ) );
			console.log( 'TEMPLATE MODE OPTIONS', JSON.stringify( await optionsItems( page ) ) );
			await pageUtils.pressKeys( 'secondary+x' );
			await page.waitForTimeout( 800 );
			console.log( 'INTENT after secondary+x in template', await intent( page ), 'SNACK', JSON.stringify( await page.locator( '.components-snackbar' ).allInnerTexts() ) );
			await shot( page, 'EX-04-template-mode-from-post' );
		} else {
			await page.keyboard.press( 'Escape' );
		}
	}
	console.log( 'CONSOLE', JSON.stringify( errors ) );
} );

test( 'EX-05 classic block', async ( { admin, editor, page, requestUtils } ) => {
	const errors = collectConsole( page );
	const postId = await seedPost( requestUtils, { title: 'ko EX-05', content: '<p>Classic paragraph one with plain words.</p>\n<p>Classic paragraph two.</p>' } );
	const pristine = await rawContent( requestUtils, postId );
	page.on( 'response', async ( r: any ) => { if ( /wp\/v2\/comments/.test( r.url() ) && r.request().method() !== 'GET' ) console.log( 'RESP', r.status(), r.request().method(), ( r.request().postData() || '' ).slice( 0, 400 ) ); } );
	await openPost( admin, editor, postId );
	await page.waitForTimeout( 1500 );
	console.log( 'BLOCKS on load', JSON.stringify( ( await getBlocks( page ) ).map( ( b: any ) => b.name + ' ' + JSON.stringify( b.content ?? b.attributes ).slice( 0, 120 ) ) ) );
	await switchIntent( page, 'Suggesting' );
	const classic = editor.canvas.locator( '[data-type="core/freeform"]' ).first();
	console.log( 'freeform count', await editor.canvas.locator( '[data-type="core/freeform"]' ).count() );
	if ( await classic.count() ) {
		console.log( 'classic HTML', ( await classic.innerHTML() ).replace( /\s+/g, ' ' ).slice( 0, 400 ) );
		await classic.click();
		await page.waitForTimeout( 800 );
		console.log( 'TOOLBAR', JSON.stringify( await page.getByRole( 'toolbar', { name: 'Block tools' } ).getByRole( 'button' ).evaluateAll( ( els: any[] ) => els.map( ( e ) => e.getAttribute( 'aria-label' ) || e.textContent ) ).catch( () => [] ) ) );
		await page.keyboard.press( 'End' );
		await page.keyboard.type( ' CLASSICEDIT', { delay: 30 } );
		await page.waitForTimeout( 3500 );
		console.log( 'modal?', await page.getByRole( 'dialog' ).count(), JSON.stringify( await page.getByRole( 'dialog' ).allInnerTexts().then( ( t: string[] ) => t.map( ( x ) => x.slice( 0, 150 ) ) ) ) );
		const editBtn = page.getByRole( 'toolbar', { name: 'Block tools' } ).getByRole( 'button', { name: /^Edit$/ } );
		if ( await editBtn.count() ) {
			await editBtn.click();
			await page.waitForTimeout( 1500 );
			console.log( 'after Edit: dialogs', await page.getByRole( 'dialog' ).count() );
			const frame = page.frameLocator( '.block-editor-freeform-modal iframe, iframe[id^="editor-"]' ).first();
			const body = page.locator( '.block-editor-freeform-modal iframe' ).first();
			if ( await body.count() ) {
				await page.frameLocator( '.block-editor-freeform-modal iframe' ).first().locator( 'body' ).click();
				await page.keyboard.press( 'ControlOrMeta+End' );
				await page.keyboard.type( ' MODALEDIT', { delay: 30 } );
				await shot( page, 'EX-05-classic-modal' );
				const save = page.getByRole( 'dialog' ).getByRole( 'button', { name: /Save|Update|Done/ } );
				console.log( 'modal buttons', JSON.stringify( await page.getByRole( 'dialog' ).getByRole( 'button' ).allInnerTexts() ) );
				if ( await save.count() ) await save.first().click();
				await page.waitForTimeout( 3500 );
			}
		}
	}
	console.log( 'SNACK', JSON.stringify( await page.locator( '.components-snackbar' ).allInnerTexts() ) );
	const blocks = await getBlocks( page );
	console.log( 'BLOCKS after', JSON.stringify( blocks.map( ( b: any ) => b.name + ' ' + JSON.stringify( b.metadata ?? null ) + ' ' + JSON.stringify( b.content ?? b.attributes ).slice( 0, 400 ) ) ) );
	console.log( 'MARKERS', JSON.stringify( await getMarkers( editor ) ) );
	console.log( 'NOTES', JSON.stringify( await getNotes( requestUtils, postId ) ).slice( 0, 900 ) );
	console.log( 'THREADS', JSON.stringify( await threads( page ) ) );
	await shot( page, 'EX-05-classic-block' );
	console.log( 'dirty', await page.evaluate( () => ( window as any ).wp.data.select( 'core/editor' ).isEditedPostDirty() ) );
	console.log( 'SERVER content unchanged', ( await rawContent( requestUtils, postId ) ) === pristine );
	console.log( 'CONSOLE', JSON.stringify( errors ) );
} );

test( 'EX-06 code editor round trip', async ( { admin, editor, page, requestUtils, pageUtils } ) => {
	const errors = collectConsole( page );
	const postId = await seedPost( requestUtils, { title: 'ko EX-06' } );
	const ctx = { page, editor, requestUtils };
	await openPost( admin, editor, postId );
	await switchIntent( page, 'Suggesting' );
	await suggest( 'add', ctx );
	await suggest( 'remove', ctx );
	const mode = () => page.evaluate( () => ( window as any ).wp.data.select( 'core/editor' ).getEditorMode() );
	console.log( 'SUGGESTING OPTIONS', JSON.stringify( ( await optionsItems( page ) ).filter( ( i: string ) => /editor/i.test( i ) ) ) );
	await pageUtils.pressKeys( 'secondary+m' );
	await page.waitForTimeout( 800 );
	console.log( 'mode after shortcut in Suggesting', await mode(), JSON.stringify( await page.locator( '.components-snackbar' ).allInnerTexts() ) );
	await switchIntent( page, 'Editing' );
	const before = await editor.getEditedPostContent();
	console.log( 'EDITING+pending OPTIONS', JSON.stringify( ( await optionsItems( page ) ).filter( ( i: string ) => /editor/i.test( i ) ) ) );
	await pageUtils.pressKeys( 'secondary+m' );
	await page.waitForTimeout( 1000 );
	console.log( 'mode after shortcut in Editing with pending', await mode(), JSON.stringify( await page.locator( '.components-snackbar' ).allInnerTexts() ) );
	// Try the menu item too
	await page.getByRole( 'region', { name: 'Editor top bar' } ).getByRole( 'button', { name: 'Options' } ).click();
	const item = page.getByRole( 'menuitemradio', { name: /^Code editor/ } );
	console.log( 'Code editor item disabled', await item.isDisabled(), 'text', ( await item.innerText() ).replace( /\s+/g, ' ' ) );
	await item.hover();
	await page.waitForTimeout( 800 );
	console.log( 'tooltip', JSON.stringify( await page.getByRole( 'tooltip' ).allInnerTexts() ) );
	await shot( page, 'EX-06-code-editor-withheld' );
	await item.click( { force: true } ).catch( () => {} );
	await page.keyboard.press( 'Escape' );
	await page.waitForTimeout( 800 );
	console.log( 'mode after forced click', await mode(), 'textarea', await page.getByRole( 'textbox', { name: 'Type text or HTML' } ).count() );
	if ( ( await mode() ) === 'text' ) {
		await shot( page, 'EX-06-in-code-editor' );
		await pageUtils.pressKeys( 'secondary+m' );
		await page.waitForTimeout( 1000 );
	}
	const after = await editor.getEditedPostContent();
	console.log( 'content identical after attempts', before === after );
	await snap( 'EX-06 after round trip attempts', ctx, postId );
	await shot( page, 'EX-06-after-round-trip' );
	console.log( 'CONSOLE', JSON.stringify( errors ) );
} );
