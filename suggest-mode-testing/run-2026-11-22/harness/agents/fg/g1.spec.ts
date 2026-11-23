import { test } from '@wordpress/e2e-test-utils-playwright';
import { seedPost, openPost, switchIntent, shot, collectConsole } from '../../helpers';
import { dump, maybeSaved, logWrites, para, settle, summaries } from './util';

const heading = ( editor: any ) => editor.canvas.getByRole( 'document', { name: 'Block: Heading' } );
const settingsRegion = ( page: any ) => page.getByRole( 'region', { name: 'Editor settings' } );
const headingDom = ( editor: any ) => heading( editor ).evaluate( ( el: HTMLElement ) => ( { tag: el.tagName, cls: el.className, textAlign: getComputedStyle( el ).textAlign, text: el.textContent } ) );

async function decide( page: any, action: 'Accept' | 'Reject', nth = 0 ) {
	const btn = settingsRegion( page ).getByRole( 'button', { name: `${ action } suggestion` } );
	console.log( `${ action } buttons:`, await btn.count() );
	await btn.nth( nth ).click();
	await settle( page, 2500 );
	console.log( 'SNACKBAR', JSON.stringify( await page.locator( '.components-snackbar-list' ).allInnerTexts() ) );
}

async function setHeadingLevel( page: any, editor: any, from: number, to: number ) {
	await editor.selectBlocks( heading( editor ) );
	await page.getByRole( 'toolbar', { name: 'Block tools' } ).getByRole( 'button', { name: new RegExp( `^Heading ${ from }$` ) } ).click();
	const s = maybeSaved( page, 15000 );
	await page.getByRole( 'menuitem', { name: new RegExp( `^Heading ${ to }` ) } ).click();
	console.log( 'level save:', await s );
	await settle( page, 1500 );
}

test( 'AT-01 heading level', async ( { admin, editor, page, requestUtils } ) => {
	const errors = collectConsole( page );
	const postId = await seedPost( requestUtils, { title: 'fg AT-01' } );
	await openPost( admin, editor, postId );
	logWrites( page );
	await switchIntent( page, 'Suggesting' );
	await setHeadingLevel( page, editor, 2, 3 );
	console.log( 'HEADING DOM', JSON.stringify( await headingDom( editor ) ) );
	await dump( 'AT-01', { page, editor, requestUtils, postId } );
	await shot( page, 'AT-01-heading-level' );
	console.log( 'THREAD', JSON.stringify( await settingsRegion( page ).locator( '.editor-collab-sidebar-panel__thread' ).allInnerTexts() ) );
	await decide( page, 'Reject' );
	console.log( 'HEADING DOM after reject', JSON.stringify( await headingDom( editor ) ) );
	await dump( 'AT-01 after reject', { page, editor, requestUtils, postId } );
	await shot( page, 'AT-01-after-reject' );
	console.log( 'ERRORS', JSON.stringify( errors ) );
} );

test( 'AT-02 text alignment', async ( { admin, editor, page, requestUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'fg AT-02' } );
	await openPost( admin, editor, postId );
	logWrites( page );
	await switchIntent( page, 'Suggesting' );
	await editor.selectBlocks( para( editor, 0 ) );
	await page.getByRole( 'toolbar', { name: 'Block tools' } ).getByRole( 'button', { name: 'Align text' } ).click();
	const s = maybeSaved( page, 15000 );
	await page.getByRole( 'menuitemradio', { name: 'Align text center' } ).click();
	console.log( 'save:', await s );
	await settle( page, 2000 );
	console.log( 'P DOM', JSON.stringify( await para( editor, 0 ).evaluate( ( el: HTMLElement ) => ( { cls: el.className, textAlign: getComputedStyle( el ).textAlign } ) ) ) );
	await dump( 'AT-02', { page, editor, requestUtils, postId } );
	await shot( page, 'AT-02-text-alignment' );
} );

test( 'AT-03 image wide', async ( { admin, editor, page, requestUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'fg AT-03' } );
	await openPost( admin, editor, postId );
	logWrites( page );
	await switchIntent( page, 'Suggesting' );
	const image = editor.canvas.getByRole( 'document', { name: 'Block: Image' } );
	await editor.selectBlocks( image );
	const tb = page.getByRole( 'toolbar', { name: 'Block tools' } );
	console.log( 'TOOLBAR', JSON.stringify( await tb.getByRole( 'button' ).evaluateAll( ( els: HTMLElement[] ) => els.map( ( e ) => e.getAttribute( 'aria-label' ) || e.textContent ) ) ) );
	const w0 = await image.evaluate( ( el: HTMLElement ) => ( { cls: el.className, w: el.getBoundingClientRect().width } ) );
	await tb.getByRole( 'button', { name: 'Align', exact: true } ).click();
	console.log( 'ALIGN OPTIONS', JSON.stringify( await page.getByRole( 'menuitemradio' ).allInnerTexts() ) );
	const s = maybeSaved( page, 15000 );
	await page.getByRole( 'menuitemradio', { name: /Wide width/ } ).click();
	console.log( 'save:', await s );
	await settle( page, 2000 );
	const w1 = await image.evaluate( ( el: HTMLElement ) => ( { cls: el.className, w: el.getBoundingClientRect().width, dataAlign: el.getAttribute( 'data-align' ) } ) );
	console.log( 'IMAGE DOM before', JSON.stringify( w0 ), 'after', JSON.stringify( w1 ) );
	await dump( 'AT-03', { page, editor, requestUtils, postId } );
	await shot( page, 'AT-03-image-wide-align' );
} );

test( 'AT-04 color + font size', async ( { admin, editor, page, requestUtils } ) => {
	const errors = collectConsole( page );
	const postId = await seedPost( requestUtils, { title: 'fg AT-04' } );
	await openPost( admin, editor, postId );
	logWrites( page );
	await switchIntent( page, 'Suggesting' );
	await editor.selectBlocks( para( editor, 0 ) );
	await editor.openDocumentSettingsSidebar();
	const settings = settingsRegion( page );
	await settle( page, 800 );
	console.log( 'TABS', JSON.stringify( await settings.getByRole( 'tab' ).allInnerTexts() ) );
	const blockTab = settings.getByRole( 'tab', { name: 'Block' } );
	if ( await blockTab.count() ) {
		await blockTab.click();
	}
	const stylesTab = settings.getByRole( 'tab', { name: 'Styles' } );
	if ( await stylesTab.count() ) {
		await stylesTab.click();
	}
	await settle( page, 500 );
	console.log( 'SETTINGS BUTTONS', JSON.stringify( await settings.getByRole( 'button' ).evaluateAll( ( els: HTMLElement[] ) => els.map( ( e ) => ( e.getAttribute( 'aria-label' ) || e.textContent || '' ).slice( 0, 40 ) + ( e.getAttribute( 'aria-disabled' ) === 'true' || ( e as HTMLButtonElement ).disabled ? ' [disabled]' : '' ) ) ) ) );
	console.log( 'RADIOS', JSON.stringify( await settings.getByRole( 'radio' ).evaluateAll( ( els: HTMLElement[] ) => els.map( ( e ) => e.getAttribute( 'aria-label' ) || e.textContent ) ) ) );
	await shot( page, 'AT-04-inspector' );
	// Text colour.
	let s = maybeSaved( page, 15000 );
	try {
		await settings.getByRole( 'button', { name: 'Text', exact: true } ).click();
		const opts = page.getByRole( 'option', { name: /^(Color: )?/ } );
		console.log( 'COLOR OPTIONS', JSON.stringify( ( await page.getByRole( 'option' ).evaluateAll( ( els: HTMLElement[] ) => els.map( ( e ) => e.getAttribute( 'aria-label' ) ) ) ).slice( 0, 12 ) ) );
		await page.getByRole( 'option' ).nth( 1 ).click();
		void opts;
	} catch ( e ) {
		console.log( 'COLOR gesture failed', String( e ).slice( 0, 400 ) );
	}
	console.log( 'color save:', await s );
	await page.keyboard.press( 'Escape' );
	await settle( page, 1500 );
	await dump( 'AT-04 after colour', { page, editor, requestUtils, postId }, { sidebar: false } );
	// Font size.
	s = maybeSaved( page, 15000 );
	try {
		const radios = settings.getByRole( 'radiogroup', { name: 'Font size' } ).getByRole( 'radio' );
		console.log( 'FONT SIZE radios', await radios.count() );
		if ( await radios.count() ) {
			await radios.nth( 2 ).click();
		} else {
			const combo = settings.getByRole( 'combobox', { name: 'Font size' } );
			await combo.click();
			await page.getByRole( 'option' ).nth( 3 ).click();
		}
	} catch ( e ) {
		console.log( 'FONT gesture failed', String( e ).slice( 0, 400 ) );
	}
	console.log( 'font save:', await s );
	await settle( page, 2000 );
	console.log( 'P STYLE', JSON.stringify( await para( editor, 0 ).evaluate( ( el: HTMLElement ) => ( { cls: el.className, color: getComputedStyle( el ).color, fs: getComputedStyle( el ).fontSize } ) ) ) );
	await shot( page, 'AT-04-color-typography' );
	await dump( 'AT-04 after colour + font size', { page, editor, requestUtils, postId } );
	await shot( page, 'AT-04-notes' );
	console.log( 'ERRORS', JSON.stringify( errors ) );
} );

test( 'AT-05/06 class + anchor', async ( { admin, editor, page, requestUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'fg AT-05' } );
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
	const settingsTab = settings.getByRole( 'tab', { name: 'Settings' } );
	if ( await settingsTab.count() ) {
		await settingsTab.click();
	}
	const adv = settings.getByRole( 'button', { name: 'Advanced', exact: true } );
	console.log( 'ADVANCED count', await adv.count() );
	if ( ( await adv.getAttribute( 'aria-expanded' ) ) === 'false' ) {
		await adv.click();
	}
	console.log( 'TEXTBOXES', JSON.stringify( await settings.getByRole( 'textbox' ).evaluateAll( ( els: HTMLInputElement[] ) => els.map( ( e ) => ( { label: e.labels?.[ 0 ]?.textContent, disabled: e.disabled, ro: e.readOnly } ) ) ) ) );
	const cls = settings.getByRole( 'textbox', { name: /Additional CSS class/ } );
	let s = maybeSaved( page, 15000 );
	await cls.fill( 'fg-custom-class' );
	await cls.blur();
	console.log( 'class save:', await s );
	await settle( page, 2000 );
	await shot( page, 'AT-05-06-advanced-panel' );
	await dump( 'AT-05 class', { page, editor, requestUtils, postId } );
	await shot( page, 'AT-05-class-note' );
	// back to inspector for anchor
	await editor.selectBlocks( para( editor, 0 ) );
	await editor.openDocumentSettingsSidebar();
	await settle( page, 800 );
	if ( await blockTab.count() ) {
		await blockTab.click();
	}
	if ( await settingsTab.count() ) {
		await settingsTab.click();
	}
	if ( ( await adv.getAttribute( 'aria-expanded' ) ) === 'false' ) {
		await adv.click();
	}
	console.log( 'CLASS FIELD VALUE on return', await cls.inputValue() );
	const anchor = settings.getByRole( 'textbox', { name: /HTML anchor/i } );
	s = maybeSaved( page, 15000 );
	await anchor.fill( 'fg-anchor' );
	await anchor.blur();
	console.log( 'anchor save:', await s );
	await settle( page, 2000 );
	await shot( page, 'AT-06-anchor-field' );
	await dump( 'AT-06 anchor', { page, editor, requestUtils, postId } );
	await shot( page, 'AT-06-anchor-note' );
} );

test( 'AT-08 attribute then inline', async ( { admin, editor, page, requestUtils } ) => {
	const errors = collectConsole( page );
	const postId = await seedPost( requestUtils, { title: 'fg AT-08' } );
	await openPost( admin, editor, postId );
	logWrites( page );
	await switchIntent( page, 'Suggesting' );
	await setHeadingLevel( page, editor, 2, 3 );
	await dump( 'AT-08 attribute only', { page, editor, requestUtils, postId } );
	await heading( editor ).click();
	await page.keyboard.press( 'End' );
	const s = maybeSaved( page, 15000 );
	await page.keyboard.type( ' INLINE', { delay: 25 } );
	console.log( 'inline save:', await s );
	await settle( page, 2500 );
	console.log( 'HEADING DOM', JSON.stringify( await headingDom( editor ) ) );
	await dump( 'AT-08 attribute + inline', { page, editor, requestUtils, postId } );
	await shot( page, 'AT-08-attribute-then-inline' );
	// Independence: reject the inline one (2nd thread), attribute must remain; then accept attribute.
	const texts = await summaries( page );
	const inlineIdx = texts.findIndex( ( t ) => /INLINE/.test( t ) );
	console.log( 'inline thread index', inlineIdx );
	await decide( page, 'Reject', inlineIdx < 0 ? 0 : inlineIdx );
	console.log( 'HEADING DOM after rejecting inline', JSON.stringify( await headingDom( editor ) ) );
	await dump( 'AT-08 after rejecting inline', { page, editor, requestUtils, postId } );
	await decide( page, 'Accept', 0 );
	console.log( 'HEADING DOM after accepting attribute', JSON.stringify( await headingDom( editor ) ) );
	await dump( 'AT-08 after accepting attribute', { page, editor, requestUtils, postId } );
	await shot( page, 'AT-08-after-decisions' );
	console.log( 'ERRORS', JSON.stringify( errors ) );
} );

test( 'AT-11 two attribute changes', async ( { admin, editor, page, requestUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'fg AT-11' } );
	await openPost( admin, editor, postId );
	logWrites( page );
	await switchIntent( page, 'Suggesting' );
	await setHeadingLevel( page, editor, 2, 3 );
	await editor.selectBlocks( heading( editor ) );
	await page.getByRole( 'toolbar', { name: 'Block tools' } ).getByRole( 'button', { name: 'Align text' } ).click();
	const s = maybeSaved( page, 15000 );
	await page.getByRole( 'menuitemradio', { name: 'Align text center' } ).click();
	console.log( 'align save:', await s );
	await settle( page, 2000 );
	console.log( 'HEADING DOM', JSON.stringify( await headingDom( editor ) ) );
	await dump( 'AT-11', { page, editor, requestUtils, postId } );
	await shot( page, 'AT-11-two-attribute-changes' );
	await decide( page, 'Reject' );
	console.log( 'HEADING DOM after reject', JSON.stringify( await headingDom( editor ) ) );
	await dump( 'AT-11 after reject', { page, editor, requestUtils, postId } );
	await shot( page, 'AT-11-after-reject' );
} );
