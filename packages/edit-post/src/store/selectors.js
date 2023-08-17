/**
 * External dependencies
 */
import createSelector from 'rememo';

/**
 * WordPress dependencies
 */
import { createRegistrySelector } from '@wordpress/data';
import { store as interfaceStore } from '@wordpress/interface';
import { store as preferencesStore } from '@wordpress/preferences';
import { store as coreStore } from '@wordpress/core-data';
import { store as editorStore } from '@wordpress/editor';
import deprecated from '@wordpress/deprecated';

const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};
const EMPTY_INSERTION_POINT = {
	rootClientId: undefined,
	insertionIndex: undefined,
	filterValue: undefined,
};

/**
 * Returns the current editing mode.
 *
 * @param {Object} state Global application state.
 *
 * @return {string} Editing mode.
 */
export const getEditorMode = createRegistrySelector(
	( select ) => () =>
		select( preferencesStore ).get( 'core/edit-post', 'editorMode' ) ??
		'visual'
);

/**
 * Returns true if the editor sidebar is opened.
 *
 * @param {Object} state Global application state
 *
 * @return {boolean} Whether the editor sidebar is opened.
 */
export const isEditorSidebarOpened = createRegistrySelector(
	( select ) => () => {
		const activeGeneralSidebar =
			select( interfaceStore ).getActiveComplementaryArea(
				'core/edit-post'
			);
		return [ 'edit-post/document', 'edit-post/block' ].includes(
			activeGeneralSidebar
		);
	}
);

/**
 * Returns true if the plugin sidebar is opened.
 *
 * @param {Object} state Global application state.
 *
 * @return {boolean} Whether the plugin sidebar is opened.
 */
export const isPluginSidebarOpened = createRegistrySelector(
	( select ) => () => {
		const activeGeneralSidebar =
			select( interfaceStore ).getActiveComplementaryArea(
				'core/edit-post'
			);
		return (
			!! activeGeneralSidebar &&
			! [ 'edit-post/document', 'edit-post/block' ].includes(
				activeGeneralSidebar
			)
		);
	}
);

/**
 * Returns the current active general sidebar name, or null if there is no
 * general sidebar active. The active general sidebar is a unique name to
 * identify either an editor or plugin sidebar.
 *
 * Examples:
 *
 *  - `edit-post/document`
 *  - `my-plugin/insert-image-sidebar`
 *
 * @param {Object} state Global application state.
 *
 * @return {?string} Active general sidebar name.
 */
export const getActiveGeneralSidebarName = createRegistrySelector(
	( select ) => () => {
		return select( interfaceStore ).getActiveComplementaryArea(
			'core/edit-post'
		);
	}
);

/**
 * Converts panels from the new preferences store format to the old format
 * that the post editor previously used.
 *
 * The resultant converted data should look like this:
 * {
 *     panelName: {
 *         enabled: false,
 *         opened: true,
 *     },
 *     anotherPanelName: {
 *         opened: true
 *     },
 * }
 *
 * @param {string[] | undefined} inactivePanels An array of inactive panel names.
 * @param {string[] | undefined} openPanels     An array of open panel names.
 *
 * @return {Object} The converted panel data.
 */
function convertPanelsToOldFormat( inactivePanels, openPanels ) {
	// First reduce the inactive panels.
	const panelsWithEnabledState = inactivePanels?.reduce(
		( accumulatedPanels, panelName ) => ( {
			...accumulatedPanels,
			[ panelName ]: {
				enabled: false,
			},
		} ),
		{}
	);

	// Then reduce the open panels, passing in the result of the previous
	// reduction as the initial value so that both open and inactive
	// panel state is combined.
	const panels = openPanels?.reduce( ( accumulatedPanels, panelName ) => {
		const currentPanelState = accumulatedPanels?.[ panelName ];
		return {
			...accumulatedPanels,
			[ panelName ]: {
				...currentPanelState,
				opened: true,
			},
		};
	}, panelsWithEnabledState ?? {} );

	// The panels variable will only be set if openPanels wasn't `undefined`.
	// If it isn't set just return `panelsWithEnabledState`, and if that isn't
	// set return an empty object.
	return panels ?? panelsWithEnabledState ?? EMPTY_OBJECT;
}

/**
 * Returns the preferences (these preferences are persisted locally).
 *
 * @param {Object} state Global application state.
 *
 * @return {Object} Preferences Object.
 */
export const getPreferences = createRegistrySelector( ( select ) => () => {
	deprecated( `select( 'core/edit-post' ).getPreferences`, {
		since: '6.0',
		alternative: `select( 'core/preferences' ).get`,
	} );

	// These preferences now exist in the preferences store.
	// Fetch them so that they can be merged into the post
	// editor preferences.
	const preferences = [
		'hiddenBlockTypes',
		'editorMode',
		'preferredStyleVariations',
	].reduce( ( accumulatedPrefs, preferenceKey ) => {
		const value = select( preferencesStore ).get(
			'core/edit-post',
			preferenceKey
		);

		return {
			...accumulatedPrefs,
			[ preferenceKey ]: value,
		};
	}, {} );

	// Panels were a preference, but the data structure changed when the state
	// was migrated to the preferences store. They need to be converted from
	// the new preferences store format to old format to ensure no breaking
	// changes for plugins.
	const inactivePanels = select( preferencesStore ).get(
		'core/edit-post',
		'inactivePanels'
	);
	const openPanels = select( preferencesStore ).get(
		'core/edit-post',
		'openPanels'
	);
	const panels = convertPanelsToOldFormat( inactivePanels, openPanels );

	return {
		...preferences,
		panels,
	};
} );

/**
 *
 * @param {Object} state         Global application state.
 * @param {string} preferenceKey Preference Key.
 * @param {*}      defaultValue  Default Value.
 *
 * @return {*} Preference Value.
 */
export function getPreference( state, preferenceKey, defaultValue ) {
	deprecated( `select( 'core/edit-post' ).getPreference`, {
		since: '6.0',
		alternative: `select( 'core/preferences' ).get`,
	} );

	// Avoid using the `getPreferences` registry selector where possible.
	const preferences = getPreferences( state );
	const value = preferences[ preferenceKey ];
	return value === undefined ? defaultValue : value;
}

/**
 * Returns an array of blocks that are hidden.
 *
 * @return {Array} A list of the hidden block types
 */
export const getHiddenBlockTypes = createRegistrySelector( ( select ) => () => {
	return (
		select( preferencesStore ).get(
			'core/edit-post',
			'hiddenBlockTypes'
		) ?? EMPTY_ARRAY
	);
} );

/**
 * Returns true if the publish sidebar is opened.
 *
 * @param {Object} state Global application state
 *
 * @return {boolean} Whether the publish sidebar is open.
 */
export function isPublishSidebarOpened( state ) {
	return state.publishSidebarActive;
}

/**
 * Returns true if the given panel was programmatically removed, or false otherwise.
 * All panels are not removed by default.
 *
 * @param {Object} state     Global application state.
 * @param {string} panelName A string that identifies the panel.
 *
 * @return {boolean} Whether or not the panel is removed.
 */
export function isEditorPanelRemoved( state, panelName ) {
	return state.removedPanels.includes( panelName );
}

/**
 * Returns true if the given panel is enabled, or false otherwise. Panels are
 * enabled by default.
 *
 * @param {Object} state     Global application state.
 * @param {string} panelName A string that identifies the panel.
 *
 * @return {boolean} Whether or not the panel is enabled.
 */
export const isEditorPanelEnabled = createRegistrySelector(
	( select ) => ( state, panelName ) => {
		const inactivePanels = select( preferencesStore ).get(
			'core/edit-post',
			'inactivePanels'
		);
		return (
			! isEditorPanelRemoved( state, panelName ) &&
			! inactivePanels?.includes( panelName )
		);
	}
);

/**
 * Returns true if the given panel is open, or false otherwise. Panels are
 * closed by default.
 *
 * @param {Object} state     Global application state.
 * @param {string} panelName A string that identifies the panel.
 *
 * @return {boolean} Whether or not the panel is open.
 */
export const isEditorPanelOpened = createRegistrySelector(
	( select ) => ( state, panelName ) => {
		const openPanels = select( preferencesStore ).get(
			'core/edit-post',
			'openPanels'
		);
		return !! openPanels?.includes( panelName );
	}
);

/**
 * Returns true if a modal is active, or false otherwise.
 *
 * @deprecated since WP 6.3 use `core/interface` store's selector with the same name instead.
 *
 * @param {Object} state     Global application state.
 * @param {string} modalName A string that uniquely identifies the modal.
 *
 * @return {boolean} Whether the modal is active.
 */
export const isModalActive = createRegistrySelector(
	( select ) => ( state, modalName ) => {
		deprecated( `select( 'core/edit-post' ).isModalActive`, {
			since: '6.3',
			alternative: `select( 'core/interface' ).isModalActive`,
		} );
		return !! select( interfaceStore ).isModalActive( modalName );
	}
);

/**
 * Returns whether the given feature is enabled or not.
 *
 * @param {Object} state   Global application state.
 * @param {string} feature Feature slug.
 *
 * @return {boolean} Is active.
 */
export const isFeatureActive = createRegistrySelector(
	( select ) => ( state, feature ) => {
		return !! select( preferencesStore ).get( 'core/edit-post', feature );
	}
);

/**
 * Returns true if the plugin item is pinned to the header.
 * When the value is not set it defaults to true.
 *
 * @param {Object} state      Global application state.
 * @param {string} pluginName Plugin item name.
 *
 * @return {boolean} Whether the plugin item is pinned.
 */
export const isPluginItemPinned = createRegistrySelector(
	( select ) => ( state, pluginName ) => {
		return select( interfaceStore ).isItemPinned(
			'core/edit-post',
			pluginName
		);
	}
);

/**
 * Returns an array of active meta box locations.
 *
 * @param {Object} state Post editor state.
 *
 * @return {string[]} Active meta box locations.
 */
export const getActiveMetaBoxLocations = createSelector(
	( state ) => {
		return Object.keys( state.metaBoxes.locations ).filter( ( location ) =>
			isMetaBoxLocationActive( state, location )
		);
	},
	( state ) => [ state.metaBoxes.locations ]
);

/**
 * Returns true if a metabox location is active and visible
 *
 * @param {Object} state    Post editor state.
 * @param {string} location Meta box location to test.
 *
 * @return {boolean} Whether the meta box location is active and visible.
 */
export function isMetaBoxLocationVisible( state, location ) {
	return (
		isMetaBoxLocationActive( state, location ) &&
		getMetaBoxesPerLocation( state, location )?.some( ( { id } ) => {
			return isEditorPanelEnabled( state, `meta-box-${ id }` );
		} )
	);
}

/**
 * Returns true if there is an active meta box in the given location, or false
 * otherwise.
 *
 * @param {Object} state    Post editor state.
 * @param {string} location Meta box location to test.
 *
 * @return {boolean} Whether the meta box location is active.
 */
export function isMetaBoxLocationActive( state, location ) {
	const metaBoxes = getMetaBoxesPerLocation( state, location );
	return !! metaBoxes && metaBoxes.length !== 0;
}

/**
 * Returns the list of all the available meta boxes for a given location.
 *
 * @param {Object} state    Global application state.
 * @param {string} location Meta box location to test.
 *
 * @return {?Array} List of meta boxes.
 */
export function getMetaBoxesPerLocation( state, location ) {
	return state.metaBoxes.locations[ location ];
}

/**
 * Returns the list of all the available meta boxes.
 *
 * @param {Object} state Global application state.
 *
 * @return {Array} List of meta boxes.
 */
export const getAllMetaBoxes = createSelector(
	( state ) => {
		return Object.values( state.metaBoxes.locations ).flat();
	},
	( state ) => [ state.metaBoxes.locations ]
);

/**
 * Returns true if the post is using Meta Boxes
 *
 * @param {Object} state Global application state
 *
 * @return {boolean} Whether there are metaboxes or not.
 */
export function hasMetaBoxes( state ) {
	return getActiveMetaBoxLocations( state ).length > 0;
}

/**
 * Returns true if the Meta Boxes are being saved.
 *
 * @param {Object} state Global application state.
 *
 * @return {boolean} Whether the metaboxes are being saved.
 */
export function isSavingMetaBoxes( state ) {
	return state.metaBoxes.isSaving;
}

/**
 * Returns the current editing canvas device type.
 *
 * @param {Object} state Global application state.
 *
 * @return {string} Device type.
 */
export function __experimentalGetPreviewDeviceType( state ) {
	return state.deviceType;
}

/**
 * Returns true if the inserter is opened.
 *
 * @param {Object} state Global application state.
 *
 * @return {boolean} Whether the inserter is opened.
 */
export function isInserterOpened( state ) {
	return !! state.blockInserterPanel;
}

/**
 * Get the insertion point for the inserter.
 *
 * @param {Object} state Global application state.
 *
 * @return {Object} The root client ID, index to insert at and starting filter value.
 */
export function __experimentalGetInsertionPoint( state ) {
	if ( typeof state === 'boolean' ) {
		return EMPTY_INSERTION_POINT;
	}

	return state.blockInserterPanel;
}

/**
 * Returns true if the list view is opened.
 *
 * @param {Object} state Global application state.
 *
 * @return {boolean} Whether the list view is opened.
 */
export function isListViewOpened( state ) {
	return state.listViewPanel;
}

/**
 * Returns true if the template editing mode is enabled.
 *
 * @param {Object} state Global application state.
 *
 * @return {boolean} Whether we're editing the template.
 */
export function isEditingTemplate( state ) {
	return state.isEditingTemplate;
}

/**
 * Returns true if meta boxes are initialized.
 *
 * @param {Object} state Global application state.
 *
 * @return {boolean} Whether meta boxes are initialized.
 */
export function areMetaBoxesInitialized( state ) {
	return state.metaBoxes.initialized;
}

/**
 * Retrieves the template of the currently edited post.
 *
 * @return {Object?} Post Template.
 */
export const getEditedPostTemplate = createRegistrySelector(
	( select ) => () => {
		const currentTemplate =
			select( editorStore ).getEditedPostAttribute( 'template' );
		if ( currentTemplate ) {
			const templateWithSameSlug = select( coreStore )
				.getEntityRecords( 'postType', 'wp_template', { per_page: -1 } )
				?.find( ( template ) => template.slug === currentTemplate );
			if ( ! templateWithSameSlug ) {
				return templateWithSameSlug;
			}
			return select( coreStore ).getEditedEntityRecord(
				'postType',
				'wp_template',
				templateWithSameSlug.id
			);
		}

		const post = select( editorStore ).getCurrentPost();
		if ( post.link ) {
			return select( coreStore ).__experimentalGetTemplateForLink(
				post.link
			);
		}

		return null;
	}
);
