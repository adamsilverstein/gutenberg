import { test } from '@wordpress/e2e-test-utils-playwright';
import { seedPost, openPost, switchIntent, shot, USERS, collectConsole } from '../../helpers';
import { log, takeOver, openAs, markersIn, blocksOf, selectIn, focusBlock, withSave, savePost, snackbars, notesFull, sidebarCards } from './lib';

test( 'MU-08 concurrent sessions', async ( { admin, editor, page, requestUtils, browser } ) => {
	const postId = await seedPost( requestUtils, { title: 'lmp MU-08' } );
	log( 'POST', postId );
	const err = collectConsole( page );
	// A = admin opens first and stays open.
	await openPost( admin, editor, postId );
	await switchIntent( page, 'Suggesting' );
	log( 'A blocks at open', ( await blocksOf( page ) ).length );
	// B = editor opens, takes over, suggests, saves.
	const b = await openAs( browser, USERS.editor, postId );
	log( 'B lock dialog', b.lock );
	await switchIntent( b.page, 'Suggesting' );
	await focusBlock( b.page, 1 );
	await selectIn( b.page, 1, 'brown', 'start' );
	log( 'B add', ( await withSave( b.page, () => b.page.keyboard.type( 'BSAYS ', { delay: 20 } ) ) )?.status );
	log( 'B save', await savePost( b.page ) );
	log( 'B blocks', ( await blocksOf( b.page ) ).length );
	await shot( b.page, 'MU-08-user-b-session' );
	// A, stale, suggests right away and saves.
	log( 'A modals before edit', await page.locator( '.components-modal__frame' ).allInnerTexts() );
	await focusBlock( page, 3 ).catch( ( e ) => log( 'A focus failed', String( e ).slice( 0, 200 ) ) );
	await selectIn( page, 3, 'plain', 'start' );
	log( 'A add', ( await withSave( page, () => page.keyboard.type( 'ASAYS ', { delay: 20 } ) ) )?.status );
	log( 'A blocks after edit', ( await blocksOf( page ) ).map( ( x: any ) => [ x.name, x.metadata?.suggestion?.type ?? null, ( x.content || '' ).slice( 0, 30 ) ] ) );
	log( 'A save', await savePost( page ) );
	log( 'A snack', await snackbars( page ) );
	await page.waitForTimeout( 2000 );
	const blocks = await blocksOf( page );
	log( 'A blocks after save', blocks.map( ( x: any ) => [ x.name, x.metadata?.suggestion?.type ?? null, ( x.content || '' ).slice( 0, 60 ) ] ) );
	log( 'A markers', await markersIn( page ) );
	log( 'A modals after save', await page.locator( '.components-modal__frame' ).allInnerTexts() );
	await shot( page, 'MU-08-concurrent-sessions' );
	const notes = await notesFull( requestUtils, postId );
	log( 'NOTES', notes.map( ( n: any ) => [ n.id, n.author, n.status, n.ops, n.sstatus ] ) );
	const server = await requestUtils.rest( { path: `/wp/v2/posts/${ postId }`, params: { context: 'edit' } } );
	const raw = server.content.raw as string;
	log( 'SERVER', { blocks: ( raw.match( /<!-- wp:(?!list-item)[a-z]/g ) || [] ).length, BSAYS: ( raw.match( /BSAYS/g ) || [] ).length, ASAYS: ( raw.match( /ASAYS/g ) || [] ).length, marks: ( raw.match( /<mark /g ) || [] ).length } );
	log( 'SERVER p1', raw.split( '\n' ).filter( ( l ) => /quick|Third/.test( l ) ) );
	// Wait for heartbeat to tell either session about the lock.
	for ( let i = 0; i < 8; i++ ) {
		await page.waitForTimeout( 10000 );
		const am = await page.locator( '.components-modal__frame' ).allInnerTexts();
		const bm = await b.page.locator( '.components-modal__frame' ).allInnerTexts();
		if ( bm.length || i === 7 ) {
			log( `lock modal after ${ ( i + 1 ) * 10 }s`, { A: am, B: bm } );
			await shot( b.page, 'MU-08-lock-takeover-notice' );
			break;
		}
	}
	// B reloads: sees both?
	await b.page.reload();
	await b.canvas.locator( '.is-root-container' ).first().waitFor();
	await takeOver( b.page );
	log( 'B after reload markers', await markersIn( b.page ) );
	log( 'B after reload blocks', ( await blocksOf( b.page ) ).length );
	log( 'A console', err );
	await b.context.close();
} );
