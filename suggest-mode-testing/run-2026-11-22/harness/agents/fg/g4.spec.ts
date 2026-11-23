import { test } from '@wordpress/e2e-test-utils-playwright';
import { seedPost, openPost, switchIntent, shot, getBlocks } from '../../helpers';
import { maybeSaved, logWrites, para, settle, allNotes, summaries } from './util';

const settingsRegion = ( page: any ) => page.getByRole( 'region', { name: 'Editor settings' } );

async function state( label: string, page: any, editor: any, requestUtils: any, postId: number ) {
	const b = ( await getBlocks( page ) )[ 1 ];
	const dom = await para( editor, 0 ).evaluate( ( el: HTMLElement ) => ( { cls: Array.from( el.classList ).filter( ( c ) => /^has-|suggest/.test( c ) ).join( ' ' ), color: getComputedStyle( el ).color, fs: getComputedStyle( el ).fontSize, ta: getComputedStyle( el ).textAlign } ) );
	const notes = await allNotes( requestUtils, postId );
	console.log( `[${ label }] PENDING`, JSON.stringify( b.metadata ), '| ATTRS', JSON.stringify( b.attributes ), '| DOM', JSON.stringify( dom ) );
	for ( const n of notes ) {
		console.log( `[${ label }] NOTE ${ n.id } ${ n.status } ops=${ JSON.stringify( JSON.parse( n.meta._wp_suggestion ).operations ) }` );
	}
}

async function open( { admin, editor, page, requestUtils }: any, title: string ) {
	const postId = await seedPost( requestUtils, { title } );
	await openPost( admin, editor, postId );
	logWrites( page );
	await switchIntent( page, 'Suggesting' );
	await editor.selectBlocks( para( editor, 0 ) );
	await editor.openDocumentSettingsSidebar();
	const settings = settingsRegion( page );
	await settle( page, 800 );
	const blockTab = settings.getByRole( 'tab', { name: 'Block' } );
	if ( await blockTab.count() ) {
		await blockTab.click();
	}
	return postId;
}

async function pickColour( page: any ) {
	const settings = settingsRegion( page );
	const btn = settings.getByRole( 'button', { name: 'Color', exact: true } ).first();
	await btn.click();
	await settle( page, 500 );
	const s = maybeSaved( page, 15000 );
	await page.getByRole( 'option', { name: 'Accent', exact: true } ).click();
	console.log( 'colour save:', await s );
	await btn.click(); // close the popover without Escape
	await settle( page, 1200 );
}

async function pickFontSize( page: any ) {
	const s = maybeSaved( page, 15000 );
	await settingsRegion( page ).getByRole( 'radiogroup', { name: 'Font size' } ).getByRole( 'radio' ).nth( 2 ).click();
	console.log( 'font save:', await s );
	await settle( page, 1500 );
}

test( 'AT-04 V1 colour then font size', async ( { admin, editor, page, requestUtils } ) => {
	const fx = { admin, editor, page, requestUtils };
	const postId = await open( fx, 'fg AT-04 V1' );
	await pickColour( page );
	await state( 'V1 after colour', page, editor, requestUtils, postId );
	await shot( page, 'AT-04-colour-pending' );
	await pickFontSize( page );
	await state( 'V1 after font size', page, editor, requestUtils, postId );
	await shot( page, 'AT-04-colour-lost-after-font-size' );
	console.log( 'SUMMARIES', JSON.stringify( await summaries( page ) ) );
	await shot( page, 'AT-04-notes' );
} );

test( 'AT-04 V2 font size then colour', async ( { admin, editor, page, requestUtils } ) => {
	const fx = { admin, editor, page, requestUtils };
	const postId = await open( fx, 'fg AT-04 V2' );
	await pickFontSize( page );
	await state( 'V2 after font size', page, editor, requestUtils, postId );
	await pickColour( page );
	await state( 'V2 after colour', page, editor, requestUtils, postId );
	await shot( page, 'AT-04-font-size-then-colour' );
	console.log( 'SUMMARIES', JSON.stringify( await summaries( page ) ) );
} );

test( 'AT-04 V3 colour then toolbar align', async ( { admin, editor, page, requestUtils } ) => {
	const fx = { admin, editor, page, requestUtils };
	const postId = await open( fx, 'fg AT-04 V3' );
	await pickColour( page );
	await state( 'V3 after colour', page, editor, requestUtils, postId );
	await page.getByRole( 'toolbar', { name: 'Block tools' } ).getByRole( 'button', { name: 'Align text' } ).click();
	const s = maybeSaved( page, 15000 );
	await page.getByRole( 'menuitemradio', { name: 'Align text center' } ).click();
	console.log( 'align save:', await s );
	await settle( page, 1500 );
	await state( 'V3 after align', page, editor, requestUtils, postId );
	console.log( 'SUMMARIES', JSON.stringify( await summaries( page ) ) );
} );

test( 'AT-04 V4 Editing control colour then font size', async ( { admin, editor, page, requestUtils } ) => {
	const postId = await seedPost( requestUtils, { title: 'fg AT-04 V4 control' } );
	await openPost( admin, editor, postId );
	await editor.selectBlocks( para( editor, 0 ) );
	await editor.openDocumentSettingsSidebar();
	const settings = settingsRegion( page );
	await settle( page, 800 );
	const blockTab = settings.getByRole( 'tab', { name: 'Block' } );
	if ( await blockTab.count() ) {
		await blockTab.click();
	}
	const btn = settings.getByRole( 'button', { name: 'Color', exact: true } ).first();
	await btn.click();
	await page.getByRole( 'option', { name: 'Accent', exact: true } ).click();
	await btn.click();
	await settle( page, 800 );
	await settings.getByRole( 'radiogroup', { name: 'Font size' } ).getByRole( 'radio' ).nth( 2 ).click();
	await settle( page, 800 );
	console.log( '[V4 Editing] ATTRS', JSON.stringify( ( await getBlocks( page ) )[ 1 ].attributes ) );
} );
