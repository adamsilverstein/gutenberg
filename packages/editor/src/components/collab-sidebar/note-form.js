/**
 * WordPress dependencies
 */
import { useState } from '@wordpress/element';
import {
	__experimentalTruncate as Truncate,
	Button,
} from '@wordpress/components';
import { Stack } from '@wordpress/ui';
import { __ } from '@wordpress/i18n';
import { useInstanceId } from '@wordpress/compose';
import { isKeyboardEvent } from '@wordpress/keycodes';
import { privateApis as blockEditorPrivateApis } from '@wordpress/block-editor';
import { __unstableStripHTML as stripHTML } from '@wordpress/dom';

/**
 * Internal dependencies
 */
import { sanitizeNoteContent } from './utils';
import { unlock } from '../../lock-unlock';

const { RichTextControl } = unlock( blockEditorPrivateApis );

const ALLOWED_NOTE_FORMATS = [
	'core/bold',
	'core/italic',
	'core/link',
	'core/code',
];

export function NoteForm( { onSubmit, onCancel, note, labels } ) {
	const [ inputComment, setInputComment ] = useState(
		note?.content?.raw ?? ''
	);

	const inputId = useInstanceId( NoteForm, 'comment-input' );
	const trimmedPlainText = sanitizeNoteContent( stripHTML( inputComment ) );
	const isDisabled =
		inputComment === note?.content?.raw || ! trimmedPlainText.length;

	function submit() {
		if ( isDisabled ) {
			return;
		}
		onSubmit( inputComment );
		setInputComment( '' );
	}

	return (
		<Stack
			className="editor-collab-sidebar-panel__note-form"
			direction="column"
			gap="lg"
			render={ <form /> }
			onSubmit={ ( event ) => {
				event.preventDefault();
				submit();
			} }
			onKeyDown={ ( event ) => {
				if ( isKeyboardEvent.primary( event, 'Enter' ) ) {
					event.preventDefault();
					submit();
					return;
				}

				if ( event.key === 'Escape' ) {
					event.preventDefault();
					// Passing event for reply forms.
					onCancel( event );
				}
			} }
		>
			<RichTextControl
				id={ inputId }
				label={ labels?.input ?? __( 'Note' ) }
				hideLabelFromVision
				value={ inputComment }
				onChange={ setInputComment }
				allowedFormats={ ALLOWED_NOTE_FORMATS }
				placeholder={ labels?.input ?? __( 'Note' ) }
			/>
			<Stack
				direction="row"
				align="center"
				justify="flex-end"
				gap="sm"
				wrap="wrap"
			>
				<Button size="compact" variant="tertiary" onClick={ onCancel }>
					<Truncate>{ __( 'Cancel' ) }</Truncate>
				</Button>
				<Button
					size="compact"
					accessibleWhenDisabled
					variant="primary"
					type="submit"
					disabled={ isDisabled }
				>
					<Truncate>{ labels?.submit ?? __( 'Add note' ) }</Truncate>
				</Button>
			</Stack>
		</Stack>
	);
}
