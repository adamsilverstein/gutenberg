/**
 * Internal dependencies
 */
import { ImageFile } from '../../imageFile';
import { getFileBasename } from '../../utils';
import { createWorkerFactory } from '../../utils/worker-factory';
import type { ImageSizeCrop, QueueItemId } from '../types';

// Create worker factory with inline script (no path needed)
let vipsWorker: any = null;
let workerError: Error | null = null;

function getVipsWorker() {
	if (vipsWorker) {
		return vipsWorker;
	}

	if (workerError) {
		throw workerError;
	}

	try {
		console.log('[VIPS Debug] Creating VIPS worker with inline script...');

		// No path needed - worker factory now uses inline script
		const createVipsWorker = createWorkerFactory();
		vipsWorker = createVipsWorker();

		console.log('[VIPS Debug] VIPS worker created successfully');
		return vipsWorker;
	} catch (error) {
		console.error('[VIPS Debug] Failed to create VIPS worker:', error);
		workerError = error as Error;
		throw error;
	}
}

export async function vipsConvertImageFormat(
	id: QueueItemId,
	file: File,
	type: string,
	quality: number,
	interlaced?: boolean
) {
	console.log('[VIPS Debug] vipsConvertImageFormat called', { id, fileType: file.type, outputType: type, quality });

	try {
		const worker = getVipsWorker();
		const buffer = await worker.convertImageFormat(
			id,
			await file.arrayBuffer(),
			file.type,
			type,
			quality,
			interlaced
		);

		console.log('[VIPS Debug] vipsConvertImageFormat completed successfully');
		const ext = getExtension( type );
		const fileName = `${ getFileBasename( file.name ) }.${ ext }`;
		return new File( [ new Blob( [ buffer as ArrayBuffer ] ) ], fileName, {
			type,
		} );
	} catch (error) {
		console.error('[VIPS Debug] vipsConvertImageFormat failed:', error);
		throw error;
	}
}

export async function vipsCompressImage(
	id: QueueItemId,
	file: File,
	quality: number,
	interlaced?: boolean
) {
	console.log('[VIPS Debug] vipsCompressImage called', { id, fileType: file.type, quality });

	try {
		const worker = getVipsWorker();
		const buffer = await worker.compressImage(
			id,
			await file.arrayBuffer(),
			file.type,
			quality,
			interlaced
		);

		console.log('[VIPS Debug] vipsCompressImage completed successfully');
		return new File(
			[ new Blob( [ buffer as ArrayBuffer ], { type: file.type } ) ],
			file.name,
			{ type: file.type }
		);
	} catch (error) {
		console.error('[VIPS Debug] vipsCompressImage failed:', error);
		throw error;
	}
}

export async function vipsResizeImage(
	id: QueueItemId,
	file: File,
	resize: ImageSizeCrop,
	smartCrop: boolean,
	addSuffix: boolean
) {
	console.log('[VIPS Debug] vipsResizeImage called', { id, fileType: file.type, resize, smartCrop, addSuffix });

	try {
		const worker = getVipsWorker();
		const { buffer, width, height, originalWidth, originalHeight } =
			await worker.resizeImage(
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

		console.log('[VIPS Debug] vipsResizeImage completed successfully', { width, height, originalWidth, originalHeight });
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
	} catch (error) {
		console.error('[VIPS Debug] vipsResizeImage failed:', error);
		throw error;
	}
}

/**
 * Cancels all ongoing image operations for the given item.
 *
 * @param id Queue item ID to cancel operations for.
 */
export async function vipsCancelOperations( id: QueueItemId ) {
	console.log('[VIPS Debug] vipsCancelOperations called', { id });

	try {
		const worker = getVipsWorker();
		const result = await worker.cancelOperations( id );
		console.log('[VIPS Debug] vipsCancelOperations completed successfully');
		return result;
	} catch (error) {
		console.error('[VIPS Debug] vipsCancelOperations failed:', error);
		throw error;
	}
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
