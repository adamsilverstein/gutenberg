/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { UploadError } from './upload-error';
import { getMimeTypesArray } from './get-mime-types-array';

/**
 * Verifies if the user is allowed to upload this mime type.
 *
 * @param file                     File object.
 * @param wpAllowedMimeTypes       List of allowed mime types and file extensions.
 * @param [serverUnsupportedTypes] List of image types not supported by the server.
 */
export function validateMimeTypeForUser(
	file: File,
	wpAllowedMimeTypes?: Record< string, string > | null,
	serverUnsupportedTypes?: string[]
) {
	// Allowed types for the current WP_User.
	const allowedMimeTypesForUser = getMimeTypesArray( wpAllowedMimeTypes );

	if ( ! allowedMimeTypesForUser ) {
		return;
	}

	const isAllowedMimeTypeForUser = allowedMimeTypesForUser.includes(
		file.type
	);

	if ( file.type && ! isAllowedMimeTypeForUser ) {
		throw new UploadError( {
			code: 'MIME_TYPE_NOT_ALLOWED_FOR_USER',
			message: sprintf(
				// translators: %s: file name.
				__(
					'%s: Sorry, you are not allowed to upload this file type.'
				),
				file.name
			),
			file,
		} );
	}

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
