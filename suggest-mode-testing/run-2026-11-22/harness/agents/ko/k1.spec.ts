import { test } from '@wordpress/e2e-test-utils-playwright';
import { seedPost, openPost, collectConsole } from '../../helpers';
import { snap, decide, savePost, reload, rawContent, suggest, switchIntent, shot, Kind } from './lib';

const flows: [ string, Kind, 'Accept' | 'Reject', string ][] = [
	[ 'RV-01', 'add', 'Accept', 'accept-addition' ],
	[ 'RV-02', 'del', 'Accept', 'accept-deletion' ],
	[ 'RV-03', 'format', 'Accept', 'accept-format' ],
	[ 'RV-04', 'insert', 'Accept', 'accept-insert' ],
	[ 'RV-05', 'remove', 'Accept', 'accept-remove' ],
	[ 'RV-06', 'move', 'Accept', 'accept-move' ],
	[ 'RV-07', 'attr', 'Accept', 'accept-attribute' ],
	[ 'RV-08', 'add', 'Reject', 'reject-addition' ],
	[ 'RV-09', 'del', 'Reject', 'reject-deletion' ],
	[ 'RV-10', 'format', 'Reject', 'reject-format' ],
	[ 'RV-11', 'insert', 'Reject', 'reject-insert' ],
	[ 'RV-12', 'remove', 'Reject', 'reject-remove' ],
	[ 'RV-13', 'move', 'Reject', 'reject-move' ],
	[ 'RV-15', 'attr', 'Reject', 'reject-attribute' ],
];

for ( const [ id, kind, action, slug ] of flows ) {
	test( `${ id } ${ slug }`, async ( { admin, editor, page, requestUtils } ) => {
		const errors = collectConsole( page );
		const postId = await seedPost( requestUtils, { title: `ko ${ id }` } );
		const ctx = { page, editor, requestUtils };
		const pristine = await rawContent( requestUtils, postId );
		await openPost( admin, editor, postId );
		const pristineSerialized = await editor.getEditedPostContent();
		await switchIntent( page, 'Suggesting' );
		await suggest( kind, ctx );
		await snap( `${ id } pending`, ctx, postId );
		await switchIntent( page, 'Editing' );
		await decide( page, action );
		await page.waitForTimeout( 1200 );
		await snap( `${ id } after ${ action } (unsaved)`, ctx, postId );
		const after = await editor.getEditedPostContent();
		console.log( 'SERIALIZED==PRISTINE(editor)', after === pristineSerialized, 'hasSuggestionMarkup', /wp-suggestion|"suggestion"|data-suggestion/.test( after ) );
		await shot( page, `${ id }-${ slug }` );
		await savePost( page, postId );
		await reload( page, editor );
		await snap( `${ id } after save+reload`, ctx, postId );
		const raw = await rawContent( requestUtils, postId );
		console.log( 'RAW==PRISTINE', raw === pristine, 'hasSuggestionMarkup', /wp-suggestion|"suggestion"|data-suggestion|noteId/.test( raw ) );
		console.log( 'RAW', raw.slice( 0, 900 ) );
		await shot( page, `${ id }-${ slug }-saved` );
		console.log( 'CONSOLE', JSON.stringify( errors ) );
	} );
}
