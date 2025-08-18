/**
 * Type declarations for locally imported VIPS library files.
 * These files are processed by webpack's wasm-loader and converted to Base64 data URLs.
 */

declare module '*.wasm' {
	const content: string;
	export default content;
}

declare module '*vips.js' {
	const content: string;
	export default content;
}

declare module '*vips-es6.js' {
	const content: string;
	export default content;
}
