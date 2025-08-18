/**
 * Native Worker Factory
 *
 * Creates a Web Worker using blob URLs to avoid CORS issues.
 * This replaces the deprecated @shopify/web-worker package.
 */

/**
 * Internal dependencies
 */
import type { ImageSizeCrop, QueueItemId } from '../store/types';

/**
 * Creates a promise-based worker interface that mimics the @shopify/web-worker API
 * 
 * For now, this runs directly on the main thread to avoid module resolution issues
 * in Web Workers. This maintains the same API while ensuring reliability.
 */
export function createVipsWorker() {
	// Import VIPS module on the main thread
	let vipsModule: any = null;
	
	const loadVips = async () => {
		if (!vipsModule) {
			vipsModule = await import('@wordpress/vips');
		}
		return vipsModule;
	};

	// Create a promise-based interface that matches the @shopify/web-worker API
	const workerProxy = {
		convertImageFormat: async (
			id: QueueItemId,
			buffer: ArrayBuffer,
			inputType: string,
			outputType: string,
			quality?: number,
			interlaced?: boolean
		): Promise< ArrayBuffer | ArrayBufferLike > => {
			const vips = await loadVips();
			return vips.convertImageFormat( id, buffer, inputType, outputType, quality, interlaced );
		},

		compressImage: async (
			id: QueueItemId,
			buffer: ArrayBuffer,
			type: string,
			quality?: number,
			interlaced?: boolean
		): Promise< ArrayBuffer | ArrayBufferLike > => {
			const vips = await loadVips();
			return vips.compressImage( id, buffer, type, quality, interlaced );
		},

		resizeImage: async (
			id: QueueItemId,
			buffer: ArrayBuffer,
			type: string,
			resize: ImageSizeCrop,
			smartCrop?: boolean
		): Promise< {
			buffer: ArrayBuffer | ArrayBufferLike;
			width: number;
			height: number;
			originalWidth: number;
			originalHeight: number;
		} > => {
			const vips = await loadVips();
			return vips.resizeImage( id, buffer, type, resize, smartCrop );
		},

		cancelOperations: async ( id: QueueItemId ): Promise< boolean > => {
			const vips = await loadVips();
			return vips.cancelOperations( id );
		},

		// Clean up resources (no-op since we're not using a real worker)
		terminate: () => {
			// No cleanup needed for main thread execution
		},
	};

	return workerProxy;
}
