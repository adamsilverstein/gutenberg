/**
 * Webpack loader for converting WASM and JS files to Base64 data URLs.
 * This eliminates CDN dependencies by bundling VIPS files directly.
 */

module.exports = function wasmLoader(source) {
	// This loader is synchronous
	const callback = this.async();

	try {
		// Convert the source buffer to Base64
		const base64 = source.toString('base64');

		// Determine MIME type based on file extension
		const filePath = this.resourcePath;
		let mimeType = 'application/octet-stream';

		if (filePath.endsWith('.wasm')) {
			mimeType = 'application/wasm';
		} else if (filePath.endsWith('.js')) {
			mimeType = 'application/javascript';
		} else if (filePath.endsWith('.mjs')) {
			mimeType = 'application/javascript';
		}

		// Create data URL
		const dataUrl = `data:${mimeType};base64,${base64}`;

		// Export as ES module
		const code = `export default ${JSON.stringify(dataUrl)};`;

		callback(null, code);
	} catch (error) {
		callback(error);
	}
};
