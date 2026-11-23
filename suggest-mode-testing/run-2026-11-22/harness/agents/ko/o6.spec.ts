import { test } from '@wordpress/e2e-test-utils-playwright';
import { seedPost, openPost, getMarkers, getBlocks } from '../../helpers';
import { switchIntent, shot, P } from './lib';

const allNotes = async ( requestUtils: any, postId: number ) => {
	const out: string[] = [];
	for ( const status of [ 'hold', 'approve', 'trash' ] ) {
		const n = await requestUtils.rest( { path: '/wp/v2/comments', params: { post: postId, type: 'note', status, per_page: 100, context: 'edit' } } ).catch( () => [] );
		n.forEach( ( x: any ) => out.push( `#${ x.id } ${ x.status }` ) );
	}
	return out;
};

for ( const [ name, gap, how ] of [ [ 'gap0-shortcut', 0, 'shortcut' ], [ 'gap400-shortcut', 400, 'shortcut' ], [ 'gap1500-shortcut', 1500, 'shortcut' ], [ 'gap0-menu', 0, 'menu' ], [ 'gap0-shortcut-notyping', 0, 'shortcut-idle' ] ] as [ string, number, string ][] ) {
	test( `EX-09 minimal ${ name }`, async ( { admin, editor, page, requestUtils, pageUtils } ) => {
		const errors: string[] = [];
		page.on( 'pageerror', ( e: any ) => errors.push( e.message ) );
		page.on( 'console', ( m: any ) => m.type() === 'error' && errors.push( m.text() ) );
		page.on( 'response', async ( r: any ) => { if ( /wp\/v2\/comments/.test( r.url() ) && r.request().method() !== 'GET' ) console.log( '   RESP', r.status(), r.request().method(), decodeURIComponent( r.url() ).replace( /.*wp\/v2/, '' ).slice( 0, 40 ), ( r.request().postData() || '' ).slice( 0, 60 ) ); } );
		const postId = await seedPost( requestUtils, { title: `ko EX-09 ${ name }` } );
		await openPost( admin, editor, postId );
		const p = P( editor, 'Third paragraph' );
		await p.click();
		await page.keyboard.press( 'End' );
		await pageUtils.pressKeys( 'secondary+x' );
		await page.keyboard.type( ' SUGGESTED', { delay: 30 } );
		console.log( 'DOM right after typing:', JSON.stringify( await p.innerText() ) );
		if ( gap ) await page.waitForTimeout( gap );
		if ( how === 'menu' ) {
			await switchIntent( page, 'Editing' );
		} else {
			await pageUtils.pressKeys( 'secondary+z' );
		}
		if ( how !== 'shortcut-idle' ) {
			await page.keyboard.type( ' EDITED', { delay: 30 } );
		}
		console.log( 'DOM right after switch (+typing):', JSON.stringify( await p.innerText() ) );
		await page.waitForTimeout( 5000 );
		console.log( 'DOM after 5s:', JSON.stringify( await p.innerText() ) );
		console.log( 'STORE:', ( await getBlocks( page ) )[ 3 ].content );
		console.log( 'MARKERS', JSON.stringify( ( await getMarkers( editor ) ).map( ( m: any ) => `${ m.type }#${ m.id } ${ JSON.stringify( m.text ) }` ) ) );
		console.log( 'NOTES', JSON.stringify( await allNotes( requestUtils, postId ) ) );
		console.log( 'SNACK', JSON.stringify( await page.locator( '.components-snackbar' ).allInnerTexts() ) );
		await shot( page, `EX-09-minimal-${ name }` );
		console.log( 'ERRORS', JSON.stringify( errors ) );
	} );
}
