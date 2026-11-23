import { test } from '@wordpress/e2e-test-utils-playwright';
import { seedPost, openPost, getMarkers, getBlocks, getNotes, shot, collectConsole } from '../../helpers';
import { allKinds, summaries, treatments, sugMeta } from './kit';

test( 'NS-01 summary prefixes', async ( { admin, editor, page, pageUtils, requestUtils } ) => {
	const errors = collectConsole( page );
	const postId = await seedPost( requestUtils, { title: 'hjn NS-01' } );
	await openPost( admin, editor, postId );
	await allKinds( page, editor, pageUtils );
	console.log( 'POST', postId );
	console.log( 'MARKERS', JSON.stringify( await getMarkers( editor ) ) );
	console.log( 'TREAT', JSON.stringify( await treatments( editor ) ) );
	console.log( 'META', JSON.stringify( sugMeta( await getBlocks( page ) ) ) );
	console.log( 'SUMMARIES', JSON.stringify( await summaries( page ) ) );
	const notes = await getNotes( requestUtils, postId );
	console.log( 'NOTES', notes.length, JSON.stringify( notes ).slice( 0, 3000 ) );
	console.log( 'ERRORS', JSON.stringify( errors ) );
	await shot( page, 'NS-01-summary-prefixes' );
} );
