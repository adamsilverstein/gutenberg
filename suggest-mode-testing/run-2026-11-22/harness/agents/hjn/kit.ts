import type { Page } from '@playwright/test';
import { suggestionSaved, switchIntent, openNotesSidebar } from '../../helpers';

export const para = ( editor: any, text: string ) =>
	editor.canvas
		.getByRole( 'document', { name: 'Block: Paragraph' } )
		.filter( { hasText: text } );

export async function summaries( page: Page ) {
	const sidebar = await openNotesSidebar( page );
	await page.waitForTimeout( 500 );
	return sidebar
		.locator( '.editor-collab-sidebar-panel__suggestion-summary' )
		.allInnerTexts();
}

const desel = ( page: Page ) =>
	page.evaluate( () => ( window as any ).wp.data.dispatch( 'core/block-editor' ).clearSelectedBlock() );

export async function step( page: Page, label: string, fn: () => Promise< void > ) {
	const saved = suggestionSaved( page ).then(
		() => 'saved',
		( e ) => 'NO-SAVE ' + String( e ).slice( 0, 80 )
	);
	try {
		await fn();
	} catch ( e ) {
		console.log( 'STEP', label, 'GESTURE-ERROR', String( e ).slice( 0, 300 ) );
	}
	console.log( 'STEP', label, await saved );
	await page.waitForTimeout( 600 );
}

/** Makes one suggestion of each kind on the seed post, by gesture. */
export async function allKinds( page: Page, editor: any, pageUtils: any, kinds?: string[] ) {
	const want = ( k: string ) => ! kinds || kinds.includes( k );
	await switchIntent( page, 'Suggesting' );
	if ( want( 'add' ) ) {
		await step( page, 'add', async () => {
			await desel( page );
			await para( editor, 'quick brown fox' ).click();
			await page.keyboard.press( 'End' );
			await page.keyboard.type( ' ADDEDTEXT', { delay: 20 } );
		} );
	}
	if ( want( 'del' ) ) {
		await step( page, 'del', async () => {
			await desel( page );
			await para( editor, 'Third paragraph' ).click();
			await page.keyboard.press( 'End' );
			await pageUtils.pressKeys( 'shift+ArrowLeft', { times: 13 } );
			await page.keyboard.press( 'Backspace' );
		} );
	}
	if ( want( 'format' ) ) {
		await step( page, 'format', async () => {
			await desel( page );
			await para( editor, 'Fourth paragraph' ).click();
			await page.keyboard.press( 'End' );
			await pageUtils.pressKeys( 'shift+ArrowLeft', { times: 5 } );
			await pageUtils.pressKeys( 'primary+b' );
		} );
	}
	if ( want( 'insert' ) ) {
		await step( page, 'insert', async () => {
			await desel( page );
			await para( editor, 'A second paragraph' ).click();
			await page.keyboard.press( 'End' );
			await page.keyboard.press( 'Enter' );
			await page.keyboard.type( 'INSERTED BLOCK', { delay: 20 } );
		} );
	}
	if ( want( 'remove' ) ) {
		await step( page, 'remove', async () => {
			await editor.canvas.getByRole( 'document', { name: 'Block: Image' } ).click();
			await editor.clickBlockOptionsMenuItem( 'Delete' );
		} );
	}
	if ( want( 'move' ) ) {
		await step( page, 'move', async () => {
			await editor.selectBlocks(
				editor.canvas.getByRole( 'document', { name: 'Block: List', exact: true } )
			);
			await editor.clickBlockToolbarButton( 'Move up' );
		} );
	}
	if ( want( 'attr' ) ) {
		await step( page, 'attr', async () => {
			await editor.canvas.getByRole( 'document', { name: 'Block: Heading' } ).click();
			await page
				.getByRole( 'toolbar', { name: 'Block tools' } )
				.getByRole( 'button', { name: /^Heading 2$/ } )
				.click();
			await page.getByRole( 'menuitem', { name: /^Heading 4/ } ).click();
		} );
	}
}

export async function treatments( editor: any ) {
	return editor.canvas.locator( 'body' ).evaluate( ( body: HTMLElement ) =>
		Array.from( body.querySelectorAll( '[class*="is-suggestion-"]' ) ).map( ( el ) => ( {
			tag: el.tagName.toLowerCase(),
			cls: Array.from( el.classList ).filter( ( c ) => c.includes( 'suggestion' ) ).join( ' ' ),
			text: ( el.textContent || '' ).slice( 0, 40 ),
		} ) )
	);
}

export function sugMeta( blocks: any[] ): any[] {
	const out: any[] = [];
	const walk = ( bs: any[] ) =>
		bs.forEach( ( b ) => {
			if ( b.metadata?.suggestion || b.metadata?.noteId ) {
				out.push( { name: b.name, content: ( b.content || '' ).slice( 0, 60 ), metadata: b.metadata } );
			}
			walk( b.innerBlocks || [] );
		} );
	walk( blocks );
	return out;
}
