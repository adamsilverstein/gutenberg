import { test } from '@wordpress/e2e-test-utils-playwright';
import { seedPost, openPost, collectConsole, suggestionSaved, openNotesSidebar, getMarkers, getNotes, getBlocks } from '../../helpers';
import { snap, savePost, reload, rawContent, suggest, switchIntent, shot, P, flat, threads } from './lib';

const paras = ( n: number ) =>
	Array.from( { length: n }, ( _, i ) => `<!-- wp:paragraph -->\n<p>Para ${ String( i ).padStart( 3, '0' ) } alpha beta gamma delta epsilon.</p>\n<!-- /wp:paragraph -->` ).join( '\n\n' );
const para = ( editor: any, i: number ) => editor.canvas.locator( '[data-type="core/paragraph"]' ).filter( { hasText: `Para ${ String( i ).padStart( 3, '0' ) }` } ).first();

async function typingLatency( page: any, editor: any, text: string ) {
	const times: number[] = [];
	for ( const ch of text ) {
		const t0 = Date.now();
		await page.keyboard.press( ch );
		await editor.canvas.locator( 'body' ).evaluate( () => new Promise( ( r ) => requestAnimationFrame( () => requestAnimationFrame( () => r( null ) ) ) ) );
		times.push( Date.now() - t0 );
	}
	times.sort( ( a, b ) => a - b );
	return { n: times.length, median: times[ Math.floor( times.length / 2 ) ], max: times[ times.length - 1 ], mean: Math.round( times.reduce( ( a, b ) => a + b, 0 ) / times.length ) };
}

test( 'EX-01 many suggestions', async ( { admin, editor, page, requestUtils } ) => {
	test.setTimeout( 420000 );
	const errors = collectConsole( page );
	const content = '<!-- wp:heading -->\n<h2 class="wp-block-heading">Many suggestions</h2>\n<!-- /wp:heading -->\n\n' + paras( 34 );
	// Baseline: same content, first suggestion.
	const basePost = await seedPost( requestUtils, { title: 'ko EX-01 baseline', content } );
	await openPost( admin, editor, basePost );
	await switchIntent( page, 'Suggesting' );
	await para( editor, 33 ).click();
	await page.keyboard.press( 'End' );
	let saved = suggestionSaved( page );
	const base = await typingLatency( page, editor, 'abcdefghijklmnopqrst' );
	await saved;
	console.log( 'LATENCY baseline (0 other suggestions)', JSON.stringify( base ) );
	await savePost( page, basePost );

	const postId = await seedPost( requestUtils, { title: 'ko EX-01', content } );
	const ctx = { page, editor, requestUtils };
	await openPost( admin, editor, postId );
	await switchIntent( page, 'Suggesting' );
	saved = suggestionSaved( page );
	await editor.canvas.locator( '[data-type="core/heading"]' ).first().click();
	await page.getByRole( 'toolbar', { name: 'Block tools' } ).getByRole( 'button', { name: /^Heading 2$/ } ).click();
	await page.getByRole( 'menuitem', { name: /^Heading 3/ } ).click();
	await saved; await page.waitForTimeout( 500 );
	for ( let i = 0; i < 30; i++ ) {
		saved = suggestionSaved( page );
		await para( editor, i ).click();
		if ( i % 3 === 0 ) {
			await page.keyboard.press( 'End' );
			await page.keyboard.type( ` ADD${ i }`, { delay: 15 } );
		} else if ( i % 3 === 1 ) {
			await page.keyboard.press( 'End' );
			await page.keyboard.press( 'Shift+Alt+ArrowLeft' );
			await page.keyboard.press( 'Backspace' );
		} else {
			await page.keyboard.press( 'Home' );
			await page.keyboard.press( 'Shift+Alt+ArrowRight' );
			await page.keyboard.press( 'ControlOrMeta+b' );
		}
		await saved.catch( ( e: any ) => console.log( 'SAVE WAIT FAILED at', i, e.message.slice( 0, 80 ) ) );
		await page.waitForTimeout( 250 );
	}
	// structural: remove 30, insert after 31, heading level
	saved = suggestionSaved( page );
	await para( editor, 30 ).click();
	await editor.clickBlockOptionsMenuItem( 'Delete' );
	await saved; await page.waitForTimeout( 400 );
	saved = suggestionSaved( page );
	await para( editor, 31 ).click();
	await page.keyboard.press( 'End' );
	await page.keyboard.press( 'Enter' );
	await page.keyboard.type( 'INSERTED BLOCK', { delay: 15 } );
	await saved; await page.waitForTimeout( 400 );
	await page.waitForTimeout( 1500 );

	const counts = async ( label: string ) => {
		const markers = await getMarkers( editor );
		const notes = await getNotes( requestUtils, postId );
		const blocks = await getBlocks( page );
		const t = await threads( page );
		const byType: Record< string, number > = {};
		markers.forEach( ( m: any ) => ( byType[ m.type ] = ( byType[ m.type ] || 0 ) + 1 ) );
		const ids = new Set( markers.map( ( m: any ) => m.id ) );
		console.log( label, JSON.stringify( { markers: markers.length, distinctMarkerIds: ids.size, byType, structural: blocks.filter( ( b: any ) => b.metadata?.suggestion ).map( ( b: any ) => b.metadata.suggestion.type ), notes: notes.length, noteStatuses: [ ...new Set( notes.map( ( n: any ) => n.status + '/' + ( n.meta?._wp_suggestion_status || '' ) ) ) ], threads: t.length, blocks: blocks.length } ) );
		return t;
	};
	const t = await counts( 'EX-01 COUNTS after 33 suggestions' );
	console.log( 'THREADS sample', JSON.stringify( t.slice( 0, 4 ) ), '...', JSON.stringify( t.slice( -3 ) ) );

	// Latency with 33 pending: fresh location.
	await para( editor, 32 ).click();
	await page.keyboard.press( 'End' );
	saved = suggestionSaved( page );
	const loaded = await typingLatency( page, editor, 'abcdefghijklmnopqrst' );
	await saved;
	console.log( 'LATENCY with 33 pending', JSON.stringify( loaded ) );

	// Sidebar scroll.
	const sidebar = await openNotesSidebar( page );
	const scroll = await sidebar.locator( '.editor-collab-sidebar-panel__thread' ).first().evaluate( ( el ) => {
		let p: any = el.parentElement;
		while ( p ) {
			const s = getComputedStyle( p );
			if ( /(auto|scroll)/.test( s.overflowY ) && p.scrollHeight > p.clientHeight + 5 ) {
				const before = p.scrollTop;
				p.scrollTop = p.scrollHeight;
				return { cls: p.className, scrollHeight: p.scrollHeight, clientHeight: p.clientHeight, before, after: p.scrollTop };
			}
			p = p.parentElement;
		}
		return null;
	} );
	console.log( 'SIDEBAR SCROLL', JSON.stringify( scroll ) );
	await page.waitForTimeout( 500 );
	const last = sidebar.locator( '.editor-collab-sidebar-panel__thread' ).last();
	await last.scrollIntoViewIfNeeded();
	console.log( 'LAST THREAD visible', await last.isVisible(), ( await last.innerText() ).replace( /\s+/g, ' ' ).slice( 0, 120 ) );
	await shot( page, 'EX-01-many-suggestions' );
	const status = await savePost( page, postId );
	await reload( page, editor );
	await counts( `EX-01 COUNTS after save(${ status })+reload` );
	await shot( page, 'EX-01-many-suggestions-reloaded' );
	console.log( 'CONSOLE', JSON.stringify( errors ) );
} );

test( 'EX-02 long document', async ( { admin, editor, page, requestUtils } ) => {
	test.setTimeout( 240000 );
	const errors = collectConsole( page );
	const postId = await seedPost( requestUtils, { title: 'ko EX-02', content: paras( 110 ) } );
	await openPost( admin, editor, postId );
	await switchIntent( page, 'Suggesting' );
	for ( const i of [ 2, 55, 105 ] ) {
		const saved = suggestionSaved( page );
		await para( editor, i ).scrollIntoViewIfNeeded();
		await para( editor, i ).click();
		await page.keyboard.press( 'End' );
		await page.keyboard.type( ` MARK${ i }`, { delay: 20 } );
		await saved;
		await page.waitForTimeout( 400 );
	}
	const markers = await getMarkers( editor );
	console.log( 'MARKERS', JSON.stringify( markers.map( ( m: any ) => m.type + ':' + m.text ) ), 'blocks', ( await getBlocks( page ) ).length, 'notes', ( await getNotes( requestUtils, postId ) ).length );
	const sidebar = await openNotesSidebar( page );
	const where = async ( label: string ) => {
		const sel = await page.evaluate( () => { const s = ( window as any ).wp.data.select( 'core/block-editor' ); const id = s.getSelectedBlockClientId(); return id ? s.getBlockIndex( id ) : null; } );
		const vis = await editor.canvas.locator( 'mark.wp-suggestion-add' ).evaluateAll( ( els ) => els.map( ( el ) => { const r = el.getBoundingClientRect(); return { text: el.textContent, top: Math.round( r.top ), inView: r.top >= 0 && r.bottom <= window.innerHeight }; } ) );
		const scrollY = await editor.canvas.locator( 'body' ).evaluate( () => Math.round( window.scrollY || document.documentElement.scrollTop ) );
		console.log( label, JSON.stringify( { selectedBlockIndex: sel, scrollY, vis } ) );
	};
	// Scroll canvas to top first.
	await editor.canvas.locator( 'body' ).evaluate( () => window.scrollTo( 0, 0 ) );
	await page.waitForTimeout( 400 );
	await where( 'BEFORE click (top)' );
	for ( const i of [ 105, 2, 55 ] ) {
		const thread = sidebar.locator( '.editor-collab-sidebar-panel__thread' ).filter( { hasText: `MARK${ i }` } );
		await thread.scrollIntoViewIfNeeded();
		await thread.click( { position: { x: 20, y: 12 } } );
		await page.waitForTimeout( 1200 );
		await where( `AFTER clicking card MARK${ i }` );
		const back = thread.getByRole( 'button', { name: 'Back to block' } );
		if ( await back.count() ) {
			await editor.canvas.locator( 'body' ).evaluate( () => window.scrollTo( 0, i === 2 ? 99999 : 0 ) ).catch( () => {} );
			await back.focus();
			await page.keyboard.press( 'Enter' );
			await page.waitForTimeout( 1200 );
			await where( `AFTER "Back to block" MARK${ i }` );
		}
		if ( i === 105 ) await shot( page, 'EX-02-long-document' );
	}
	// Reverse: click marker in canvas -> card
	await editor.canvas.locator( 'mark.wp-suggestion-add' ).filter( { hasText: 'MARK55' } ).click();
	await page.waitForTimeout( 1000 );
	const active = await sidebar.locator( '.editor-collab-sidebar-panel__thread' ).evaluateAll( ( els ) => els.map( ( e ) => ( { cls: e.className, text: ( e.textContent || '' ).slice( 0, 60 ) } ) ) );
	console.log( 'THREAD CLASSES after marker click', JSON.stringify( active ) );
	await shot( page, 'EX-02-marker-to-card' );
	console.log( 'CONSOLE', JSON.stringify( errors ) );
} );
