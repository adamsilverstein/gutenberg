import { test } from '@wordpress/e2e-test-utils-playwright';
import { seedPost, openPost, switchIntent, suggestionSaved, getMarkers, getBlocks, getNotes, shot, collectConsole } from '../../helpers';
import { log, notices, modeMenu, shortcutCombos, brief } from './util';

const NAMES = [ 'core/editor/intent-edit', 'core/editor/intent-suggest', 'core/editor/intent-view' ];

async function probe( page: any, label: string ) {
	const top = page.getByRole( 'region', { name: 'Editor top bar' } );
	await top.waitFor( { timeout: 20000 } );
	await page.waitForTimeout( 2500 );
	log( `${ label } url`, page.url() );
	log( `${ label } postType`, await page.evaluate( () => { const s = ( window as any ).wp.data.select( 'core/editor' ); return { type: s.getCurrentPostType(), id: s.getCurrentPostId(), rendering: s.getRenderingMode?.() }; } ) );
	log( `${ label } shortcuts`, await shortcutCombos( page, NAMES ) );
	const options = top.getByRole( 'button', { name: 'Options' } );
	log( `${ label } options buttons`, await options.count() );
	if ( await options.count() ) {
		await options.click();
		await page.waitForTimeout( 500 );
		log( `${ label } radios`, await page.evaluate( () => Array.from( document.querySelectorAll( '[role="menuitemradio"]' ) ).map( ( i ) => ( { text: ( i as HTMLElement ).innerText.replace( /\s+/g, ' ' ).slice( 0, 50 ), checked: i.getAttribute( 'aria-checked' ), dis: i.getAttribute( 'aria-disabled' ) } ) ) ) );
		await shot( page, `MS-09-${ label }-options-menu` );
		await page.keyboard.press( 'Escape' );
	}
	const canvas = page.frameLocator( 'iframe[name="editor-canvas"]' );
	const para = canvas.locator( '[data-type="core/paragraph"], [data-type="core/post-title"], [data-type]' ).first();
	await para.click( { force: true } ).catch( ( e: any ) => log( 'click', String( e ).slice( 0, 80 ) ) );
	await page.evaluate( () => ( window as any ).wp.data.dispatch( 'core/notices' ).removeAllNotices( 'snackbar' ) );
	await page.keyboard.press( 'Shift+Alt+Meta+X' );
	await page.waitForTimeout( 600 );
	log( `${ label } notices after X`, await notices( page ) );
	await shot( page, `MS-09-${ label }-after-suggest-shortcut` );
	await page.keyboard.press( 'Control+Alt+H' );
	const modal = page.getByRole( 'dialog', { name: 'Keyboard shortcuts' } );
	if ( await modal.count() ) {
		log( `${ label } modal Switch rows`, await modal.locator( 'li' ).filter( { hasText: /Switch to/ } ).allInnerTexts() );
		await shot( page, `MS-09-${ label }-shortcuts-modal` );
		await page.keyboard.press( 'Escape' );
	} else {
		log( `${ label } modal`, 'not opened' );
	}
}

test( 'MS-09 site editor template and page', async ( { admin, page, requestUtils } ) => {
	const errors = collectConsole( page );
	await admin.visitSiteEditor( { postId: 'ipsum//index', postType: 'wp_template', canvas: 'edit' } );
	await probe( page, 'template' );
	// Do not leave anything dirty.
	log( 'template dirty', await page.evaluate( () => ( window as any ).wp.data.select( 'core' ).__experimentalGetDirtyEntityRecords().map( ( r: any ) => r.name + ':' + r.key ) ) );

	const pg = await requestUtils.rest( { method: 'POST', path: '/wp/v2/pages', data: { title: 'abc MS-09 page', content: '<!-- wp:paragraph -->\n<p>Page paragraph for the Site Editor flow.</p>\n<!-- /wp:paragraph -->', status: 'draft' } } );
	await admin.visitSiteEditor( { postId: pg.id, postType: 'page', canvas: 'edit' } );
	await probe( page, 'page' );
	// If suggesting became active, try a typed suggestion.
	const n = await notices( page );
	if ( n.some( ( x: any ) => /suggesting/.test( x.content ) ) ) {
		const canvas = page.frameLocator( 'iframe[name="editor-canvas"]' );
		const p = canvas.locator( '[data-type="core/paragraph"]' ).first();
		await p.click();
		await page.keyboard.press( 'End' );
		const saved = suggestionSaved( page ).catch( ( e ) => { log( 'save wait', String( e ).slice( 0, 120 ) ); } );
		await page.keyboard.type( ' SITEEDIT', { delay: 25 } );
		await saved;
		log( 'page markers', await canvas.locator( 'mark[class*="wp-suggestion"]' ).evaluateAll( ( els: any[] ) => els.map( ( e ) => e.className + ':' + e.textContent ) ) );
		log( 'page notes', ( await getNotes( requestUtils, pg.id ) ).map( ( x ) => ( { id: x.id, meta: x.meta?._wp_suggestion } ) ) );
		await shot( page, 'MS-09-page-suggestion-in-site-editor' );
		log( 'dirty', await page.evaluate( () => ( window as any ).wp.data.select( 'core' ).__experimentalGetDirtyEntityRecords().map( ( r: any ) => r.name + ':' + r.key ) ) );
	}
	log( 'errors', errors );
} );

test( 'MS-10b palette and menu click in editing with pending', async ( { admin, editor, page, requestUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'abc MS-10b' } );
	await openPost( admin, editor, postId );
	await switchIntent( page, 'Suggesting' );
	const p = editor.canvas.locator( '[data-type="core/paragraph"]' ).first();
	await p.click();
	await page.keyboard.press( 'End' );
	const saved = suggestionSaved( page );
	await page.keyboard.type( ' INSERTED', { delay: 25 } );
	await saved;
	await page.keyboard.press( 'Meta+k' );
	const palette = page.getByRole( 'combobox' ).first();
	await page.waitForTimeout( 500 );
	log( 'palette dialog', await page.getByRole( 'dialog' ).count() );
	if ( await page.getByRole( 'dialog' ).count() ) {
		await page.keyboard.type( 'code editor' );
		await page.waitForTimeout( 1000 );
		log( 'palette options', await page.getByRole( 'option' ).allInnerTexts() );
		await shot( page, 'MS-10-command-palette-suggesting' );
		const opt = page.getByRole( 'option', { name: /code editor/i } ).first();
		if ( await opt.count() ) {
			await opt.click();
			await page.waitForTimeout( 500 );
		} else {
			await page.keyboard.press( 'Escape' );
		}
	}
	log( 'text editor visible after palette', await page.locator( '.editor-post-text-editor' ).isVisible() );
	log( 'notices after palette', await notices( page ) );
	await page.keyboard.press( 'Escape' );
	await switchIntent( page, 'Editing' );
	await modeMenu( page );
	await page.getByRole( 'menuitemradio', { name: /^Code editor/ } ).click();
	await page.waitForTimeout( 500 );
	log( 'text editor visible after menu click in editing', await page.locator( '.editor-post-text-editor' ).isVisible() );
	log( 'notices', await notices( page ) );
	log( 'menu', await modeMenu( page ) );
	await shot( page, 'MS-10-editing-with-pending-menu-click-refused' );
	log( 'blocks', ( await getBlocks( page ) ).length );
	log( 'markers', brief( await getMarkers( editor ) ) );
} );
