/**
 * External dependencies
 */
import VipsFactory from 'wasm-vips';
import type VipsInstance from 'wasm-vips';

/**
 * Internal dependencies
 */
import type {
	ItemId,
	ImageSizeCrop,
	LoadOptions,
	SaveOptions,
	ThumbnailOptions,
} from './types';
import { supportsAnimation, supportsInterlace, supportsQuality } from './utils';
import vipsJsDataUrl from './lib/vips-js';
import vipsWasmDataUrl from './lib/vips-wasm';

interface EmscriptenModule {
	setAutoDeleteLater: ( autoDelete: boolean ) => void;
	setDelayFunction: ( fn: ( fn: () => void ) => void ) => void;
}

let cleanup: () => void;

let vipsInstance: typeof VipsInstance;

/**
 * Instantiates and returns a new vips instance.
 *
 * Reuses any existing instance.
 */
async function getVips(): Promise< typeof VipsInstance > {
	if ( vipsInstance ) {
		return vipsInstance;
	}

	try {
		// Create a script element to load the VIPS JavaScript
		const script = document.createElement( 'script' );
		script.src = vipsJsDataUrl;
		script.type = 'text/javascript';

		// Wait for the script to load
		await new Promise( ( resolve, reject ) => {
			script.onload = resolve;
			script.onerror = reject;
			document.head.appendChild( script );
		} );

		// Configure VIPS with local WASM file
		const factory = typeof VipsFactory === 'function' ? VipsFactory : (VipsFactory as any).default;
		if ( typeof factory !== 'function' ) {
			throw new Error( 'VipsFactory is not a function' );
		}

		vipsInstance = await factory( {
			locateFile: ( fileName: string ) => {
				if ( fileName.endsWith( '.wasm' ) ) {
					return vipsWasmDataUrl;
				}
				return fileName;
			},
			preRun: ( module: EmscriptenModule ) => {
				// https://github.com/kleisauke/wasm-vips/issues/13#issuecomment-1073246828
				module.setAutoDeleteLater( true );
				module.setDelayFunction( ( fn: () => void ) => {
					cleanup = fn;
				} );
			},
		} );
	} catch ( error ) {
		// Fallback to CDN if local files are not available
		console.warn(
			'Failed to load local VIPS files, falling back to CDN:',
			error
		);

		const VIPS_CDN_URL =
			'https://cdn.jsdelivr.net/npm/wasm-vips@0.0.14/lib';
		const mainBlobUrl = URL.createObjectURL(
			await ( await window.fetch( `${ VIPS_CDN_URL }/vips.js` ) ).blob()
		);

		// Handle different module export patterns
		const factory = typeof VipsFactory === 'function' ? VipsFactory : (VipsFactory as any).default;
		if ( typeof factory !== 'function' ) {
			throw new Error( 'VipsFactory is not a function' );
		}

		vipsInstance = await factory( {
			locateFile: ( fileName: string ) =>
				`${ VIPS_CDN_URL }/${ fileName }`,
			mainScriptUrlOrBlob: mainBlobUrl,
			preRun: ( module: EmscriptenModule ) => {
				// https://github.com/kleisauke/wasm-vips/issues/13#issuecomment-1073246828
				module.setAutoDeleteLater( true );
				module.setDelayFunction( ( fn: () => void ) => {
					cleanup = fn;
				} );
			},
		} );
	}

	return vipsInstance;
}

/**
 * Holds a list of ongoing operations for a given ID.
 *
 * This way, operations can be cancelled mid-progress.
 */
const inProgressOperations = new Set< ItemId >();

/**
 * Cancels all ongoing image operations for a given item ID.
 *
 * The onProgress callbacks check for an IDs existence in this list,
 * killing the process if it's absent.
 *
 * @param id Item ID.
 * @return boolean Whether any operation was cancelled.
 */
export async function cancelOperations( id: ItemId ) {
	return inProgressOperations.delete( id );
}

/**
 * Converts an image to a different format using vips.
 *
 * @param id         Item ID.
 * @param buffer     Original file buffer.
 * @param inputType  Input mime type.
 * @param outputType Output mime type.
 * @param quality    Desired quality.
 * @param interlaced Whether to use interlaced/progressive mode.
 *                   Only used if the outputType supports it.
 */
export async function convertImageFormat(
	id: ItemId,
	buffer: ArrayBuffer,
	inputType: string,
	outputType: string,
	quality = 0.82,
	interlaced = false
): Promise< ArrayBuffer | ArrayBufferLike > {
	const ext = outputType.split( '/' )[ 1 ];

	inProgressOperations.add( id );

	let strOptions = '';
	const loadOptions: LoadOptions< typeof inputType > = {};

	// To ensure all frames are loaded in case the image is animated.
	if ( supportsAnimation( inputType ) ) {
		strOptions = '[n=-1]';
		( loadOptions as LoadOptions< typeof inputType > ).n = -1;
	}

	const vips = await getVips();
	const image = vips.Image.newFromBuffer( buffer, strOptions, loadOptions );

	// TODO: Report progress, see https://github.com/swissspidy/media-experiments/issues/327.
	image.onProgress = () => {
		if ( ! inProgressOperations.has( id ) ) {
			image.kill = true;
		}
	};

	const saveOptions: SaveOptions< typeof outputType > = {};

	if ( supportsQuality( outputType ) ) {
		saveOptions.Q = quality * 100;
	}

	if ( interlaced && supportsInterlace( outputType ) ) {
		saveOptions.interlace = interlaced;
	}

	// See https://github.com/swissspidy/media-experiments/issues/324.
	if ( 'image/avif' === outputType ) {
		saveOptions.effort = 2;
	}

	const outBuffer = image.writeToBuffer( `.${ ext }`, saveOptions );
	const result = outBuffer.buffer;

	cleanup?.();

	return result;
}

/**
 * Compresses an existing image using vips.
 *
 * @param id         Item ID.
 * @param buffer     Original file buffer.
 * @param type       Mime type.
 * @param quality    Desired quality.
 * @param interlaced Whether to use interlaced/progressive mode.
 *                   Only used if the outputType supports it.
 * @return Compressed file data.
 */
export async function compressImage(
	id: ItemId,
	buffer: ArrayBuffer,
	type: string,
	quality = 0.82,
	interlaced = false
): Promise< ArrayBuffer | ArrayBufferLike
