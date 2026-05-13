/**
 * WordPress dependencies
 */
import { useState } from '@wordpress/element';
import {
	__experimentalTruncate as Truncate,
	Button,
} from '@wordpress/components';
import { Stack, VisuallyHidden } from '@wordpress/ui';
import { __ } from '@wordpress/i18n';
import { useInstanceId } from '@wordpress/compose';
import { isKeyboardEvent } from '@wordpress/keycodes';
import { RichText } from '@wordpress/block-editor';
import { __unstableStripHTML as stripHTML } from '@wordpress/dom';

/**
 * Internal dependencies
 */
import { sanitizeNoteContent } from './utils';

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
		>
			{ /* eslint-disable-next-line jsx-a11y/label-has-associated-control */ }
			<VisuallyHidden render={ <label htmlFor={ inputId } /> }>
				{ labels?.input ?? __( 'Note' ) }
			</VisuallyHidden>
			<RichText
				id={ inputId }
				identifier="note-input"
				tagName="div"
				className="editor-collab-sidebar-panel__note-form-input"
				role="textbox"
				aria-multiline="true"
				aria-label={ labels?.input ?? __( 'Note' ) }
				value={ inputComment }
				onChange={ setInputComment }
				allowedFormats={ ALLOWED_NOTE_FORMATS }
				placeholder={ labels?.input ?? __( 'Note' ) }
				onKeyDown={ ( event ) => {
					if ( isKeyboardEvent.primary( event, 'Enter' ) ) {
						event.preventDefault();
						submit();
					}

					if ( event.key === 'Escape' ) {
						event.preventDefault();
						// Passing event for reply forms.
						onCancel( event );
					}
				} }
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
