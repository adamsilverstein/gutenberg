/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { UploadError } from './upload-error';

/**
 * Verifies if the server is able to process this type
 *
 * @param file                     File object.
 * @param [serverUnsupportedTypes] List of image types not supported by the server.
 */
export function validateMimeTypeForServer(
	file: File,
	serverUnsupportedTypes?: string[]
) {
	if (
		serverUnsupportedTypes &&
		serverUnsupportedTypes.includes( file.type )
	) {
		throw new UploadError( {
			code: 'MIME_TYPE_NOT_SUPPORTED',
			message: sprintf(
				// translators: %s: file name.
				__(
					'%s: The web server cannot generate responsive image sizes for this image. Convert it to JPEG or PNG before uploading.'
				),
				file.name
			),
			file,
		} );
	}
}
