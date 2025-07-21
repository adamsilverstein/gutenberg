/**
 * Worker factory for creating and managing VIPS web workers.
 * Replaces the deprecated @shopify/web-worker implementation.
 */

/**
 * Internal dependencies
 */
import type { VipsWorkerMessage, VipsWorkerResponse } from './vips-worker';

/**
 * Creates a promise-based interface for communicating with a web worker.
 */
class WorkerProxy {
	private worker: Worker;
	private messageId = 0;
	private pendingMessages = new Map<
		string,
		{
			resolve: ( value: any ) => void;
			reject: ( error: Error ) => void;
		}
	>();

	constructor( worker: Worker ) {
		this.worker = worker;
		this.worker.addEventListener(
			'message',
			this.handleMessage.bind( this )
		);
		this.worker.addEventListener( 'error', this.handleError.bind( this ) );
	}

	private handleMessage = ( event: MessageEvent< VipsWorkerResponse > ) => {
		const { id, type, payload } = event.data;
		const pending = this.pendingMessages.get( id );

		if ( ! pending ) {
			return;
		}

		this.pendingMessages.delete( id );

		if ( type === 'success' ) {
			pending.resolve( payload );
		} else {
			pending.reject( new Error( payload.message ) );
		}
	};

	private handleError = ( error: ErrorEvent ) => {
		// Reject all pending messages
		for ( const [ , pending ] of this.pendingMessages ) {
			pending.reject( new Error( `Worker error: ${ error.message }` ) );
		}
		this.pendingMessages.clear();
	};

	private postMessage(
		type: VipsWorkerMessage[ 'type' ],
		payload: any
	): Promise< any > {
		return new Promise( ( resolve, reject ) => {
			const id = `msg_${ ++this.messageId }`;

			this.pendingMessages.set( id, { resolve, reject } );

			this.worker.postMessage( {
				id,
				type,
				payload,
			} as VipsWorkerMessage );
		} );
	}

	async convertImageFormat(
		itemId: string,
		buffer: ArrayBuffer,
		inputType: string,
		outputType: string,
		quality: number,
		interlaced?: boolean
	): Promise< ArrayBuffer > {
		return this.postMessage( 'convertImageFormat', {
			itemId,
			buffer,
			inputType,
			outputType,
			quality,
			interlaced,
		} );
	}

	async compressImage(
		itemId: string,
		buffer: ArrayBuffer,
		type: string,
		quality: number,
		interlaced?: boolean
	): Promise< ArrayBuffer > {
		return this.postMessage( 'compressImage', {
			itemId,
			buffer,
			type,
			quality,
			interlaced,
		} );
	}

	async resizeImage(
		itemId: string,
		buffer: ArrayBuffer,
		type: string,
		resize: any,
		smartCrop: boolean
	): Promise< {
		buffer: ArrayBuffer;
		width: number;
		height: number;
		originalWidth: number;
		originalHeight: number;
	} > {
		return this.postMessage( 'resizeImage', {
			itemId,
			buffer,
			type,
			resize,
			smartCrop,
		} );
	}

	async cancelOperations( itemId: string ): Promise< boolean > {
		return this.postMessage( 'cancelOperations', { itemId } );
	}

	terminate() {
		this.worker.terminate();
		// Reject all pending messages
		for ( const [ , pending ] of this.pendingMessages ) {
			pending.reject( new Error( 'Worker terminated' ) );
		}
		this.pendingMessages.clear();
	}
}

/**
 * Creates a new VIPS worker instance.
 */
export function createVipsWorker(): WorkerProxy {
	// Create worker from the vips-worker module
	const worker = new Worker( new URL( './vips-worker.js', import.meta.url ), {
		type: 'module',
	} );

	return new WorkerProxy( worker );
}
