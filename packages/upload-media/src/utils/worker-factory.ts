/**
 * Worker factory utility to replace @shopify/web-worker functionality
 * Creates and manages web workers with RPC communication
 */

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
 * Uses inline worker script to avoid Cross-Origin-Embedder-Policy issues
 *
 * @return {Function} A function that creates worker instances
 */
export function createWorkerFactory(): () => VipsWorkerProxy {
	return function createWorker(): VipsWorkerProxy {
		// Create the worker from inline script to avoid CORS issues.
		const workerCode = `
			console.log('[VIPS Worker Debug] Worker script starting...');
			console.log('[VIPS Worker Debug] If you see this, the worker is running.');

			// Worker message handler will be added here
			self.addEventListener('message', function(e) {
				console.log('[VIPS Worker Debug] Received message:', e.data);
				// Echo back for now - actual implementation will be added later
				self.postMessage({
					id: e.data.id,
					result: 'Worker received: ' + JSON.stringify(e.data)
				});
			});
		`;

		// Create blob URL from worker code
		const blob = new Blob([workerCode], { type: 'application/javascript' });
		const workerUrl = URL.createObjectURL(blob);

		// Create the worker from the blob URL
		const worker = new Worker( workerUrl );

		// Clean up the blob URL after worker is created
		// We can't do this immediately as the worker might not have loaded yet
		// So we'll clean it up when the worker is terminated
		const originalTerminate = worker.terminate.bind(worker);
		worker.terminate = () => {
			URL.revokeObjectURL(workerUrl);
			originalTerminate();
		};

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
		( workerProxy as any ).terminate = () => {
			rpc.terminate();
			worker.terminate(); // This will also clean up the blob URL
		};

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
