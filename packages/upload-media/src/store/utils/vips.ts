/**
 * External dependencies
 */
import * as Comlink from 'comlink';

/**
 * Internal dependencies
 */
import { ImageFile } from '../../imageFile';
import { getFileBasename } from '../../utils';
import type { ImageSizeCrop, QueueItemId } from '../types';
import type { VipsWorkerAPI } from '../../vips.worker';

// Create the worker and wrap it with Comlink
let vipsWorker: Comlink.Remote< VipsWorkerAPI >;

// Check if we're in a browser environment with worker support
const isWorkerSupported =
	typeof Worker !== 'undefined' && typeof window !== 'undefined';

// Initialize worker with fallback for test environments
if ( isWorkerSupported ) {
	try {
		// Use dynamic import to avoid import.meta issues in Jest
		const workerUrl = new URL(
			'../../vips.worker.ts',
			( globalThis as any ).location?.href || 'file://'
		);
		const worker = new Worker( workerUrl, { type: 'module' } );
		vipsWorker = Comlink.wrap< VipsWorkerAPI >( worker );
	} catch ( error ) {
		// Fallback if worker creation fails
		vipsWorker = createFallbackWorker();
	}
} else {
	// Fallback for test environments - create a mock that directly imports vips
	vipsWorker = createFallbackWorker();
}

function createFallbackWorker(): Comlink.Remote< VipsWorkerAPI > {
	return {
		async convertImageFormat(
			id,
			buffer,
			inputType,
			outputType,
			quality,
			interlaced
		) {
			const vips = await import( '@wordpress/vips' );
			return vips.convertImageFormat(
				id,
				buffer,
				inputType,
				outputType,
				quality,
				interlaced
			);
		},
		async compressImage( id, buffer, inputType, quality, interlaced ) {
			const vips = await import( '@wordpress/vips' );
			return vips.compressImage(
				id,
				buffer,
				inputType,
				quality,
				interlaced
			);
		},
		async resizeImage( id, buffer, inputType, resize, smartCrop ) {
			const vips = await import( '@wordpress/vips' );
			return vips.resizeImage( id, buffer, inputType, resize, smartCrop );
		},
		async cancelOperations( id ) {
			const vips = await import( '@wordpress/vips' );
			return vips.cancelOperations( id );
		},
	} as Comlink.Remote< VipsWorkerAPI >;
}

export async function vipsConvertImageFormat(
	id: QueueItemId,
	file: File,
	type: string,
	quality: number,
	interlaced?: boolean
) {
	const buffer = await vipsWorker.convertImageFormat(
		id,
		await file.arrayBuffer(),
		file.type,
		type,
		quality,
		interlaced
	);
	type = type?.split?.( ';' )[ 0 ];
	const ext = ( type && type.trim().toLowerCase() ) ?? null;
	const fileName = `${ getFileBasename( file.name ) }.${ ext }`;
	return new File( [ new Blob( [ buffer as ArrayBuffer ] ) ], fileName, {
		type,
	} );
}

export async function vipsCompressImage(
	id: QueueItemId,
	file: File,
	quality: number,
	interlaced?: boolean
) {
	const buffer = await vipsWorker.compressImage(
		id,
		await file.arrayBuffer(),
		file.type,
		quality,
		interlaced
	);
	return new File(
		[ new Blob( [ buffer as ArrayBuffer ], { type: file.type } ) ],
		file.name,
		{ type: file.type }
	);
}

export async function vipsResizeImage(
	id: QueueItemId,
	file: File,
	resize: ImageSizeCrop,
	smartCrop: boolean,
	addSuffix: boolean
) {
	const { buffer, width, height, originalWidth, originalHeight } =
		await vipsWorker.resizeImage(
			id,
			await file.arrayBuffer(),
			file.type,
			resize,
			smartCrop
		);

	let fileName = file.name;

	if ( addSuffix && ( originalWidth > width || originalHeight > height ) ) {
		const basename = getFileBasename( file.name );
		fileName = file.name.replace(
			basename,
			`${ basename }-${ width }x${ height }`
		);
	}

	return new ImageFile(
		new File(
			[ new Blob( [ buffer as ArrayBuffer ], { type: file.type } ) ],
			fileName,
			{
				type: file.type,
			}
		),
		width,
		height,
		originalWidth,
		originalHeight
	);
}

/**
 * Cancels all ongoing image operations for the given item.
 *
 * @param id Queue item ID to cancel operations for.
 */
export async function vipsCancelOperations( id: QueueItemId ) {
	return vipsWorker.cancelOperations( id );
}
