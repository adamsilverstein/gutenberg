import { test } from '@wordpress/e2e-test-utils-playwright';
import { seedPost, openPost, switchIntent, getBlocks, shot } from '../../helpers';
import { dump, maybeSaved, logWrites, para, settle, flat } from './util';

const byText = ( editor: any, type: string, text: string ) =>
	editor.canvas.getByRole( 'document', { name: `Block: ${ type }` } ).filter( { hasText: text } );

test( 'ST-02 empty inserted block', async ( { admin, editor, page, requestUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'fg ST-02' } );
	await openPost( admin, editor, postId );
	logWrites( page );
	await switchIntent( page, 'Suggesting' );
	await para( editor, 0 ).click();
	await page.keyboard.press( 'End' );
	const s = maybeSaved( page, 6000 );
	await page.keyboard.press( 'Enter' );
	console.log( 'after Enter save:', await s );
	await shot( page, 'ST-02-empty-inserted-block' );
	await byText( editor, 'Paragraph', 'Fourth paragraph' ).click();
	await settle( page, 2500 );
	await dump( 'ST-02 after click away', { page, editor, requestUtils, postId } );
	console.log( 'CANVAS blocks', JSON.stringify( await editor.canvas.locator( '.is-root-container > *' ).evaluateAll( ( els: HTMLElement[] ) => els.map( ( e ) => `${ e.getAttribute( 'data-type' ) }|${ e.getAttribute( 'aria-label' ) }|${ ( e.textContent || '' ).slice( 0, 20 ) }|${ Array.from( e.classList ).filter( ( c ) => /suggest/.test( c ) ) }` ) ) ) );
	await shot( page, 'ST-02-after-click-away' );
	const dirty = await page.evaluate( () => ( window as any ).wp.data.select( 'core/editor' ).isEditedPostDirty() );
	console.log( 'DIRTY', dirty );
	const saveBtn = page.getByRole( 'region', { name: 'Editor top bar' } ).getByRole( 'button', { name: /^Save/ } );
	console.log( 'SAVE BTN', await saveBtn.allInnerTexts(), await saveBtn.first().getAttribute( 'aria-disabled' ).catch( () => 'n/a' ) );
	if ( dirty && ( await saveBtn.count() ) ) {
		await saveBtn.first().click();
		await settle( page, 3000 );
	}
	const stored = await requestUtils.rest( { path: `/wp/v2/posts/${ postId }`, params: { context: 'edit' } } );
	console.log( 'STORED empty paragraphs:', ( stored.content.raw.match( /<p><\/p>/g ) || [] ).length, 'len', stored.content.raw.length, 'paragraph blocks', ( stored.content.raw.match( /<!-- wp:paragraph/g ) || [] ).length );
	await page.reload();
	await editor.canvas.locator( '.is-root-container' ).first().waitFor();
	await settle( page, 2000 );
	console.log( 'AFTER RELOAD\n' + flat( await getBlocks( page ) ).join( '\n' ) );
	await shot( page, 'ST-02-after-reload' );
} );

for ( const mode of [ 'Editing', 'Suggesting' ] ) {
	test( `ST-06 list view select + Backspace (${ mode })`, async ( { admin, editor, page, requestUtils, pageUtils } ) => {
		const postId = await seedPost( requestUtils, { title: `fg ST-06 lv ${ mode }` } );
		await openPost( admin, editor, postId );
		logWrites( page );
		if ( mode === 'Suggesting' ) {
			await switchIntent( page, 'Suggesting' );
		}
		await pageUtils.pressKeys( 'access+o' );
		const lv = page.getByRole( 'treegrid', { name: 'Block navigation structure' } );
		await lv.waitFor();
		await lv.getByRole( 'link', { name: 'Paragraph' } ).nth( 2 ).click();
		const sel = await page.evaluate( () => {
			const s = ( window as any ).wp.data.select( 'core/block-editor' );
			return { n: s.getSelectedBlockClientIds().length, start: s.getSelectionStart(), active: document.activeElement?.tagName + '.' + document.activeElement?.className.slice( 0, 50 ) };
		} );
		console.log( 'SELECTION', JSON.stringify( sel ) );
		const s = maybeSaved( page, 8000 );
		await page.keyboard.press( 'Backspace' );
		console.log( 'save:', await s );
		await settle( page, 2000 );
		await dump( `ST-06 list view ${ mode }`, { page, editor, requestUtils, postId } );
		await shot( page, mode === 'Suggesting' ? 'ST-06-list-view-backspace' : 'ST-06-list-view-editing-control' );
	} );
}

test( 'ST-07 list view three blocks', async ( { admin, editor, page, requestUtils, pageUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'fg ST-07 lv' } );
	await openPost( admin, editor, postId );
	logWrites( page );
	await switchIntent( page, 'Suggesting' );
	await pageUtils.pressKeys( 'access+o' );
	const lv = page.getByRole( 'treegrid', { name: 'Block navigation structure' } );
	await lv.waitFor();
	await lv.getByRole( 'link' ).nth( 0 ).click();
	await lv.getByRole( 'link' ).nth( 2 ).click( { modifiers: [ 'Shift' ] } );
	const ms = await page.evaluate( () => {
		const s = ( window as any ).wp.data.select( 'core/block-editor' );
		return { multi: s.getMultiSelectedBlockClientIds().length, names: s.getMultiSelectedBlockClientIds().map( ( id: string ) => s.getBlockName( id ) ) };
	} );
	console.log( 'MULTI', JSON.stringify( ms ) );
	await shot( page, 'ST-07-selection' );
	const s = maybeSaved( page, 15000 );
	await page.keyboard.press( 'Backspace' );
	console.log( 'save:', await s );
	await settle( page, 4000 );
	await dump( 'ST-07 list view', { page, editor, requestUtils, postId } );
	await shot( page, 'ST-07-remove-multi-block' );
} );
