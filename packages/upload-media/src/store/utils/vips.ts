/**
 * Internal dependencies
 */
import { ImageFile } from '../../imageFile';
import { getFileBasename } from '../../utils';
import { createWorkerFactory } from '../../utils/worker-factory';
import type { ImageSizeCrop, QueueItemId } from '../types';

// Create worker factory pointing to our vips worker
const createVipsWorker = createWorkerFactory(
	new URL( '../../workers/vips-worker.ts', import.meta.url ).href
);
const vipsWorker = createVipsWorker();

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
	const ext = getExtension( type );
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

/**
 *
 * @param type Helper to extract the extension from a MIME type string.
 * @return The extension or null if the type is not a string or is empty.
 */
export function getExtension( type: string ) {
	if ( typeof type !== 'string' ) {
		return null;
	}
	type = type?.split?.( ';' )[ 0 ];
	return ( type && type.trim().toLowerCase() ) ?? null;
}
