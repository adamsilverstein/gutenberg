/**
 * Config for the manual-style Suggestion mode test run. Unlike the stock e2e
 * config it has no web server and its global setup only signs in - it never
 * deletes posts, so parallel runs can share one site.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, devices } from '@playwright/test';

const here = path.dirname( fileURLToPath( 'file:' + __filename ) );
const agent = process.env.RUN_AGENT || 'main';

// wp-scripts presets WP_BASE_URL to the stock 8889 site, so always override it.
process.env.WP_BASE_URL = process.env.RUN_BASE_URL || 'http://localhost:8947';
process.env.STORAGE_STATE_PATH = path.join( here, '.state', `admin-${ agent }.json` );
process.env.WP_ARTIFACTS_PATH = path.join( here, '.state', `artifacts-${ agent }` );

export default defineConfig( {
	testDir: path.join( here, 'agents', agent ),
	outputDir: path.join( here, '.state', `results-${ agent }` ),
	globalSetup: path.join( here, 'global-setup.ts' ),
	workers: 1,
	fullyParallel: false,
	retries: 0,
	timeout: 120_000,
	reporter: [ [ 'list' ] ],
	use: {
		baseURL: process.env.WP_BASE_URL,
		storageState: process.env.STORAGE_STATE_PATH,
		headless: true,
		viewport: { width: 1440, height: 900 },
		actionTimeout: 15_000,
		trace: 'off',
		video: 'off',
	},
	projects: [ { name: 'chromium', use: { ...devices[ 'Desktop Chrome' ], viewport: { width: 1440, height: 900 } } } ],
} );
