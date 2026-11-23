import { test } from '@wordpress/e2e-test-utils-playwright';
import { shot, collectConsole } from '../../helpers';
import { log, savePost, blocksOf, markersIn } from './lib';
import { newPost, adminOpen, gesture, report, cards, compact } from './plib';

test.describe( 'P single user', () => {
	test( 'OV-01 add inside own add', async ( { admin, editor, page, requestUtils } ) => {
		const err = collectConsole( page );
		const id = await newPost( requestUtils, 'OV-01' );
		await adminOpen( { admin, editor, page }, id );
		await gesture( page, 'OV-01 first add', 'brown', 'start', () => page.keyboard.type( 'ALPHA BETA ', { delay: 20 } ) );
		await gesture( page, 'OV-01 add inside own', 'BETA', 'start', () => page.keyboard.type( 'MID ', { delay: 20 } ) );
		await report( page, requestUtils, id, 'OV-01' );
		await cards( page, 'OV-01' );
		await shot( page, 'OV-01-add-inside-own-add' );
		log( 'OV-01 save', await savePost( page ) );
		await page.reload();
		await editor.canvas.locator( '.is-root-container' ).first().waitFor();
		await page.waitForTimeout( 1500 );
		log( 'OV-01 after reload', compact( await markersIn( page ) ) );
		log( 'OV-01 console', err );
	} );

	test( 'OV-02 delete inside own add', async ( { admin, editor, page, requestUtils } ) => {
		const id = await newPost( requestUtils, 'OV-02' );
		await adminOpen( { admin, editor, page }, id );
		await gesture( page, 'OV-02 first add', 'brown', 'start', () => page.keyboard.type( 'ALPHA BETA GAMMA ', { delay: 20 } ) );
		await gesture( page, 'OV-02 delete inside own', 'BETA ', undefined, () => page.keyboard.press( 'Backspace' ) );
		await report( page, requestUtils, id, 'OV-02' );
		await cards( page, 'OV-02' );
		await shot( page, 'OV-02-delete-inside-own-add' );
	} );

	test( 'OV-03 delete spanning own add and original', async ( { admin, editor, page, requestUtils } ) => {
		const id = await newPost( requestUtils, 'OV-03' );
		await adminOpen( { admin, editor, page }, id );
		await gesture( page, 'OV-03 first add', 'brown', 'start', () => page.keyboard.type( 'ALPHA BETA ', { delay: 20 } ) );
		await gesture( page, 'OV-03 delete spanning', 'BETA brown fox', undefined, () => page.keyboard.press( 'Backspace' ) );
		await report( page, requestUtils, id, 'OV-03' );
		await cards( page, 'OV-03' );
		await shot( page, 'OV-03-delete-spanning-own-add-and-original' );
	} );

	test( 'OV-04 format over own add', async ( { admin, editor, page, pageUtils, requestUtils } ) => {
		const id = await newPost( requestUtils, 'OV-04' );
		await adminOpen( { admin, editor, page }, id );
		await gesture( page, 'OV-04 first add', 'brown', 'start', () => page.keyboard.type( 'ALPHA BETA ', { delay: 20 } ) );
		await gesture( page, 'OV-04 bold inside own add', 'BETA', undefined, () => pageUtils.pressKeys( 'primary+b' ) );
		await report( page, requestUtils, id, 'OV-04 inside' );
		await gesture( page, 'OV-04 italic across edge', 'ALPHA BETA brown', undefined, () => pageUtils.pressKeys( 'primary+i' ) );
		await report( page, requestUtils, id, 'OV-04 across' );
		await cards( page, 'OV-04' );
		await shot( page, 'OV-04-format-over-own-add' );
	} );

	test( 'OV-05 format over own delete', async ( { admin, editor, page, pageUtils, requestUtils } ) => {
		const id = await newPost( requestUtils, 'OV-05' );
		await adminOpen( { admin, editor, page }, id );
		await gesture( page, 'OV-05 delete', 'lazy dog', undefined, () => page.keyboard.press( 'Backspace' ) );
		await gesture( page, 'OV-05 bold over own del', 'lazy', undefined, () => pageUtils.pressKeys( 'primary+b' ) );
		await report( page, requestUtils, id, 'OV-05 inside' );
		await gesture( page, 'OV-05 type inside own del', 'dog', 'start', () => page.keyboard.type( 'X', { delay: 20 } ) );
		await report( page, requestUtils, id, 'OV-05 typed' );
		const c = await cards( page, 'OV-05' );
		await shot( page, 'OV-05-format-over-own-delete' );
		log( 'OV-05 block', ( await blocksOf( page ) )[ 0 ] );
	} );
} );
