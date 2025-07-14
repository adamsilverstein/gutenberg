/**
 * Worker factory utility to replace @shopify/web-worker functionality
 * Creates and manages web workers with RPC communication
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

			// WorkerRPC implementation
			class WorkerRpcHandler {
				constructor() {
					this.methods = new Map();
					self.onmessage = this.handleMessage.bind(this);
					console.log('[WorkerRPC Debug] WorkerRpcHandler initialized in worker');
				}

				expose(method, handler) {
					this.methods.set(method, handler);
				}

				exposeAll(methods) {
					Object.entries(methods).forEach(([method, handler]) => {
						this.expose(method, handler);
					});
				}

				async handleMessage(event) {
					const { id, type, method, args } = event.data;
					console.log('[WorkerRPC Debug] Worker received message:', { id, type, method, argsLength: args?.length });

					if (type !== 'call' || !method) {
						console.log('[WorkerRPC Debug] Ignoring non-call message or message without method');
						return;
					}

					const handler = this.methods.get(method);
					if (!handler) {
						console.error('[WorkerRPC Debug] Method not found:', method, 'Available methods:', Array.from(this.methods.keys()));
						this.sendError(id, \`Method '\${method}' not found\`);
						return;
					}

					try {
						console.log('[WorkerRPC Debug] Calling handler for method:', method);
						const result = await handler(...(args || []));
						console.log('[WorkerRPC Debug] Handler completed successfully for method:', method);
						this.sendResponse(id, result);
					} catch (error) {
						console.error('[WorkerRPC Debug] Handler failed for method:', method, 'Error:', error);
						this.sendError(id, error instanceof Error ? error.message : String(error));
					}
				}

				sendResponse(id, result) {
					const transferList = [];
					this.extractTransferables(result, transferList);

					const message = {
						id,
						type: 'response',
						result,
					};

					if (transferList.length > 0) {
						self.postMessage(message, transferList);
					} else {
						self.postMessage(message);
					}
				}

				sendError(id, error) {
					const message = {
						id,
						type: 'error',
						error,
					};
					self.postMessage(message);
				}

				extractTransferables(obj, transferList) {
					if (obj instanceof ArrayBuffer) {
						transferList.push(obj);
					} else if (obj instanceof MessagePort) {
						transferList.push(obj);
					} else if (obj instanceof ImageBitmap) {
						transferList.push(obj);
					} else if (Array.isArray(obj)) {
						obj.forEach(item => this.extractTransferables(item, transferList));
					} else if (obj && typeof obj === 'object') {
						Object.values(obj).forEach(value => this.extractTransferables(value, transferList));
					}
				}
			}

			// Initialize RPC handler
			const rpcHandler = new WorkerRpcHandler();

			// Placeholder VIPS methods - these will be replaced with actual VIPS implementations
			const vipsMethods = {
				async convertImageFormat(id, buffer, inputType, outputType, quality, interlaced) {
					console.log('[VIPS Worker Debug] convertImageFormat called', { id, inputType, outputType, quality, interlaced });
					// TODO: Implement actual VIPS conversion
					// For now, return the original buffer as a placeholder
					return buffer;
				},

				async compressImage(id, buffer, type, quality, interlaced) {
					console.log('[VIPS Worker Debug] compressImage called', { id, type, quality, interlaced });
					// TODO: Implement actual VIPS compression
					// For now, return the original buffer as a placeholder
					return buffer;
				},

				async resizeImage(id, buffer, type, resize, smartCrop) {
					console.log('[VIPS Worker Debug] resizeImage called', { id, type, resize, smartCrop });
					// TODO: Implement actual VIPS resizing
					// For now, return placeholder data
					return {
						buffer: buffer,
						width: resize.width || 800,
						height: resize.height || 600,
						originalWidth: 1200,
						originalHeight: 900
					};
				},

				async cancelOperations(id) {
					console.log('[VIPS Worker Debug] cancelOperations called', { id });
					// TODO: Implement actual operation cancellation
					return true;
				}
			};

			// Expose all VIPS methods
			rpcHandler.exposeAll(vipsMethods);

			console.log('[VIPS Worker Debug] Worker initialized with methods:', Object.keys(vipsMethods));
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
