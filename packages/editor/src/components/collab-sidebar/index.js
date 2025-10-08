/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { useSelect, useDispatch, subscribe } from '@wordpress/data';
import { __experimentalVStack as VStack } from '@wordpress/components';
import { useState, useRef } from '@wordpress/element';
import { useViewportMatch } from '@wordpress/compose';
import { comment as commentIcon } from '@wordpress/icons';
import { store as noticesStore } from '@wordpress/notices';
import { store as coreStore } from '@wordpress/core-data';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { store as interfaceStore } from '@wordpress/interface';
import { decodeEntities } from '@wordpress/html-entities';

/**
 * Internal dependencies
 */
import PluginSidebar from '../plugin-sidebar';
import { collabHistorySidebarName, collabSidebarName } from './constants';
import { Comments } from './comments';
import { AddComment } from './add-comment';
import { store as editorStore } from '../../store';
import AddCommentButton from './comment-button';
import CommentAvatarIndicator from './comment-indicator-toolbar';
import { useGlobalStylesContext } from '../global-styles-provider';
import { useBlockComments } from './hooks';

function CollabSidebarContent( {
	showCommentBoard,
	setShowCommentBoard,
	styles,
	comments,
	commentSidebarRef,
} ) {
	const { createNotice } = useDispatch( noticesStore );
	const { saveEntityRecord, deleteEntityRecord } = useDispatch( coreStore );
	const { updateBlockAttributes } = useDispatch( blockEditorStore );
	const {
		currentPostId,
		getSelectedBlockClientId,
		getBlockAttributes,
		currentUser,
	} = useSelect( ( select ) => {
		const { getCurrentPostId } = select( editorStore );
		return {
			getSelectedBlockClientId:
				select( blockEditorStore ).getSelectedBlockClientId,
			getBlockAttributes: select( blockEditorStore ).getBlockAttributes,
			currentPostId: getCurrentPostId(),
			currentUser: select( coreStore ).getCurrentUser(),
		};
	}, [] );

	const onError = ( error ) => {
		const errorMessage =
			error.message && error.code !== 'unknown_error'
				? decodeEntities( error.message )
				: __( 'An error occurred while performing an update.' );
		createNotice( 'error', errorMessage, {
			type: 'snackbar',
			isDismissible: true,
		} );
	};

	const addNewComment = async ( { content, parent } ) => {
		try {
			const savedRecord = await saveEntityRecord(
				'root',
				'comment',
				{
					post: currentPostId,
					content,
					comment_type: 'block_comment',
					comment_approved: 0,
					parent: parent || 0,
				},
				{ throwOnError: true }
			);

			// If it's a main comment, update the block attributes with the comment id.
			if ( ! parent && savedRecord?.id ) {
				const metadata = getBlockAttributes(
					getSelectedBlockClientId()
				)?.metadata;
				updateBlockAttributes( getSelectedBlockClientId(), {
					metadata: {
						...metadata,
						commentId: savedRecord.id,
					},
				} );
			}

			createNotice(
				'snackbar',
				parent
					? __( 'Reply added successfully.' )
					: __( 'Comment added successfully.' ),
				{
					type: 'snackbar',
					isDismissible: true,
				}
			);
		} catch ( error ) {
			onError( error );
		}
	};

	const onEditComment = async ( { id, content, status } ) => {
		const messageType = status ? status : 'updated';
		const messages = {
			approved: __( 'Comment marked as resolved.' ),
			hold: __( 'Comment reopened.' ),
			updated: __( 'Comment updated.' ),
		};

		try {
			// Handle resolution/reopening by creating new comments with meta.
			if ( status === 'approved' || status === 'hold' ) {
				const action = status === 'approved' ? 'resolve' : 'reopen';
				const approvalStatus =
					status === 'approved' ? 'approved' : 'hold';

				// Create a new block_comment with resolution meta.
				await saveEntityRecord(
					'root',
					'comment',
					{
						post: currentPostId,
						comment_type: 'block_comment',
						comment_approved: 0,
						parent: id,
						content: content || '',
						meta: {
							_block_comment_resolution: {
								action,
								timestamp: new Date().toISOString(),
								userId: currentUser?.id || 0,
							},
						},
					},
					{ throwOnError: true }
				);
				// Update the original comment status.
				await saveEntityRecord(
					'root',
					'comment',
					{ id, status: approvalStatus },
					{ throwOnError: true }
				);
			} else {
				// Regular content update.
				await saveEntityRecord(
					'root',
					'comment',
					{
						id,
						content,
						status,
					},
					{ throwOnError: true }
				);
			}
			createNotice(
				'snackbar',
				messages[ messageType ] ?? __( 'Comment updated.' ),
				{
					type: 'snackbar',
					isDismissible: true,
				}
			);
		} catch ( error ) {
			onError( error );
		}
	};

	const onCommentDelete = async ( comment ) => {
		try {
			await deleteEntityRecord(
				'root',
				'comment',
				comment.id,
				undefined,
				{
					throwOnError: true,
				}
			);

			if ( ! comment.parent ) {
				const metadata = getBlockAttributes(
					getSelectedBlockClientId()
				)?.metadata;
				updateBlockAttributes( getSelectedBlockClientId(), {
					metadata: {
						...metadata,
						commentId: undefined,
					},
				} );
			}

			createNotice( 'snackbar', __( 'Comment deleted successfully.' ), {
				type: 'snackbar',
				isDismissible: true,
			} );
		} catch ( error ) {
			onError( error );
		}
	};

	return (
		<div
			className="editor-collab-sidebar-panel"
			style={ styles }
			ref={ commentSidebarRef }
		>
			<VStack role="list" spacing="3">
				<AddComment
					onSubmit={ addNewComment }
					showCommentBoard={ showCommentBoard }
					setShowCommentBoard={ setShowCommentBoard }
				/>
				<Comments
					threads={ comments }
					onEditComment={ onEditComment }
					onAddReply={ addNewComment }
					onCommentDelete={ onCommentDelete }
					showCommentBoard={ showCommentBoard }
					setShowCommentBoard={ setShowCommentBoard }
					commentSidebarRef={ commentSidebarRef }
				/>
			</VStack>
		</div>
	);
}

/**
 * Renders the Collab sidebar.
 */
export default function CollabSidebar() {
	const [ showCommentBoard, setShowCommentBoard ] = useState( false );
	const { enableComplementaryArea } = useDispatch( interfaceStore );
	const { getActiveComplementaryArea } = useSelect( interfaceStore );
	const isLargeViewport = useViewportMatch( 'medium' );
	const commentSidebarRef = useRef( null );

	const { postId } = useSelect( ( select ) => {
		const { getCurrentPostId } = select( editorStore );
		return {
			postId: getCurrentPostId(),
		};
	}, [] );

	const blockCommentId = useSelect( ( select ) => {
		const { getBlockAttributes, getSelectedBlockClientId } =
			select( blockEditorStore );
		const _clientId = getSelectedBlockClientId();

		return _clientId
			? getBlockAttributes( _clientId )?.metadata?.commentId
			: null;
	}, [] );

	const openCollabBoard = () => {
		setShowCommentBoard( true );
		enableComplementaryArea( 'core', collabHistorySidebarName );
	};

	const { resultComments, unresolvedSortedThreads, totalPages } =
		useBlockComments( postId );

	const hasMoreComments = totalPages && totalPages > 1;

	// Get the global styles to set the background color of the sidebar.
	const { merged: GlobalStyles } = useGlobalStylesContext();
	const backgroundColor = GlobalStyles?.styles?.color?.background;

	if ( 0 < resultComments.length ) {
		const unsubscribe = subscribe( () => {
			const activeSidebar = getActiveComplementaryArea( 'core' );

			if ( ! activeSidebar ) {
				enableComplementaryArea( 'core', collabSidebarName );
				unsubscribe();
			}
		} );
	}

	const AddCommentComponent = blockCommentId
		? CommentAvatarIndicator
		: AddCommentButton;

	// Find the current thread for the selected block.
	const currentThread = blockCommentId
		? resultComments.find( ( thread ) => thread.id === blockCommentId )
		: null;

	// If postId is not a valid number, do not render the comment sidebar.
	if ( ! ( !! postId && typeof postId === 'number' ) ) {
		return null;
	}

	return (
		<>
			<AddCommentComponent
				onClick={ openCollabBoard }
				thread={ currentThread }
				hasMoreComments={ hasMoreComments }
			/>
			<PluginSidebar
				identifier={ collabHistorySidebarName }
				// translators: Comments sidebar title
				title={ __( 'Comments' ) }
				icon={ commentIcon }
				closeLabel={ __( 'Close Comments' ) }
			>
				<CollabSidebarContent
					comments={ resultComments }
					showCommentBoard={ showCommentBoard }
					setShowCommentBoard={ setShowCommentBoard }
					commentSidebarRef={ commentSidebarRef }
				/>
			</PluginSidebar>
			{ isLargeViewport && (
				<PluginSidebar
					isPinnable={ false }
					header={ false }
					identifier={ collabSidebarName }
					className="editor-collab-sidebar"
					headerClassName="editor-collab-sidebar__header"
				>
					<CollabSidebarContent
						comments={ unresolvedSortedThreads }
						showCommentBoard={ showCommentBoard }
						setShowCommentBoard={ setShowCommentBoard }
						commentSidebarRef={ commentSidebarRef }
						styles={ {
							backgroundColor,
						} }
					/>
				</PluginSidebar>
			) }
		</>
	);
}
