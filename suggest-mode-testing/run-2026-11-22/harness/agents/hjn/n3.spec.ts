import { test } from '@wordpress/e2e-test-utils-playwright';
import { seedPost, openPost, switchIntent, SCREENSHOT_DIR } from '../../helpers';
import { para, step } from './kit';

test( 'AX-07c pending-remove treatment image vs paragraph', async ( { admin, editor, page, requestUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'hjn AX-07c' } );
	await openPost( admin, editor, postId );
	await page.evaluate( () => ( window as any ).wp.data.dispatch( 'core/interface' ).disableComplementaryArea( 'core' ) );
	await switchIntent( page, 'Suggesting' );
	await step( page, 'remove image', async () => {
		await editor.canvas.getByRole( 'document', { name: 'Block: Image' } ).click();
		await editor.clickBlockOptionsMenuItem( 'Delete' );
	} );
	await step( page, 'remove paragraph', async () => {
		await page.evaluate( () => ( window as any ).wp.data.dispatch( 'core/block-editor' ).clearSelectedBlock() );
		await para( editor, 'Fourth paragraph' ).click();
		await editor.clickBlockOptionsMenuItem( 'Delete' );
	} );
	await page.evaluate( () => ( window as any ).wp.data.dispatch( 'core/block-editor' ).clearSelectedBlock() );
	await page.mouse.move( 5, 500 );
	await page.waitForTimeout( 1500 );
	const info = await editor.canvas.locator( 'body' ).evaluate( ( body: HTMLElement ) => {
		const w = body.ownerDocument.defaultView!;
		const pick = ( el: Element, pseudo?: string ) => { const cs = w.getComputedStyle( el, pseudo ); return { content: pseudo ? cs.content.slice( 0, 40 ) : undefined, opacity: cs.opacity, filter: cs.filter, outline: `${ cs.outlineStyle } ${ cs.outlineWidth } ${ cs.outlineColor }`, border: `${ cs.borderTopStyle } ${ cs.borderTopWidth }`, boxShadow: cs.boxShadow, bg: cs.backgroundColor, deco: cs.textDecorationLine, color: cs.color, display: cs.display, position: cs.position }; };
		return Array.from( body.querySelectorAll( '.is-suggestion-pending-remove' ) ).map( ( el ) => ( { tag: el.tagName, self: pick( el ), before: pick( el, '::before' ), after: pick( el, '::after' ), img: el.querySelector( 'img' ) ? pick( el.querySelector( 'img' )! ) : null, childClasses: Array.from( el.children ).map( ( c ) => c.tagName + '.' + c.className ) } ) );
	} );
	console.log( 'PENDING-REMOVE STYLES', JSON.stringify( info, null, 1 ) );
	const img = editor.canvas.locator( 'figure.is-suggestion-pending-remove' );
	await img.scrollIntoViewIfNeeded();
	await page.waitForTimeout( 400 );
	await page.screenshot( { path: `${ SCREENSHOT_DIR }/AX-07-pending-remove-image-vs-paragraph.png` } );
} );
