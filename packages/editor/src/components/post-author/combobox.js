/**
 * WordPress dependencies
 */
import { debounce } from '@wordpress/compose';
import { useState } from '@wordpress/element';
import { useDispatch } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import { ComboboxControl } from '@wordpress/components';

/**
 * Internal dependencies
 */
import { store as editorStore } from '../../store';
import { useAuthorsQuery } from './hook';

export default function PostAuthorCombobox() {
	const [ fieldValue, setFieldValue ] = useState();

	const { authorId, isLoading, authors, postAuthor } = useSelect(
		( select ) => {
			const { __unstableGetAuthor, getAuthors, isResolving } =
				select( coreStore );
			const { getEditedPostAttribute } = select( editorStore );
			const author = __unstableGetAuthor(
				getEditedPostAttribute( 'author' )
			);
			const query =
				! fieldValue || '' === fieldValue ? {} : { search: fieldValue };
			return {
				authorId: getEditedPostAttribute( 'author' ),
				postAuthor: author,
				authors: getAuthors( query ),
				isLoading: isResolving( 'getAuthors', [ query ] ),
			};
		},
		[ fieldValue ]
	);
	const { editPost } = useDispatch( editorStore );
	const { authorId, authorOptions } = useAuthorsQuery( fieldValue );

	/**
	 * Handle author selection.
	 *
	 * @param {number} postAuthorId The selected Author.
	 */
	const handleSelect = ( postAuthorId ) => {
		if ( ! postAuthorId ) {
			return;
		}
		editPost( { author: postAuthorId } );
	};

	/**
	 * Handle user input.
	 *
	 * @param {string} inputValue The current value of the input field.
	 */
	const handleKeydown = ( inputValue ) => {
		setFieldValue( inputValue );
	};

	return (
		<ComboboxControl
			__nextHasNoMarginBottom
			__next40pxDefaultSize
			label={ __( 'Author' ) }
			options={ authorOptions }
			value={ authorId }
			onFilterValueChange={ debounce( handleKeydown, 300 ) }
			onChange={ handleSelect }
			allowReset={ false }
			hideLabelFromVision
		/>
	);
}
