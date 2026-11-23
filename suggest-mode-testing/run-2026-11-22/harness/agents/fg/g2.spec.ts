import { test } from '@wordpress/e2e-test-utils-playwright';
import { seedPost, openPost, switchIntent, shot, collectConsole } from '../../helpers';
import { dump, maybeSaved, logWrites, settle, summaries } from './util';

const settingsRegion = ( page: any ) => page.getByRole( 'region', { name: 'Editor settings' } );
const edited = ( page: any, a: string ) => page.evaluate( ( x: string ) => ( window as any ).wp.data.select( 'core/editor' ).getEditedPostAttribute( x ), a );
const entity = ( page: any, id: number, a: string ) => page.evaluate( ( [ i, x ]: [ number, string ] ) => ( window as any ).wp.data.select( 'core' ).getEditedEntityRecord( 'postType', 'post', i )[ x ], [ id, a ] as [ number, string ] );
const stored = ( requestUtils: any, id: number ) => requestUtils.rest( { path: `/wp/v2/posts/${ id }`, params: { context: 'edit' } } );

const GROUP_CONTENT = `<!-- wp:group {"layout":{"type":"constrained"}} -->
<div class="wp-block-group"><!-- wp:paragraph -->
<p>Group child A.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>Group child B.</p>
<!-- /wp:paragraph --></div>
<!-- /wp:group -->

<!-- wp:paragraph -->
<p>Outside paragraph after the group.</p>
<!-- /wp:paragraph -->`;

test( 'AT-07 block rename', async ( { admin, editor, page, requestUtils, pageUtils } ) => {
	const errors = collectConsole( page );
	const postId = await seedPost( requestUtils, { title: 'fg AT-07', content: GROUP_CONTENT } );
	await openPost( admin, editor, postId );
	logWrites( page );
	await switchIntent( page, 'Suggesting' );
	await pageUtils.pressKeys( 'access+o' );
	const lv = page.getByRole( 'treegrid', { name: 'Block navigation structure' } );
	await lv.waitFor();
	await lv.getByRole( 'link', { name: 'Group' } ).first().click();
	console.log( 'LV BUTTONS', JSON.stringify( await lv.getByRole( 'button' ).evaluateAll( ( els: HTMLElement[] ) => els.map( ( e ) => e.getAttribute( 'aria-label' ) || e.textContent ) ) ) );
	await lv.getByRole( 'button', { name: 'Options for Group' } ).first().click();
	console.log( 'MENU', JSON.stringify( await page.getByRole( 'menu' ).last().getByRole( 'menuitem' ).evaluateAll( ( els: HTMLElement[] ) => els.map( ( e ) => ( e.textContent || '' ).slice( 0, 30 ) + ( e.getAttribute( 'aria-disabled' ) === 'true' ? ' [disabled]' : '' ) ) ) ) );
	await page.getByRole( 'menuitem', { name: 'Rename' } ).click();
	const dialog = page.getByRole( 'dialog', { name: 'Rename' } );
	await dialog.getByRole( 'textbox' ).fill( 'FG Hero Section' );
	const s = maybeSaved( page, 15000 );
	await dialog.getByRole( 'button', { name: 'Save' } ).click();
	console.log( 'rename save:', await s );
	await settle( page, 2000 );
	console.log( 'LV ROWS', JSON.stringify( await lv.getByRole( 'row' ).allInnerTexts() ) );
	await shot( page, 'AT-07-block-rename' );
	await dump( 'AT-07', { page, editor, requestUtils, postId } );
	await shot( page, 'AT-07-note' );
	console.log( 'THREAD', JSON.stringify( await settingsRegion( page ).locator( '.editor-collab-sidebar-panel__thread' ).allInnerTexts() ) );
	// Accept and confirm the name lands while noteId bookkeeping is cleaned.
	const acc = settingsRegion( page ).getByRole( 'button', { name: 'Accept suggestion' } );
	if ( await acc.count() ) {
		await acc.first().click();
		await settle( page, 2500 );
		await dump( 'AT-07 after accept', { page, editor, requestUtils, postId } );
		console.log( 'LV ROWS after accept', JSON.stringify( await lv.getByRole( 'row' ).allInnerTexts() ) );
		await shot( page, 'AT-07-after-accept' );
	}
	console.log( 'ERRORS', JSON.stringify( errors ) );
} );

test( 'AT-09 post title', async ( { admin, editor, page, requestUtils } ) => {
	const errors = collectConsole( page );
	const postId = await seedPost( requestUtils, { title: 'fg AT-09 Original' } );
	await openPost( admin, editor, postId );
	logWrites( page );
	await switchIntent( page, 'Suggesting' );
	const title = editor.canvas.getByRole( 'textbox', { name: 'Add title' } );
	await title.click();
	await page.keyboard.press( 'End' );
	const s = maybeSaved( page, 15000 );
	await page.keyboard.type( ' TITLEEDIT', { delay: 25 } );
	console.log( 'title save:', await s );
	await settle( page, 2500 );
	console.log( 'TITLE shown', await title.innerText(), '| edited attr', await edited( page, 'title' ), '| entity', await entity( page, postId, 'title' ), '| dirty', await page.evaluate( () => ( window as any ).wp.data.select( 'core/editor' ).isEditedPostDirty() ) );
	console.log( 'TITLE DOM', await title.evaluate( ( el: HTMLElement ) => el.outerHTML.slice( 0, 500 ) ) );
	await dump( 'AT-09', { page, editor, requestUtils, postId } );
	console.log( 'THREAD', JSON.stringify( await settingsRegion( page ).locator( '.editor-collab-sidebar-panel__thread' ).allInnerTexts() ) );
	await shot( page, 'AT-09-post-title' );
	console.log( 'STORED title', ( await stored( requestUtils, postId ) ).title.raw );
	await settingsRegion( page ).getByRole( 'button', { name: 'Reject suggestion' } ).first().click();
	await settle( page, 2500 );
	console.log( 'AFTER REJECT title shown', await title.innerText(), '| stored', ( await stored( requestUtils, postId ) ).title.raw );
	await dump( 'AT-09 after reject', { page, editor, requestUtils, postId } );
	await shot( page, 'AT-09-after-reject' );
	console.log( 'ERRORS', JSON.stringify( errors ) );
} );

test( 'AT-10 post-level metadata', async ( { admin, editor, page, requestUtils } ) => {
	const errors = collectConsole( page );
	const postId = await seedPost( requestUtils, { title: 'fg AT-10' } );
	const media = await requestUtils.uploadMedia( '/Users/adamsilverstein/repositories/worktrees/suggest-mode-testing-1122/test/e2e/assets/10x10_e2e_test_image_green.png' ).catch( ( e: any ) => { console.log( 'uploadMedia failed', String( e ).slice( 0, 300 ) ); return null; } );
	console.log( 'MEDIA', media?.id );
	let cat: any = null;
	try {
		cat = await requestUtils.rest( { method: 'POST', path: '/wp/v2/categories', data: { name: `FG cat ${ Date.now() }` } } );
	} catch ( e ) {
		console.log( 'category create failed', String( e ).slice( 0, 200 ) );
	}
	console.log( 'CAT', cat?.id, cat?.name );
	const before = await stored( requestUtils, postId );
	console.log( 'BEFORE', JSON.stringify( { excerpt: before.excerpt.raw, fm: before.featured_media, cats: before.categories, tags: before.tags, status: before.status, slug: before.slug } ) );
	await openPost( admin, editor, postId );
	logWrites( page );
	await editor.openDocumentSettingsSidebar();
	const settings = settingsRegion( page );
	const postTab = settings.getByRole( 'tab', { name: 'Post' } );
	if ( await postTab.count() ) {
		await postTab.click();
	}
	const listButtons = async ( label: string ) => console.log( label, JSON.stringify( await settings.getByRole( 'button' ).evaluateAll( ( els: HTMLElement[] ) => els.map( ( e ) => ( e.getAttribute( 'aria-label' ) || e.textContent || '' ).slice( 0, 40 ) + ( e.getAttribute( 'aria-disabled' ) === 'true' || ( e as HTMLButtonElement ).disabled ? ' [disabled]' : '' ) ) ) ) );
	await listButtons( 'EDITING buttons' );
	await shot( page, 'AT-10-editing-sidebar' );
	await switchIntent( page, 'Suggesting' );
	await settle( page, 800 );
	await listButtons( 'SUGGESTING buttons' );
	await shot( page, 'AT-10-suggesting-sidebar' );

	// Excerpt
	try {
		await settings.getByRole( 'button', { name: /Edit Excerpt|Add an excerpt/ } ).first().click();
		const ta = page.getByRole( 'textbox', { name: 'Excerpt' } );
		const s = maybeSaved( page, 15000 );
		await ta.fill( 'A suggested excerpt' );
		await ta.blur();
		console.log( 'excerpt save:', await s );
		await page.keyboard.press( 'Escape' );
	} catch ( e ) {
		console.log( 'EXCERPT gesture failed', String( e ).slice( 0, 400 ) );
	}
	await settle( page, 1000 );
	console.log( 'EXCERPT edited', await edited( page, 'excerpt' ), '| entity', await entity( page, postId, 'excerpt' ) );

	// Category
	try {
		await editor.openDocumentSettingsSidebar();
		const toggle = settings.getByRole( 'button', { name: 'Categories', exact: true } );
		if ( ( await toggle.getAttribute( 'aria-expanded' ) ) === 'false' ) {
			await toggle.click();
		}
		const s = maybeSaved( page, 15000 );
		await settings.getByRole( 'checkbox', { name: cat.name } ).check();
		console.log( 'category save:', await s );
	} catch ( e ) {
		console.log( 'CATEGORY gesture failed', String( e ).slice( 0, 400 ) );
	}
	await settle( page, 1000 );
	console.log( 'CATEGORIES edited', JSON.stringify( await edited( page, 'categories' ) ), '| entity', JSON.stringify( await entity( page, postId, 'categories' ) ) );

	// Tag
	const tagName = `fg-tag-${ Date.now() }`;
	try {
		await editor.openDocumentSettingsSidebar();
		const toggle = settings.getByRole( 'button', { name: 'Tags', exact: true } );
		if ( ( await toggle.getAttribute( 'aria-expanded' ) ) === 'false' ) {
			await toggle.click();
		}
		const tags = settings.getByRole( 'combobox', { name: 'Add Tag' } );
		await tags.fill( tagName );
		const s = maybeSaved( page, 15000 );
		await page.getByRole( 'option', { name: `Create: ${ tagName }` } ).click();
		console.log( 'tag save:', await s );
	} catch ( e ) {
		console.log( 'TAG gesture failed', String( e ).slice( 0, 400 ) );
	}
	await settle( page, 1000 );
	console.log( 'TAGS edited', JSON.stringify( await edited( page, 'tags' ) ), '| entity', JSON.stringify( await entity( page, postId, 'tags' ) ) );
	const tagExists = await requestUtils.rest( { path: '/wp/v2/tags', params: { search: tagName } } );
	console.log( 'TAG created on server?', tagExists.length );

	// Featured image
	try {
		await editor.openDocumentSettingsSidebar();
		await settings.getByRole( 'button', { name: /Set featured image/i } ).click();
		const modal = page.getByRole( 'dialog' ).last();
		await settle( page, 1500 );
		console.log( 'MODAL', ( await modal.innerText() ).slice( 0, 300 ).replace( /\n/g, ' | ' ) );
		const lib = modal.getByRole( 'tab', { name: 'Media Library' } );
		if ( await lib.count() ) {
			await lib.click();
		}
		await settle( page, 1500 );
		await modal.getByRole( 'checkbox' ).first().click();
		const s = maybeSaved( page, 15000 );
		await modal.getByRole( 'button', { name: /Set featured image|Select/ } ).last().click();
		console.log( 'featured save:', await s );
	} catch ( e ) {
		console.log( 'FEATURED gesture failed', String( e ).slice( 0, 500 ) );
		await shot( page, 'AT-10-featured-failed' );
		await page.keyboard.press( 'Escape' );
	}
	await settle( page, 1500 );
	console.log( 'FEATURED edited', await edited( page, 'featured_media' ), '| entity', await entity( page, postId, 'featured_media' ) );

	// Status
	await editor.openDocumentSettingsSidebar();
	await settle( page, 500 );
	console.log( 'Edit Status buttons', await settings.getByRole( 'button', { name: 'Edit Status' } ).count(), 'Edit Author', await settings.getByRole( 'button', { name: 'Edit Author' } ).count(), 'Edit Discussion', await settings.getByRole( 'button', { name: 'Edit Discussion' } ).count(), 'Edit Slug', await settings.getByRole( 'button', { name: /Edit Slug|Edit Link/ } ).count(), 'Move to trash', await settings.getByRole( 'button', { name: /Move to trash/i } ).count() );
	await shot( page, 'AT-10-post-level-metadata' );
	const publish = page.getByRole( 'region', { name: 'Editor top bar' } ).getByRole( 'button', { name: 'Publish', exact: true } );
	console.log( 'PUBLISH count', await publish.count(), 'aria-disabled', await publish.getAttribute( 'aria-disabled' ).catch( () => 'n/a' ) );
	if ( await publish.count() ) {
		await publish.click();
		await settle( page, 1200 );
		console.log( 'HINT visible', await page.getByText( 'Switch to Editing to change the post status.' ).count(), 'publish panel', await page.getByRole( 'region', { name: 'Editor publish' } ).isVisible().catch( () => false ) );
		await shot( page, 'AT-10-publish-refused' );
		await page.keyboard.press( 'Escape' );
	}
	console.log( 'STATUS edited', await edited( page, 'status' ) );
	const notes = await dump( 'AT-10', { page, editor, requestUtils, postId } );
	void notes;
	await shot( page, 'AT-10-notes' );
	console.log( 'SUM', JSON.stringify( await summaries( page ) ) );
	// Save in Suggesting and read what the server holds.
	await page.evaluate( () => ( window as any ).wp.data.dispatch( 'core/editor' ).savePost() );
	await settle( page, 3000 );
	const after = await stored( requestUtils, postId );
	console.log( 'AFTER SAVE', JSON.stringify( { excerpt: after.excerpt.raw, fm: after.featured_media, cats: after.categories, tags: after.tags, status: after.status, slug: after.slug } ) );
	console.log( 'ERRORS', JSON.stringify( errors ) );
} );
