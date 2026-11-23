import { test } from '@wordpress/e2e-test-utils-playwright';
import { shot, collectConsole, USERS } from '../../helpers';
import { log, savePost, blocksOf, selectIn, snackbars } from './lib';
import { newPost, adminOpen, gesture, report, session, spoken } from './plib';

test( 'OV-13 refusals', async ( { admin, editor, page, pageUtils, requestUtils, browser } ) => {
	const err = collectConsole( page );
	const id = await newPost( requestUtils, 'OV-13' );
	log( 'POST', id );
	const ed = await session( browser, USERS.editor );
	await ed.open( id );
	await gesture( ed.page, 'ed add', 'brown', 'start', () => ed.page.keyboard.type( 'EDITOR SENTENCE HERE ', { delay: 20 } ) );
	await gesture( ed.page, 'ed del', 'lazy dog', undefined, () => ed.page.keyboard.press( 'Backspace' ) );
	await gesture( ed.page, 'ed bold', 'riverbank', undefined, () => ed.page.keyboard.press( 'ControlOrMeta+b' ) );
	log( 'ed save', await savePost( ed.page ) );
	await ed.context.close();

	await adminOpen( { admin, editor, page }, id );
	await gesture( page, 'admin own add', 'jumps', 'start', () => page.keyboard.type( 'OWN WORDS ', { delay: 20 } ) );
	const state = async () => ( {
		blocks: ( await blocksOf( page ) ).map( ( b: any ) => `${ b.metadata?.suggestion?.type ?? '-' }:${ ( b.content || '' ).replace( /<[^>]+>/g, '' ).slice( 0, 40 ) }` ),
		snack: await snackbars( page ),
		notices: await page.evaluate( () => ( window as any ).wp.data.select( 'core/notices' ).getNotices().map( ( n: any ) => `${ n.status }/${ n.type }/${ n.id }: ${ n.content }` ) ),
		spoken: await spoken( page ),
	} );
	const tryEnter = async ( label: string, needle: string, shotName?: string ) => {
		await selectIn( page, 0, needle, 'start' );
		await page.keyboard.press( 'Enter' );
		await page.waitForTimeout( 1200 );
		log( `OV-13 Enter ${ label }`, await state() );
		if ( shotName ) {
			await shot( page, shotName );
		}
		await page.waitForTimeout( 2500 );
	};
	await tryEnter( "inside editor's add (caret before SENTENCE)", 'SENTENCE', 'OV-13-enter-inside-others-add' );
	await tryEnter( "inside editor's deletion (caret before dog)", 'dog' );
	await tryEnter( "inside editor's format (caret mid riverbank)", 'bank' );
	await tryEnter( 'inside own add (caret before WORDS)', 'WORDS', 'OV-13-enter-inside-own-add' );
	await report( page, requestUtils, id, 'OV-13 after own-add Enter' );
	await pageUtils.pressKeys( 'primary+z' );
	await page.waitForTimeout( 800 );
	log( 'after undo', await state() );
	await tryEnter( 'in plain text of a paragraph holding others markers (caret before near)', 'near', 'OV-13-enter-in-plain-text' );
	await report( page, requestUtils, id, 'OV-13 after plain Enter' );
	log( 'block1', ( await blocksOf( page ) )[ 1 ] );
	log( 'console', err );
} );
