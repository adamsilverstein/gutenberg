/**
 * Given a callback function and an optional registry, returns a Promise that resolves
 * when the result of the callback function changes to true, then to false.
 * ```js
 * import { waitForTransition } from '@wordpress/data;
 *
 * // Wait for isSavingPost() to become true, then false.
 * waitForTransition( () => wp.data.select( 'core/editor' ).isSavingPost() ).then( () => {
 *    // Do something when the post is done saving.
 *    console.log( 'Post saved!' );
 * } );
 * ```
 *
 * @param callback           A callback function that should return true when the state has changed.
 * @param registry           Registry object. Optional. Defaults to the global registry.
 * @param registry.subscribe Function that subscribes to state changes.
 * @return A Promise that resolves when the callback returns false after returning true.
 */
export function waitForTransition(
	callback: () => boolean,
	registry: {
		subscribe: ( listener: () => void ) => () => void;
	}
): Promise< void > {
	let watching = false;

	// Create a new Promise to return.
	return new Promise< void >( ( resolve, reject ) => {
		// Subscribe to all state changes.
		const unsubscribe = registry.subscribe( () => {
			// Start watching when the callback returns true.
			if ( ! watching && callback() ) {
				watching = true;
			}

			// Complete watching and resolve the Promise when the callback returns false.
			if ( watching && ! callback() ) {
				unsubscribe();
				resolve();
			}
		} );

		// If the Promise is rejected, unsubscribe to clean up.
		Promise.prototype.catch.call( { catch: reject }, unsubscribe );
	} );
}
