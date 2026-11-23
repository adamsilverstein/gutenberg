import { test } from '@wordpress/e2e-test-utils-playwright';
import { seedPost, openPost, switchIntent, shot, collectConsole } from '../../helpers';
import { dump, maybeSaved, logWrites, para, settle } from './util';

const settingsRegion = ( page: any ) => page.getByRole( 'region', { name: 'Editor settings' } );

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

test( 'AT-03 image wide', async ( { admin, editor, page, requestUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'fg AT-03' } );
	await openPost( admin, editor, postId );
	logWrites( page );
	await switchIntent( page, 'Suggesting' );
	const image = editor.canvas.getByRole( 'document', { name: 'Block: Image' } );
	await editor.selectBlocks( image );
	const tb = page.getByRole( 'toolbar', { name: 'Block tools' } );
	const w0 = await image.evaluate( ( el: HTMLElement ) => ( { cls: el.className, w: el.getBoundingClientRect().width } ) );
	await tb.getByRole( 'button', { name: 'Align block', exact: true } ).click();
	console.log( 'ALIGN OPTIONS', JSON.stringify( await page.getByRole( 'menuitemradio' ).allInnerTexts() ) );
	const s = maybeSaved( page, 15000 );
	await page.getByRole( 'menuitemradio', { name: /Wide width/ } ).click();
	console.log( 'save:', await s );
	await settle( page, 2000 );
	const w1 = await image.evaluate( ( el: HTMLElement ) => ( { cls: el.className, w: el.getBoundingClientRect().width, dataAlign: el.getAttribute( 'data-align' ) } ) );
	console.log( 'IMAGE DOM before', JSON.stringify( w0 ), 'after', JSON.stringify( w1 ) );
	await page.keyboard.press( 'Escape' );
	await shot( page, 'AT-03-image-wide-align' );
	await dump( 'AT-03', { page, editor, requestUtils, postId } );
	await settingsRegion( page ).getByRole( 'button', { name: 'Reject suggestion' } ).first().click();
	await settle( page, 2000 );
	const w2 = await image.evaluate( ( el: HTMLElement ) => ( { cls: el.className, w: el.getBoundingClientRect().width } ) );
	console.log( 'IMAGE DOM after reject', JSON.stringify( w2 ) );
} );

test( 'AT-04 text colour', async ( { admin, editor, page, requestUtils } ) => {
	const errors = collectConsole( page );
	const postId = await seedPost( requestUtils, { title: 'fg AT-04 colour' } );
	await openPost( admin, editor, postId );
	logWrites( page );
	await switchIntent( page, 'Suggesting' );
	await editor.selectBlocks( para( editor, 0 ) );
	await editor.openDocumentSettingsSidebar();
	const settings = settingsRegion( page );
	await settle( page, 800 );
	const blockTab = settings.getByRole( 'tab', { name: 'Block' } );
	if ( await blockTab.count() ) {
		await blockTab.click();
	}
	const c0 = await para( editor, 0 ).evaluate( ( el: HTMLElement ) => getComputedStyle( el ).color );
	await settings.getByRole( 'button', { name: 'Color', exact: true } ).first().click();
	await settle( page, 600 );
	const options = page.getByRole( 'option' );
	console.log( 'COLOR OPTIONS', JSON.stringify( ( await options.evaluateAll( ( els: HTMLElement[] ) => els.map( ( e ) => e.getAttribute( 'aria-label' ) ) ) ).slice( 0, 14 ) ) );
	await shot( page, 'AT-04-colour-picker' );
	let s = maybeSaved( page, 15000 );
	await options.nth( 2 ).click();
	console.log( 'colour save:', await s );
	await page.keyboard.press( 'Escape' );
	await settle( page, 1500 );
	console.log( 'P COLOR before', c0, 'after', JSON.stringify( await para( editor, 0 ).evaluate( ( el: HTMLElement ) => ( { cls: el.className, color: getComputedStyle( el ).color } ) ) ) );
	await dump( 'AT-04 after colour', { page, editor, requestUtils, postId }, { sidebar: false } );
	// Then the font size on the same block.
	s = maybeSaved( page, 15000 );
	await settings.getByRole( 'radiogroup', { name: 'Font size' } ).getByRole( 'radio' ).nth( 2 ).click();
	console.log( 'font save:', await s );
	await settle( page, 2000 );
	console.log( 'P STYLE', JSON.stringify( await para( editor, 0 ).evaluate( ( el: HTMLElement ) => ( { cls: el.className, color: getComputedStyle( el ).color, fs: getComputedStyle( el ).fontSize } ) ) ) );
	await shot( page, 'AT-04-color-typography' );
	await dump( 'AT-04 after colour + font size', { page, editor, requestUtils, postId } );
	await shot( page, 'AT-04-notes' );
	await settingsRegion( page ).getByRole( 'button', { name: 'Reject suggestion' } ).first().click();
	await settle( page, 2000 );
	console.log( 'P STYLE after reject', JSON.stringify( await para( editor, 0 ).evaluate( ( el: HTMLElement ) => ( { cls: el.className, color: getComputedStyle( el ).color, fs: getComputedStyle( el ).fontSize } ) ) ) );
	console.log( 'ERRORS', JSON.stringify( errors ) );
} );

test( 'AT-07 block rename', async ( { admin, editor, page, requestUtils, pageUtils } ) => {
	const errors = collectConsole( page );
	const postId = await seedPost( requestUtils, { title: 'fg AT-07', content: GROUP_CONTENT } );
	await openPost( admin, editor, postId );
	logWrites( page );
	await switchIntent( page, 'Suggesting' );
	await pageUtils.pressKeys( 'access+o' );
	const lv = page.getByRole( 'treegrid', { name: 'Block navigation structure' } );
	await lv.waitFor();
	const groupRow = lv.getByRole( 'row' ).filter( { hasText: 'Group' } ).first();
	await groupRow.getByRole( 'link' ).click();
	await groupRow.getByRole( 'button', { name: 'Options' } ).click();
	console.log( 'MENU', JSON.stringify( await page.getByRole( 'menuitem' ).evaluateAll( ( els: HTMLElement[] ) => els.map( ( e ) => ( e.textContent || '' ).slice( 0, 30 ) + ( e.getAttribute( 'aria-disabled' ) === 'true' ? ' [disabled]' : '' ) ).filter( ( t ) => ! /WordPress|suggest-mode|palette|Comments|^New|View Post|admin/.test( t ) ) ) ) );
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
	const acc = settingsRegion( page ).getByRole( 'button', { name: 'Accept suggestion' } );
	console.log( 'ACCEPT count', await acc.count() );
	if ( await acc.count() ) {
		await acc.first().click();
		await settle( page, 2500 );
		await dump( 'AT-07 after accept', { page, editor, requestUtils, postId } );
		console.log( 'LV ROWS after accept', JSON.stringify( await lv.getByRole( 'row' ).allInnerTexts() ) );
		await shot( page, 'AT-07-after-accept' );
	}
	console.log( 'ERRORS', JSON.stringify( errors ) );
} );
