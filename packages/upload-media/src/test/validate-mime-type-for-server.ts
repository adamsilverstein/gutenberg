/**
 * Internal dependencies
 */
import { validateMimeTypeForServer } from '../validate-mime-type-for-server';
import { UploadError } from '../upload-error';

const imageFile = new window.File( [ 'fake_file' ], 'test.avif', {
	type: 'image/avif',
} );

describe( 'validateMimeTypeForServer', () => {
	afterEach( () => {
		jest.clearAllMocks();
	} );

	it( 'should error if file type is not supported by the server', async () => {
		expect( () => {
			validateMimeTypeForServer( imageFile, [ 'image/avif' ] );
		} ).toThrow(
			new UploadError( {
				code: 'MIME_TYPE_NOT_SUPPORTED_BY_SERVER',
				message:
					'test.avif: The web server cannot generate responsive image sizes for this image. Convert it to JPEG or PNG before uploading.',
				file: imageFile,
			} )
		);
	} );
} );
