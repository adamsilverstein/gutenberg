/**
 * Simple RPC utility for communicating with Web Workers
 * Provides a promise-based API for calling worker methods
 */

export interface WorkerRpcMessage {
	id: string;
	type: 'call' | 'response' | 'error';
	method?: string;
	args?: any[];
	result?: any;
	error?: string;
	transferList?: Transferable[];
}

export class WorkerRpc {
	private worker: Worker;
	private pendingCalls = new Map<
		string,
		{ resolve: Function; reject: Function }
	>();
	private messageId = 0;

	constructor( worker: Worker ) {
		this.worker = worker;
		this.worker.onmessage = this.handleMessage.bind( this );
		this.worker.onerror = this.handleError.bind( this );
	}

	/**
	 * Call a method on the worker and return a promise for the result
	 *
	 * @param {string} method - The method name to call on the worker
	 * @param {...any} args   - Arguments to pass to the method
	 * @return {Promise<any>} Promise that resolves with the method result
	 */
	async call( method: string, ...args: any[] ): Promise< any > {
		const id = ( ++this.messageId ).toString();

		// Extract transferable objects from arguments
		const transferList: Transferable[] = [];
		this.extractTransferables( args, transferList );

		const message: WorkerRpcMessage = {
			id,
			type: 'call',
			method,
			args,
		};

		return new Promise( ( resolve, reject ) => {
			this.pendingCalls.set( id, { resolve, reject } );

			if ( transferList.length > 0 ) {
				this.worker.postMessage( message, transferList );
			} else {
				this.worker.postMessage( message );
			}
		} );
	}

	/**
	 * Terminate the worker
	 */
	terminate(): void {
		// Reject all pending calls
		for ( const { reject } of this.pendingCalls.values() ) {
			reject( new Error( 'Worker terminated' ) );
		}
		this.pendingCalls.clear();
		this.worker.terminate();
	}

	private handleMessage( event: MessageEvent< WorkerRpcMessage > ): void {
		const { id, type, result, error } = event.data;

		if ( type === 'response' ) {
			const pending = this.pendingCalls.get( id );
			if ( pending ) {
				this.pendingCalls.delete( id );
				pending.resolve( result );
			}
		} else if ( type === 'error' ) {
			const pending = this.pendingCalls.get( id );
			if ( pending ) {
				this.pendingCalls.delete( id );
				pending.reject( new Error( error ) );
			}
		}
	}

	private handleError( error: ErrorEvent ): void {
		// Reject all pending calls on worker error
		for ( const { reject } of this.pendingCalls.values() ) {
			reject( new Error( `Worker error: ${ error.message }` ) );
		}
		this.pendingCalls.clear();
	}

	/**
	 * Extract transferable objects from arguments recursively
	 *
	 * @param {any}   obj          - The object to extract transferables from
	 * @param {Array} transferList - Array to collect transferable objects
	 */
	private extractTransferables(
		obj: any,
		transferList: Transferable[]
	): void {
		if ( obj instanceof ArrayBuffer ) {
			transferList.push( obj );
		} else if ( obj instanceof MessagePort ) {
			transferList.push( obj );
		} else if ( obj instanceof ImageBitmap ) {
			transferList.push( obj );
		} else if ( Array.isArray( obj ) ) {
			obj.forEach( ( item ) =>
				this.extractTransferables( item, transferList )
			);
		} else if ( obj && typeof obj === 'object' ) {
			Object.values( obj ).forEach( ( value ) =>
				this.extractTransferables( value, transferList )
			);
		}
	}
}

/**
 * Worker-side RPC handler
 * Use this in the worker to handle incoming RPC calls
 */
export class WorkerRpcHandler {
	private methods = new Map< string, Function >();

	constructor() {
		self.onmessage = this.handleMessage.bind( this );
	}

	/**
	 * Register a method that can be called from the main thread
	 *
	 * @param {string}   method  - The method name to expose
	 * @param {Function} handler - The function to handle the method call
	 */
	expose( method: string, handler: Function ): void {
		this.methods.set( method, handler );
	}

	/**
	 * Expose multiple methods at once
	 *
	 * @param {Record<string, Function>} methods - Object mapping method names to handler functions
	 */
	exposeAll( methods: Record< string, Function > ): void {
		Object.entries( methods ).forEach( ( [ method, handler ] ) => {
			this.expose( method, handler );
		} );
	}

	private async handleMessage(
		event: MessageEvent< WorkerRpcMessage >
	): Promise< void > {
		const { id, type, method, args } = event.data;

		if ( type !== 'call' || ! method ) {
			return;
		}

		const handler = this.methods.get( method );
		if ( ! handler ) {
			this.sendError( id, `Method '${ method }' not found` );
			return;
		}

		try {
			const result = await handler( ...( args || [] ) );
			this.sendResponse( id, result );
		} catch ( error ) {
			this.sendError(
				id,
				error instanceof Error ? error.message : String( error )
			);
		}
	}

	private sendResponse( id: string, result: any ): void {
		const transferList: Transferable[] = [];
		this.extractTransferables( result, transferList );

		const message: WorkerRpcMessage = {
			id,
			type: 'response',
			result,
		};

		if ( transferList.length > 0 ) {
			( self as any ).postMessage( message, transferList );
		} else {
			self.postMessage( message );
		}
	}

	private sendError( id: string, error: string ): void {
		const message: WorkerRpcMessage = {
			id,
			type: 'error',
			error,
		};
		self.postMessage( message );
	}

	/**
	 * Extract transferable objects from result recursively
	 *
	 * @param {any}   obj          - The object to extract transferables from
	 * @param {Array} transferList - Array to collect transferable objects
	 */
	private extractTransferables(
		obj: any,
		transferList: Transferable[]
	): void {
		if ( obj instanceof ArrayBuffer ) {
			transferList.push( obj );
		} else if ( obj instanceof MessagePort ) {
			transferList.push( obj );
		} else if ( obj instanceof ImageBitmap ) {
			transferList.push( obj );
		} else if ( Array.isArray( obj ) ) {
			obj.forEach( ( item ) =>
				this.extractTransferables( item, transferList )
			);
		} else if ( obj && typeof obj === 'object' ) {
			Object.values( obj ).forEach( ( value ) =>
				this.extractTransferables( value, transferList )
			);
		}
	}
}
