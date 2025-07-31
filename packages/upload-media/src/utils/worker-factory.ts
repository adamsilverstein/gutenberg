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
 */
export function createVipsWorker() {
	// Define the worker code as a string to avoid CORS issues
	const workerCode = `
		/**
		 * VIPS Worker (Inline)
		 * 
		 * This worker handles intensive image processing operations using VIPS/WASM
		 * off the main thread to avoid blocking the UI.
		 */

		/**
		 * Handle messages from the main thread
		 */
		self.addEventListener('message', async (event) => {
			const { id, method, args } = event.data;

			try {
				// Dynamically import the VIPS module
				const vipsModule = await import('@wordpress/vips');
				
				let result;

				// Route the method call to the appropriate VIPS function
				switch (method) {
					case 'convertImageFormat':
						result = await vipsModule.convertImageFormat(...args);
						break;
					case 'compressImage':
						result = await vipsModule.compressImage(...args);
						break;
					case 'resizeImage':
						result = await vipsModule.resizeImage(...args);
						break;
					case 'cancelOperations':
						result = await vipsModule.cancelOperations(...args);
						break;
					default:
						throw new Error(\`Unknown method: \${method}\`);
				}

				// Send the result back to the main thread
				self.postMessage({
					id,
					result,
					success: true,
				});
			} catch (error) {
				// Send the error back to the main thread
				self.postMessage({
					id,
					error: {
						message: error.message,
						stack: error.stack,
					},
					success: false,
				});
			}
		});

		/**
		 * Handle worker errors
		 */
		self.addEventListener('error', (error) => {
			// Worker error handling - errors are propagated to main thread
		});

		/**
		 * Handle unhandled promise rejections
		 */
		self.addEventListener('unhandledrejection', (event) => {
			// Unhandled rejection handling - errors are propagated to main thread
		});
	`;

	// Create a blob URL from the worker code
	const blob = new Blob( [ workerCode ], { type: 'application/javascript' } );
	const workerUrl = URL.createObjectURL( blob );

	// Create the actual worker
	const worker = new Worker( workerUrl, { type: 'module' } );

	// Counter for generating unique message IDs
	let messageId = 0;

	// Store pending promises
	const pendingPromises = new Map<
		number,
		{
			resolve: ( value: any ) => void;
			reject: ( error: Error ) => void;
		}
	>();

	// Handle messages from the worker
	worker.addEventListener( 'message', ( event ) => {
		const { id, result, error, success } = event.data;
		const promise = pendingPromises.get( id );

		if ( promise ) {
			pendingPromises.delete( id );

			if ( success ) {
				promise.resolve( result );
			} else {
				const err = new Error( error.message );
				err.stack = error.stack;
				promise.reject( err );
			}
		}
	} );

	// Handle worker errors
	worker.addEventListener( 'error', () => {
		// Reject all pending promises
		pendingPromises.forEach( ( { reject } ) => {
			reject( new Error( 'Worker error occurred' ) );
		} );
		pendingPromises.clear();
	} );

	// Create a promise-based interface that matches the @shopify/web-worker API
	const workerProxy = {
		convertImageFormat: (
			id: QueueItemId,
			buffer: ArrayBuffer,
			inputType: string,
			outputType: string,
			quality?: number,
			interlaced?: boolean
		): Promise< ArrayBuffer | ArrayBufferLike > => {
			return new Promise( ( resolve, reject ) => {
				const msgId = ++messageId;
				pendingPromises.set( msgId, { resolve, reject } );
				worker.postMessage( {
					id: msgId,
					method: 'convertImageFormat',
					args: [
						id,
						buffer,
						inputType,
						outputType,
						quality,
						interlaced,
					],
				} );
			} );
		},

		compressImage: (
			id: QueueItemId,
			buffer: ArrayBuffer,
			type: string,
			quality?: number,
			interlaced?: boolean
		): Promise< ArrayBuffer | ArrayBufferLike > => {
			return new Promise( ( resolve, reject ) => {
				const msgId = ++messageId;
				pendingPromises.set( msgId, { resolve, reject } );
				worker.postMessage( {
					id: msgId,
					method: 'compressImage',
					args: [ id, buffer, type, quality, interlaced ],
				} );
			} );
		},

		resizeImage: (
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
			return new Promise( ( resolve, reject ) => {
				const msgId = ++messageId;
				pendingPromises.set( msgId, { resolve, reject } );
				worker.postMessage( {
					id: msgId,
					method: 'resizeImage',
					args: [ id, buffer, type, resize, smartCrop ],
				} );
			} );
		},

		cancelOperations: ( id: QueueItemId ): Promise< boolean > => {
			return new Promise( ( resolve, reject ) => {
				const msgId = ++messageId;
				pendingPromises.set( msgId, { resolve, reject } );
				worker.postMessage( {
					id: msgId,
					method: 'cancelOperations',
					args: [ id ],
				} );
			} );
		},

		// Clean up resources
		terminate: () => {
			worker.terminate();
			URL.revokeObjectURL( workerUrl );
			pendingPromises.clear();
		},
	};

	return workerProxy;
}
