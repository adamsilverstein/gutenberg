/**
 * Web Worker for VIPS image processing operations
 * This worker handles image format conversion, compression, and resizing
 * using the @wordpress/vips package.
 */

/**
 * WordPress dependencies
 */
import * as vips from '@wordpress/vips';

/**
 * Internal dependencies
 */
import { WorkerRpcHandler } from '../utils/worker-rpc';
import type { ImageSizeCrop, QueueItemId } from '../store/types';

// Create RPC handler for this worker
const rpcHandler = new WorkerRpcHandler();

// Expose all the vips functions that were previously called directly
rpcHandler.exposeAll( {
	convertImageFormat: vips.convertImageFormat,
	compressImage: vips.compressImage,
	resizeImage: vips.resizeImage,
	cancelOperations: vips.cancelOperations,
} );

// Export types for TypeScript support
export type { ImageSizeCrop, QueueItemId };
