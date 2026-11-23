import type { Page } from '@playwright/test';

export const log = ( label: string, value: unknown ) =>
	console.log( `>>> ${ label }: ${ typeof value === 'string' ? value : JSON.stringify( value ) }` );

export async function notices( page: Page ) {
	return page.evaluate( () =>
		( window as any ).wp.data
			.select( 'core/notices' )
			.getNotices()
			.map( ( n: any ) => ( { id: n.id, type: n.type, content: n.content } ) )
	);
}

export async function intent( page: Page ) {
	return page.evaluate( () => {
		const w = window as any;
		const sel = w.wp.data.select( 'core/editor' );
		let value: any = 'n/a';
		try {
			value = sel.getEditorIntent ? sel.getEditorIntent() : 'no public selector';
		} catch ( e ) {
			value = 'err';
		}
		return value;
	} );
}

export async function openOptions( page: Page ) {
	const item = page.getByRole( 'menuitemradio', { name: /^Suggesting/ } );
	if ( await item.isVisible().catch( () => false ) ) {
		return;
	}
	await page
		.getByRole( 'region', { name: 'Editor top bar' } )
		.getByRole( 'button', { name: 'Options' } )
		.click();
	await page.getByRole( 'menuitemradio', { name: /^Visual editor/ } ).waitFor();
}

export async function modeMenu( page: Page ) {
	await openOptions( page );
	return page.evaluate( () =>
		Array.from( document.querySelectorAll( '[role="menuitemradio"]' ) ).map( ( i ) => ( {
			text: ( i as HTMLElement ).innerText.replace( /\s+/g, ' ' ).trim().slice( 0, 60 ),
			checked: i.getAttribute( 'aria-checked' ),
			ariaDisabled: i.getAttribute( 'aria-disabled' ),
			disabled: ( i as HTMLButtonElement ).disabled,
		} ) )
	);
}

export async function menuSnapshot( page: Page ) {
	return page.evaluate( () =>
		Array.from( document.querySelectorAll( '[role="menu"] [role="group"]' ) ).map( ( g ) => ( {
			group: g.getAttribute( 'aria-label' ),
			items: Array.from( g.querySelectorAll( '[role^="menuitem"]' ) ).map( ( i ) => ( {
				text: ( i as HTMLElement ).innerText.replace( /\s+/g, ' ' ).trim(),
				role: i.getAttribute( 'role' ),
				checked: i.getAttribute( 'aria-checked' ),
				disabled: i.getAttribute( 'aria-disabled' ) ?? ( i as HTMLButtonElement ).disabled,
			} ) ),
		} ) )
	);
}

export async function shortcutCombos( page: Page, names: string[] ) {
	return page.evaluate( ( n ) => {
		const sel = ( window as any ).wp.data.select( 'core/keyboard-shortcuts' );
		return Object.fromEntries(
			n.map( ( name ) => [ name, { combos: sel.getAllShortcutKeyCombinations( name ), description: sel.getShortcutDescription( name ) } ] )
		);
	}, names );
}

export async function editableCount( editor: any ) {
	return editor.canvas.locator( '[contenteditable="true"]' ).count();
}

/** Place a collapsed caret at a character offset of a block's rich text, via DOM click + keyboard. */
export async function caretAt( page: Page, editor: any, blockIndex: number, offset: number ) {
	const p = editor.canvas.locator( '[data-type="core/paragraph"]' ).nth( blockIndex );
	await p.click();
	await page.keyboard.press( 'Meta+ArrowUp' );
	await page.keyboard.press( 'Home' );
	for ( let i = 0; i < offset; i++ ) {
		await page.keyboard.press( 'ArrowRight' );
	}
	return p;
}

export async function selectionInfo( editor: any ) {
	return editor.canvas.locator( 'body' ).evaluate( ( body: HTMLElement ) => {
		const s = body.ownerDocument.defaultView!.getSelection()!;
		return { text: s.toString(), collapsed: s.isCollapsed, anchorOffset: s.anchorOffset, anchorText: s.anchorNode?.textContent?.slice( 0, 80 ) };
	} );
}

export const brief = ( markers: any[] ) => markers.map( ( m ) => `${ m.tag }.${ m.className }#${ m.id }[${ m.type }]="${ m.text }"` );

export const briefNotes = ( notes: any[] ) =>
	notes.map( ( n ) => ( { id: n.id, parent: n.parent, status: n.status, content: n.content, meta: n.meta } ) );
