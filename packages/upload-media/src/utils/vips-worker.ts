/**
 * Web Worker for VIPS image processing operations.
 * This worker handles CPU-intensive image processing tasks in a separate thread.
 */

// Import vips functions dynamically to avoid blocking the main thread
let vipsModule: typeof import('@wordpress/vips') | null = null;

async function getVips() {
	if ( ! vipsModule ) {
		vipsModule = await import( '@wordpress/vips' );
	}
	return vipsModule;
}

export interface VipsWorkerMessage {
	id: string;
	type:
		| 'convertImageFormat'
		| 'compressImage'
		| 'resizeImage'
		| 'cancelOperations';
	payload: any;
}

export interface VipsWorkerResponse {
	id: string;
	type: 'success' | 'error';
	payload: any;
}

// Handle messages from the main thread
self.addEventListener(
	'message',
	async ( event: MessageEvent< VipsWorkerMessage > ) => {
		const { id, type, payload } = event.data;

		try {
			const vips = await getVips();
			let result: any;

			switch ( type ) {
				case 'convertImageFormat':
					result = await vips.convertImageFormat(
						payload.itemId,
						payload.buffer,
						payload.inputType,
						payload.outputType,
						payload.quality,
						payload.interlaced
					);
					break;

				case 'compressImage':
					result = await vips.compressImage(
						payload.itemId,
						payload.buffer,
						payload.type,
						payload.quality,
						payload.interlaced
					);
					break;

				case 'resizeImage':
					result = await vips.resizeImage(
						payload.itemId,
						payload.buffer,
						payload.type,
						payload.resize,
						payload.smartCrop
					);
					break;

				case 'cancelOperations':
					result = await vips.cancelOperations( payload.itemId );
					break;

				default:
					throw new Error( `Unknown operation type: ${ type }` );
			}

			// Send success response back to main thread
			self.postMessage( {
				id,
				type: 'success',
				payload: result,
			} as VipsWorkerResponse );
		} catch ( error ) {
			// Send error response back to main thread
			self.postMessage( {
				id,
				type: 'error',
				payload: {
					message:
						error instanceof Error
							? error.message
							: 'Unknown error',
					stack: error instanceof Error ? error.stack : undefined,
				},
			} as VipsWorkerResponse );
		}
	}
);
