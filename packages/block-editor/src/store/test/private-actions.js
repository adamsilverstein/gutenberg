/**
 * Internal dependencies
 */
import {
	hideBlockInterface,
	showBlockInterface,
	expandBlock,
	__experimentalUpdateSettings,
	setInsertionPoint,
	setOpenedBlockSettingsMenu,
	startDragging,
	stopDragging,
} from '../private-actions';

describe( 'private actions', () => {
	describe( 'hideBlockInterface', () => {
		it( 'should return the HIDE_BLOCK_INTERFACE action', () => {
			expect( hideBlockInterface() ).toEqual( {
				type: 'HIDE_BLOCK_INTERFACE',
			} );
		} );
	} );

	describe( 'showBlockInterface', () => {
		it( 'should return the SHOW_BLOCK_INTERFACE action', () => {
			expect( showBlockInterface() ).toEqual( {
				type: 'SHOW_BLOCK_INTERFACE',
			} );
		} );
	} );

	describe( '__experimentalUpdateSettings', () => {
		const experimentalSettings = {
			inserterMediaCategories: 'foo',
			blockInspectorAnimation: 'bar',
		};

		const stableSettings = {
			foo: 'foo',
			bar: 'bar',
			baz: 'baz',
		};

		const settings = {
			...experimentalSettings,
			...stableSettings,
		};

		const dispatch = jest.fn();

		it( 'should dispatch provided settings by default', () => {
			__experimentalUpdateSettings( settings )( { dispatch } );
			expect( dispatch ).toHaveBeenCalledWith( {
				type: 'UPDATE_SETTINGS',
				settings,
				reset: false,
			} );
		} );

		it( 'should dispatch provided settings with reset flag when `reset` argument is truthy', () => {
			__experimentalUpdateSettings( settings, {
				stripExperimentalSettings: false,
				reset: true,
			} )( { dispatch } );

			expect( dispatch ).toHaveBeenCalledWith( {
				type: 'UPDATE_SETTINGS',
				settings,
				reset: true,
			} );
		} );

		it( 'should strip experimental settings from a given settings object when `stripExperimentalSettings` argument is truthy', () => {
			__experimentalUpdateSettings( settings, {
				stripExperimentalSettings: true,
			} )( { dispatch } );

			expect( dispatch ).toHaveBeenCalledWith( {
				type: 'UPDATE_SETTINGS',
				settings: {
					foo: 'foo',
					bar: 'bar',
					baz: 'baz',
				},
				reset: false,
			} );
		} );
	} );

	describe( 'setOpenedBlockSettingsMenu', () => {
		it( 'should return the SET_OPENED_BLOCK_SETTINGS_MENU action', () => {
			expect( setOpenedBlockSettingsMenu() ).toEqual( {
				clientId: undefined,
				type: 'SET_OPENED_BLOCK_SETTINGS_MENU',
			} );
		} );

		it( 'should return the SET_OPENED_BLOCK_SETTINGS_MENU action with client id if provided', () => {
			expect( setOpenedBlockSettingsMenu( 'abcd' ) ).toEqual( {
				clientId: 'abcd',
				type: 'SET_OPENED_BLOCK_SETTINGS_MENU',
			} );
		} );
	} );

	describe( 'startDragging', () => {
		it( 'should return the START_DRAGGING action', () => {
			expect( startDragging() ).toEqual( {
				type: 'START_DRAGGING',
			} );
		} );
	} );

	describe( 'stopDragging', () => {
		it( 'should return the STOP_DRAGGING action', () => {
			expect( stopDragging() ).toEqual( {
				type: 'STOP_DRAGGING',
			} );
		} );
	} );

	describe( 'expandBlock', () => {
		it( 'should return the SET_BLOCK_EXPANDED_IN_LIST_VIEW action', () => {
			expect( expandBlock( 'block-1' ) ).toEqual( {
				type: 'SET_BLOCK_EXPANDED_IN_LIST_VIEW',
				clientId: 'block-1',
			} );
		} );
	} );

	describe( 'setInsertionPoint', () => {
		it( 'should return the SET_INSERTION_POINT action', () => {
			expect(
				setInsertionPoint( {
					rootClientId: '',
					index: '123',
				} )
			).toEqual( {
				type: 'SET_INSERTION_POINT',
				value: { rootClientId: '', index: '123' },
			} );
		} );
	} );
} );
