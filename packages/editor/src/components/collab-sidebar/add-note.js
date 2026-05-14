/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { useState } from '@wordpress/element';
import { useSelect, useDispatch } from '@wordpress/data';
import {
	store as blockEditorStore,
	privateApis as blockEditorPrivateApis,
} from '@wordpress/block-editor';

/**
 * Internal dependencies
 */
import { NoteCard } from './note-card';
import { NoteForm } from './note-form';
import { FloatingContainer } from './floating-container';
import { focusNoteThread } from './utils';
import { store as editorStore } from '../../store';
import { unlock } from '../../lock-unlock';

const { useBlockElement } = unlock( blockEditorPrivateApis );

export function AddNote( { onSubmit, sidebarRef, floating } ) {
	const liveClientId = useSelect(
		( select ) => select( blockEditorStore ).getSelectedBlockClientId(),
		[]
	);
	const selectedNote = useSelect(
		( select ) => unlock( select( editorStore ) ).getSelectedNote(),
		[]
	);

	if ( selectedNote !== 'new' ) {
		return null;
	}

	return (
		<AddNoteInner
			initialClientId={ liveClientId }
			onSubmit={ onSubmit }
			sidebarRef={ sidebarRef }
			floating={ floating }
		/>
	);
}

// Renders the "Add note" form, snapshotting the canvas block clientId on
// mount. Focusing the rich-text input can shift the block-editor selection,
// so without this snapshot the canvas selection can clear mid-edit and
// unmount the form before the user submits.
function AddNoteInner( { initialClientId, onSubmit, sidebarRef, floating } ) {
	const [ clientId ] = useState( initialClientId );
	const blockElement = useBlockElement( clientId );
	// eslint-disable-next-line @wordpress/no-unused-vars-before-return
	const { toggleBlockSpotlight } = unlock( useDispatch( blockEditorStore ) );
	// eslint-disable-next-line @wordpress/no-unused-vars-before-return
	const { selectNote } = unlock( useDispatch( editorStore ) );

	if ( ! clientId ) {
		return null;
	}

	const unselectNote = () => {
		selectNote( undefined );
		blockElement?.focus();
		toggleBlockSpotlight( clientId, false );
	};

	return (
		<FloatingContainer
			floating={ floating }
			className="editor-collab-sidebar-panel__thread is-selected"
			gap="md"
			tabIndex={ 0 }
			aria-label={ __( 'New note' ) }
			role="treeitem"
			style={
				floating ? { opacity: ! floating.y ? 0 : undefined } : undefined
			}
			onBlur={ ( event ) => {
				// Don't deselect notes when the browser window/tab loses focus.
				if ( ! document.hasFocus() ) {
					return;
				}
				// Rich-text re-renders briefly drop focus to the body during
				// typing, producing a blur event with relatedTarget=null. Only
				// dismiss the form when focus moves to a concrete element
				// outside the form container.
				if ( ! event.relatedTarget ) {
					return;
				}
				if ( event.currentTarget.contains( event.relatedTarget ) ) {
					return;
				}
				toggleBlockSpotlight( clientId, false );
				selectNote( undefined );
			} }
		>
			<NoteCard>
				<NoteForm
					onSubmit={ async ( inputComment ) => {
						const { id } = await onSubmit( {
							content: inputComment,
							blockClientId: clientId,
						} );
						selectNote( id );
						focusNoteThread( id, sidebarRef.current );
					} }
					onCancel={ unselectNote }
					labels={ { input: __( 'New note' ) } }
				/>
			</NoteCard>
		</FloatingContainer>
	);
}
