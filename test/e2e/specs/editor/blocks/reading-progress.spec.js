/**
 * WordPress dependencies
 */
import {
	createNewPost,
	insertBlock,
	clickBlockToolbarButton,
	openDocumentSettingsSidebar,
} from '@wordpress/e2e-test-utils';

describe( 'Reading Progress Block', () => {
	beforeEach( async () => {
		await createNewPost();
	} );

	it( 'should be available in the inserter', async () => {
		await insertBlock( 'Reading Progress' );
		expect( await page.$('.wp-block-reading-progress') ).not.toBeNull();

	} );

    it( 'should allow color customization', async () => {
        await insertBlock( 'Reading Progress' );
        await openDocumentSettingsSidebar();

        // Set color to red.  Implementation details may vary, this is a placeholder.
        await page.click('button[aria-label="Color"]');
        await page.click('input[value="#ff0000"]');

        const progressBarStyle = await page.$eval('.wp-block-reading-progress', (element) => {
            return getComputedStyle(element).backgroundColor;
        });

        expect( progressBarStyle ).toBe('rgb(255, 0, 0)');

    } );

    it( 'should allow height customization', async () => {
        await insertBlock( 'Reading Progress' );
        await openDocumentSettingsSidebar();

        // Set height to 10px. Implementation details may vary, this is a placeholder.
        await page.type('input[aria-label="Height"]', '10');
        await page.keyboard.press('Enter');

        const progressBarStyle = await page.$eval('.wp-block-reading-progress', (element) => {
            return getComputedStyle(element).height;
        });

        expect( progressBarStyle ).toBe('10px');

    } );


    it( 'should update progress on scroll', async () => {
        await insertBlock( 'Reading Progress' );

        // Scroll down a bit.  Implementation details may vary, this is a placeholder.
        await page.evaluate(() => {
            window.scrollBy(0, 100);
        });

        // Check that the progress bar value is greater than 0.
        const progressValue = await page.$eval('.wp-block-reading-progress progress', (element) => {
            return element.value;
        });

        expect( progressValue ).toBeGreaterThan(0);

    } );

} );
