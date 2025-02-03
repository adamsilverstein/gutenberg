/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { UploadError } from './upload-error';

/**
 * Verifies if the mime type is allowed on the server.
 *
 * @param file                   File object.
 * @param serverUnsupportedTypes List of allowed mime types and file extensions.
 */
export function validateMimeTypeForServer(
	file: File,
	serverUnsupportedTypes?: string[]
) {
	if (
		serverUnsupportedTypes &&
		file.type &&
		serverUnsupportedTypes.includes( file.type )
	) {
		throw new UploadError( {
			code: 'MIME_TYPE_NOT_SUPPORTED_BY_SERVER',
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
