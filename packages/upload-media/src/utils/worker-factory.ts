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

	// Optional terminate method for worker cleanup
	terminate?: () => void;
}

/**
 * Creates a worker factory function similar to @shopify/web-worker's createWorkerFactory
 * Uses inline worker script to avoid Cross-Origin-Embedder-Policy issues
 *
 * @return {Function} A function that creates worker instances
 */
export function createWorkerFactory() {
	return function createWorker() {
		// Create the worker from inline script to avoid CORS issues.
		const workerCode = `
			console.log( '[VIPS Worker Debug] Worker script starting...' );
			console.log( '[VIPS Worker Debug] If you see this, the worker is running.' );

			// WorkerRPC implementation
			class WorkerRpcHandler {
				constructor() {
					this.methods = new Map();
					self.onmessage = this.handleMessage.bind( this );
					console.log( '[WorkerRPC Debug] WorkerRpcHandler initialized in worker' );
				}

				expose( method, handler ) {
					this.methods.set( method, handler );
				}

				exposeAll( methods ) {
					Object.entries( methods ).forEach( ( [ method, handler ] ) => {
						this.expose( method, handler );
					} );
				}

				async handleMessage( event ) {
					const { id, type, method, args } = event.data;
					console.log( '[WorkerRPC Debug] Worker received message:', { id, type, method, argsLength: args ? args.length : 0 } );

					if ( type !== 'call' || ! method ) {
						console.log( '[WorkerRPC Debug] Ignoring non-call message or message without method' );
						return;
					}

					const handler = this.methods.get( method );
					if ( ! handler ) {
						console.error( '[WorkerRPC Debug] Method not found:', method, 'Available methods:', Array.from( this.methods.keys() ) );
						this.sendError( id, 'Method ' + method + ' not found' );
						return;
					}

					try {
						console.log( '[WorkerRPC Debug] Calling handler for method:', method );
						const result = await handler( ...( args || [] ) );
						console.log( '[WorkerRPC Debug] Handler completed successfully for method:', method );
						this.sendResponse( id, result );
					} catch ( error ) {
						console.error( '[WorkerRPC Debug] Handler failed for method:', method, 'Error:', error );
						this.sendError( id, error instanceof Error ? error.message : String( error ) );
					}
				}

				sendResponse( id, result ) {
					console.log( '[WorkerRPC Debug] Sending response for id:', id, 'Result:', result );
					const transferList = [];
					this.extractTransferables( result, transferList );

					const message = {
						id: id,
						type: 'response',
						result: result
					};

					if ( transferList.length > 0 ) {
						self.postMessage( message, transferList );
					} else {
						self.postMessage( message );
					}
				}

				sendError( id, error ) {
					const message = {
						id: id,
						type: 'error',
						error: error
					};
					self.postMessage( message );
				}

				extractTransferables( obj, transferList ) {
					if ( obj instanceof ArrayBuffer ) {
						transferList.push( obj );
					} else if ( obj instanceof MessagePort ) {
						transferList.push( obj );
					} else if ( obj instanceof ImageBitmap ) {
						transferList.push( obj );
					} else if ( Array.isArray( obj ) ) {
						obj.forEach( function( item ) {
							this.extractTransferables( item, transferList );
						}, this );
					} else if ( obj && typeof obj === 'object' ) {
						Object.values( obj ).forEach( function( value ) {
							this.extractTransferables( value, transferList );
						}, this );
					}
				}
			}

			// Initialize RPC handler
			const rpcHandler = new WorkerRpcHandler();

			// Import VIPS dynamically in worker context
			let vipsInstance = null;
			let cleanup = null;
			const inProgressOperations = new Set();

			// Utility functions for format support
			const supportsAnimation = function( type ) {
				return type === 'image/gif' || type === 'image/webp';
			};

			const supportsQuality = function( type ) {
				return type !== 'image/gif';
			};

			const supportsInterlace = function( type ) {
				return [ 'image/jpeg', 'image/png', 'image/gif' ].indexOf( type ) !== -1;
			};

			// Initialize VIPS instance
			const getVips = async function() {
				if ( vipsInstance ) {
					return vipsInstance;
				}

				// Import VIPS dynamically
				const VipsModule = await import( 'wasm-vips' );
				const Vips = VipsModule.default;

				vipsInstance = await Vips( {
					preRun: function( module ) {
						// https://github.com/kleisauke/wasm-vips/issues/13#issuecomment-1073246828
						module.setAutoDeleteLater( true );
						module.setDelayFunction( function( fn ) {
							cleanup = fn;
						} );
					}
				} );

				return vipsInstance;
			};

			// Actual VIPS methods implementation
			const vipsMethods = {
				async convertImageFormat( id, buffer, inputType, outputType, quality, interlaced ) {
					if ( typeof quality === 'undefined' ) {
						quality = 0.82;
					}
					if ( typeof interlaced === 'undefined' ) {
						interlaced = false;
					}
					console.log( '[VIPS Worker Debug] convertImageFormat called', { id: id, inputType: inputType, outputType: outputType, quality: quality, interlaced: interlaced } );

					const ext = outputType.split( '/' )[ 1 ];
					inProgressOperations.add( id );

					try {
						let strOptions = '';
						const loadOptions = {};

						// To ensure all frames are loaded in case the image is animated.
						if ( supportsAnimation( inputType ) ) {
							strOptions = '[n=-1]';
							loadOptions.n = -1;
						}

						const vips = await getVips();
						const image = vips.Image.newFromBuffer( buffer, strOptions, loadOptions );

						// Progress callback for cancellation support
						image.onProgress = function() {
							if ( ! inProgressOperations.has( id ) ) {
								image.kill = true;
							}
						};

						const saveOptions = {};

						if ( supportsQuality( outputType ) ) {
							saveOptions.Q = quality * 100;
						}

						if ( interlaced && supportsInterlace( outputType ) ) {
							saveOptions.interlace = interlaced;
						}

						// AVIF-specific optimization
						if ( outputType === 'image/avif' ) {
							saveOptions.effort = 2;
						}

						const outBuffer = image.writeToBuffer( '.' + ext, saveOptions );
						const result = outBuffer.buffer;

						if ( typeof cleanup === 'function' ) {
							cleanup();
						}
						inProgressOperations.delete( id );

						console.log( '[VIPS Worker Debug] convertImageFormat completed successfully' );
						return result;
					} catch ( error ) {
						inProgressOperations.delete( id );
						console.error( '[VIPS Worker Debug] convertImageFormat failed:', error );
						throw error;
					}
				},

				async compressImage( id, buffer, type, quality, interlaced ) {
					if ( typeof quality === 'undefined' ) {
						quality = 0.82;
					}
					if ( typeof interlaced === 'undefined' ) {
						interlaced = false;
					}
					console.log( '[VIPS Worker Debug] compressImage called', { id: id, type: type, quality: quality, interlaced: interlaced } );
					// Compression is just format conversion to the same format
					return this.convertImageFormat( id, buffer, type, type, quality, interlaced );
				},

				async resizeImage( id, buffer, type, resize, smartCrop ) {
					if ( typeof smartCrop === 'undefined' ) {
						smartCrop = false;
					}
					console.log( '[VIPS Worker Debug] resizeImage called', { id: id, type: type, resize: resize, smartCrop: smartCrop } );

					const ext = type.split( '/' )[ 1 ];
					inProgressOperations.add( id );

					try {
						const vips = await getVips();
						const thumbnailOptions = {
							size: 'down'
						};

						let strOptions = '';
						const loadOptions = {};

						// To ensure all frames are loaded in case the image is animated.
						// But only if we're not cropping.
						if ( supportsAnimation( type ) && ! resize.crop ) {
							strOptions = '[n=-1]';
							thumbnailOptions.option_string = strOptions;
							loadOptions.n = -1;
						}

						// Progress callback for cancellation support
						const onProgress = function() {
							if ( ! inProgressOperations.has( id ) ) {
								image.kill = true;
							}
						};

						let image = vips.Image.newFromBuffer( buffer );
						image.onProgress = onProgress;

						const width = image.width;
						const pageHeight = image.pageHeight;

						// If resize.height is zero, calculate proportional height
						resize.height = resize.height || ( pageHeight / width ) * resize.width;

						let resizeWidth = resize.width;
						thumbnailOptions.height = resize.height;

						if ( ! resize.crop ) {
							// Simple resize without cropping
							image = vips.Image.thumbnailBuffer( buffer, resizeWidth, thumbnailOptions );
							image.onProgress = onProgress;
						} else if ( resize.crop === true ) {
							// Smart crop or center crop
							thumbnailOptions.crop = smartCrop ? 'attention' : 'centre';
							image = vips.Image.thumbnailBuffer( buffer, resizeWidth, thumbnailOptions );
							image.onProgress = onProgress;
						} else {
							// Manual crop with specific coordinates
							// First resize, then do the cropping
							if ( width < pageHeight ) {
								resizeWidth = resize.width >= resize.height ? resize.width : ( width / pageHeight ) * resize.height;
								thumbnailOptions.height = resize.width >= resize.height ? ( pageHeight / width ) * resizeWidth : resize.height;
							} else {
								resizeWidth = resize.width >= resize.height ? ( width / pageHeight ) * resize.height : resize.width;
								thumbnailOptions.height = resize.width >= resize.height ? resize.height : ( pageHeight / width ) * resizeWidth;
							}

							image = vips.Image.thumbnailBuffer( buffer, resizeWidth, thumbnailOptions );
							image.onProgress = onProgress;

							let left = 0;
							if ( resize.crop[ 0 ] === 'center' ) {
								left = ( image.width - resize.width ) / 2;
							} else if ( resize.crop[ 0 ] === 'right' ) {
								left = image.width - resize.width;
							}

							let top = 0;
							if ( resize.crop[ 1 ] === 'center' ) {
								top = ( image.height - resize.height ) / 2;
							} else if ( resize.crop[ 1 ] === 'bottom' ) {
								top = image.height - resize.height;
							}

							// Address rounding errors
							left = Math.max( 0, left );
							top = Math.max( 0, top );
							resize.width = Math.min( image.width, resize.width );
							resize.height = Math.min( image.height, resize.height );

							image = image.crop( left, top, resize.width, resize.height );
							image.onProgress = onProgress;
						}

						const saveOptions = {};
						const outBuffer = image.writeToBuffer( '.' + ext, saveOptions );

						const result = {
							buffer: outBuffer.buffer,
							width: image.width,
							height: image.pageHeight,
							originalWidth: width,
							originalHeight: pageHeight
						};

						if ( typeof cleanup === 'function' ) {
							cleanup();
						}
						inProgressOperations.delete( id );

						console.log( '[VIPS Worker Debug] resizeImage completed successfully', {
							width: result.width,
							height: result.height,
							originalWidth: result.originalWidth,
							originalHeight: result.originalHeight
						} );

						return result;
					} catch ( error ) {
						inProgressOperations.delete( id );
						console.error( '[VIPS Worker Debug] resizeImage failed:', error );
						throw error;
					}
				},

				async cancelOperations( id ) {
					console.log( '[VIPS Worker Debug] cancelOperations called', { id: id } );
					const wasDeleted = inProgressOperations.delete( id );
					console.log( '[VIPS Worker Debug] cancelOperations completed', { wasDeleted: wasDeleted } );
					return wasDeleted;
				}
			};

			// Expose all VIPS methods
			rpcHandler.exposeAll( vipsMethods );

			console.log( '[VIPS Worker Debug] Worker initialized with methods:', Object.keys( vipsMethods ) );
		`;

		// Create blob URL from worker code
		const blob = new window.Blob( [ workerCode ], {
			type: 'application/javascript',
		} );
		const workerUrl = window.URL.createObjectURL( blob );

		// Create the worker from the blob URL
		const worker = new window.Worker( workerUrl );

		// Clean up the blob URL after worker is created
		// We can't do this immediately as the worker might not have loaded yet
		// So we'll clean it up when the worker is terminated
		const originalTerminate = worker.terminate.bind( worker );
		worker.terminate = function () {
			window.URL.revokeObjectURL( workerUrl );
			originalTerminate();
		};

		// Create RPC wrapper
		const rpc = new WorkerRpc( worker );

		// Create proxy object that matches the vips API
		const workerProxy: VipsWorkerProxy = {
			convertImageFormat(
				id: string,
				buffer: ArrayBuffer,
				inputType: string,
				outputType: string,
				quality?: number,
				interlaced?: boolean
			) {
				return rpc.call(
					'convertImageFormat',
					id,
					buffer,
					inputType,
					outputType,
					quality,
					interlaced
				);
			},
			compressImage(
				id: string,
				buffer: ArrayBuffer,
				type: string,
				quality?: number,
				interlaced?: boolean
			) {
				return rpc.call(
					'compressImage',
					id,
					buffer,
					type,
					quality,
					interlaced
				);
			},
			resizeImage(
				id: string,
				buffer: ArrayBuffer,
				type: string,
				resize: any,
				smartCrop?: boolean
			) {
				return rpc.call(
					'resizeImage',
					id,
					buffer,
					type,
					resize,
					smartCrop
				);
			},
			cancelOperations( id: string ) {
				return rpc.call( 'cancelOperations', id );
			},
		};

		// Add terminate method to the proxy (similar to @shopify/web-worker)
		workerProxy.terminate = function () {
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
