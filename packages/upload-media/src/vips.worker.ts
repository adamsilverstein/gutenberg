/**
 * External dependencies
 */
import * as Comlink from 'comlink';

/**
 * Internal dependencies
 */
import type { ImageSizeCrop, QueueItemId } from './store/types';

// Dynamically import the vips module
let vipsModule: typeof import('@wordpress/vips') | null = null;

async function getVipsModule() {
	if ( ! vipsModule ) {
		vipsModule = await import( '@wordpress/vips' );
	}
	return vipsModule;
}

/**
 * Worker API that exposes vips functionality
 */
const vipsWorkerAPI = {
	async convertImageFormat(
		id: QueueItemId,
		buffer: ArrayBuffer,
		inputType: string,
		outputType: string,
		quality: number,
		interlaced?: boolean
	): Promise< ArrayBuffer | ArrayBufferLike > {
		const vips = await getVipsModule();
		return vips.convertImageFormat(
			id,
			buffer,
			inputType,
			outputType,
			quality,
			interlaced
		);
	},

	async compressImage(
		id: QueueItemId,
		buffer: ArrayBuffer,
		inputType: string,
		quality: number,
		interlaced?: boolean
	): Promise< ArrayBuffer | ArrayBufferLike > {
		const vips = await getVipsModule();
		return vips.compressImage( id, buffer, inputType, quality, interlaced );
	},

	async resizeImage(
		id: QueueItemId,
		buffer: ArrayBuffer,
		inputType: string,
		resize: ImageSizeCrop,
		smartCrop: boolean
	): Promise< {
		buffer: ArrayBuffer | ArrayBufferLike;
		width: number;
		height: number;
		originalWidth: number;
		originalHeight: number;
	} > {
		const vips = await getVipsModule();
		return vips.resizeImage( id, buffer, inputType, resize, smartCrop );
	},

	async cancelOperations( id: QueueItemId ): Promise< boolean > {
		const vips = await getVipsModule();
		return vips.cancelOperations( id );
	},
};

// Expose the API using Comlink
Comlink.expose( vipsWorkerAPI );

export type VipsWorkerAPI = typeof vipsWorkerAPI;
