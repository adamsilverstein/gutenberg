import { test } from '@wordpress/e2e-test-utils-playwright';
import { seedPost, openPost, getMarkers, getBlocks } from '../../helpers';
import { shot, P, savePost, reload } from './lib';

const allNotes = async ( requestUtils: any, postId: number ) => {
	const out: string[] = [];
	for ( const status of [ 'hold', 'approve', 'trash' ] ) {
		const n = await requestUtils.rest( { path: '/wp/v2/comments', params: { post: postId, type: 'note', status, per_page: 100, context: 'edit' } } ).catch( () => [] );
		n.forEach( ( x: any ) => out.push( `#${ x.id } ${ x.status }` ) );
	}
	return out;
};

for ( const [ name, delay, pause ] of [ [ 'd10-a', 10, 0 ], [ 'd10-b', 10, 0 ], [ 'd40', 40, 0 ], [ 'd40-pause700', 40, 700 ], [ 'd40-pause2500', 40, 2500 ] ] as [ string, number, number ][] ) {
	test( `EX-09 cycles ${ name }`, async ( { admin, editor, page, requestUtils, pageUtils } ) => {
		const errors: string[] = [];
		page.on( 'pageerror', ( e: any ) => errors.push( e.message ) );
		page.on( 'console', ( m: any ) => m.type() === 'error' && errors.push( m.text() ) );
		page.on( 'response', async ( r: any ) => { if ( /wp\/v2\/comments/.test( r.url() ) && r.request().method() !== 'GET' ) console.log( '   RESP', r.status(), r.request().method(), decodeURIComponent( r.url() ).replace( /.*wp\/v2/, '' ).slice( 0, 30 ), ( r.request().postData() || '' ).replace( /.*"status"/, '"status"' ).slice( 0, 40 ) ); } );
		const postId = await seedPost( requestUtils, { title: `ko EX-09 ${ name }` } );
		await openPost( admin, editor, postId );
		const p = P( editor, 'Third paragraph' );
		await p.click();
		await page.keyboard.press( 'End' );
		for ( let i = 0; i < 3; i++ ) {
			await pageUtils.pressKeys( 'secondary+x' );
			await page.keyboard.type( ` S${ i }s`, { delay } );
			if ( pause ) await page.waitForTimeout( pause );
			await pageUtils.pressKeys( 'secondary+z' );
			await page.keyboard.type( ` E${ i }e`, { delay } );
			if ( pause ) await page.waitForTimeout( pause );
			console.log( `DOM after cycle ${ i }:`, JSON.stringify( ( await p.innerText() ).replace( /.*replacements\./, '…' ) ) );
		}
		await page.waitForTimeout( 6000 );
		const dom = ( await p.innerText() ).replace( /.*replacements\./, '…' );
		const store = ( await getBlocks( page ) )[ 3 ].content.replace( /.*replacements\./, '…' );
		console.log( 'TYPED ORDER: " S0s E0e S1s E1e S2s E2e"' );
		console.log( 'DOM after 6s:', JSON.stringify( dom ) );
		console.log( 'STORE:', store.replace( / data-suggestion-type="add" data-author="1" class="wp-suggestion-add"/g, '' ) );
		const markers = await getMarkers( editor );
		const marked = markers.map( ( m: any ) => m.text ).join( '|' );
		console.log( 'RESULT', JSON.stringify( [ 0, 1, 2 ].map( ( i ) => `S${ i }s:${ marked.includes( `S${ i }s` ) ? 'marker' : dom.includes( `S${ i }s` ) ? 'PLAIN' : 'LOST' } E${ i }e:${ marked.includes( `E${ i }e` ) ? 'MARKER' : dom.includes( `E${ i }e` ) ? 'plain' : 'LOST' }` ) ) );
		console.log( 'NOTES', JSON.stringify( await allNotes( requestUtils, postId ) ) );
		await shot( page, `EX-09-cycles-${ name }` );
		await savePost( page, postId );
		await reload( page, editor );
		console.log( 'AFTER save+reload STORE:', ( await getBlocks( page ) )[ 3 ].content.replace( /.*replacements\./, '…' ).replace( / data-suggestion-type="add" data-author="1" class="wp-suggestion-add"/g, '' ) );
		console.log( 'ERRORS', JSON.stringify( errors ) );
	} );
}
