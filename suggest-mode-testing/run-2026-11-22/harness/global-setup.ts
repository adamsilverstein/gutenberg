import { request } from '@playwright/test';
import { RequestUtils } from '@wordpress/e2e-test-utils-playwright';

export default async function globalSetup() {
	const baseURL = process.env.WP_BASE_URL;
	const storageStatePath = process.env.STORAGE_STATE_PATH;
	const requestContext = await request.newContext( { baseURL } );
	const requestUtils = new RequestUtils( requestContext, {
		baseURL,
		storageStatePath,
	} );
	await requestUtils.setupRest();
	await requestContext.dispose();
}
