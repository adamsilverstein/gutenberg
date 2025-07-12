/**
 * Worker factory utility to replace @shopify/web-worker functionality
 * Creates and manages web workers with RPC communication
 */

/**
 * Internal dependencies
 */
import { WorkerRpc } from './worker-rpc';

/**
 * Interface for worker proxy that matches the original vips functions
 */
export interface VipsWorkerProxy {
	convertImageFormat: (
		id: string,
		buffer: ArrayBuffer,
		inputType: string,
		outputType: string,
		quality?: number,
		interlaced?: boolean
	) => Promise< ArrayBuffer | ArrayBufferLike >;

	compressImage: (
		id: string,
		buffer: ArrayBuffer,
		type: string,
		quality?: number,
		interlaced?: boolean
	) => Promise< ArrayBuffer | ArrayBufferLike >;

	resizeImage: (
		id: string,
		buffer: ArrayBuffer,
		type: string,
		resize: any,
		smartCrop?: boolean
	) => Promise< {
		buffer: ArrayBuffer | ArrayBufferLike;
		width: number;
		height: number;
		originalWidth: number;
		originalHeight: number;
	} >;

	cancelOperations: ( id: string ) => Promise< boolean >;
}

/**
 * Creates a worker factory function similar to @shopify/web-worker's createWorkerFactory
 *
 * @param {string} workerScript - The path to the worker script file
 * @return {Function} A function that creates worker instances
 */
export function createWorkerFactory( workerScript: string ) {
	return function createWorker(): VipsWorkerProxy {
		// Create the worker
		const worker = new Worker( workerScript );

		// Create RPC wrapper
		const rpc = new WorkerRpc( worker );

		// Create proxy object that matches the vips API
		const workerProxy: VipsWorkerProxy = {
			convertImageFormat: (
				id,
				buffer,
				inputType,
				outputType,
				quality,
				interlaced
			) =>
				rpc.call(
					'convertImageFormat',
					id,
					buffer,
					inputType,
					outputType,
					quality,
					interlaced
				),

			compressImage: ( id, buffer, type, quality, interlaced ) =>
				rpc.call(
					'compressImage',
					id,
					buffer,
					type,
					quality,
					interlaced
				),

			resizeImage: ( id, buffer, type, resize, smartCrop ) =>
				rpc.call( 'resizeImage', id, buffer, type, resize, smartCrop ),

			cancelOperations: ( id ) => rpc.call( 'cancelOperations', id ),
		};

		// Add terminate method to the proxy (similar to @shopify/web-worker)
		( workerProxy as any ).terminate = () => rpc.terminate();

		return workerProxy;
	};
}

/**
 * Terminate a worker (similar to @shopify/web-worker's terminate function)
 *
 * @param {VipsWorkerProxy} workerProxy - The worker proxy instance to terminate
 */
export function terminate( workerProxy: VipsWorkerProxy ): void {
	if ( ( workerProxy as any ).terminate ) {
		( workerProxy as any ).terminate();
	}
}
