/**
 * External dependencies
 */
import { v4 as uuidv4 } from 'uuid';

/**
 * WordPress dependencies
 */
// eslint-disable-next-line no-restricted-syntax
import type { WPDataRegistry } from '@wordpress/data/build-types/registry';

/**
 * Internal dependencies
 */
import type {
	AdditionalData,
	CancelAction,
	OnBatchSuccessHandler,
	OnChangeHandler,
	OnErrorHandler,
	OnSuccessHandler,
	QueueItem,
	QueueItemId,
	Settings,
	State,
	UpdateSettingsAction,
} from './types';
import { Type } from './types';
import type {
	addItem,
	processItem,
	removeItem,
	revokeBlobUrls,
} from './private-actions';
import { validateMimeType } from '../validate-mime-type';
import { validateMimeTypeForUser } from '../validate-mime-type-for-user';
import { validateFileSize } from '../validate-file-size';
import { vipsCancelOperations } from './utils/vips';

type ActionCreators = {
	addItem: typeof addItem;
	addItems: typeof addItems;
	removeItem: typeof removeItem;
	processItem: typeof processItem;
	cancelItem: typeof cancelItem;
	revokeBlobUrls: typeof revokeBlobUrls;
	< T = Record< string, unknown > >( args: T ): void;
};

type AllSelectors = typeof import('./selectors') &
	typeof import('./private-selectors');
type CurriedState< F > = F extends ( state: State, ...args: infer P ) => infer R
	? ( ...args: P ) => R
	: F;
type Selectors = {
	[ key in keyof AllSelectors ]: CurriedState< AllSelectors[ key ] >;
};

type ThunkArgs = {
	select: Selectors;
	dispatch: ActionCreators;
	registry: WPDataRegistry;
};

/**
 * Returns an action object that pauses all processing in the queue.
 *
 * Useful for testing purposes.
 *
 * @param settings
 * @return Action object.
 */
export function updateSettings(
	settings: Partial< Settings >
): UpdateSettingsAction {
	return {
		type: Type.UpdateSettings,
		settings,
	};
}

interface AddItemsArgs {
	files: File[];
	onChange?: OnChangeHandler;
	onSuccess?: OnSuccessHandler;
	onBatchSuccess?: OnBatchSuccessHandler;
	onError?: OnErrorHandler;
	additionalData?: AdditionalData;
	allowedTypes?: string[];
	maxUploadFileSize?: number;
}

/**
 * Adds a new item to the upload queue.
 *
 * @param $0
 * @param $0.files               Files
 * @param [$0.onChange]          Function called each time a file or a temporary representation of the file is available.
 * @param [$0.onSuccess]         Function called after the file is uploaded.
 * @param [$0.onBatchSuccess]    Function called after a batch of files is uploaded.
 * @param [$0.onError]           Function called when an error happens.
 * @param [$0.additionalData]    Additional data to include in the request.
 * @param [$0.allowedTypes]      Array with the types of media that can be uploaded, if unset all types are allowed.
 * @param [$0.maxUploadFileSize] Maximum upload size in bytes allowed for the site.
 */
export function addItems( {
	files,
	onChange,
	onSuccess,
	onError,
	onBatchSuccess,
	additionalData,
	allowedTypes,
	maxUploadFileSize,
}: AddItemsArgs ) {
	return async ( { dispatch }: { dispatch: ActionCreators } ) => {
		const batchId = uuidv4();

		console.log( '[VIPS Debug] addItems called', {
			files,
			batchId,
			onChange,
			onSuccess,
			onError,
			additionalData,
			allowedTypes,
			maxUploadFileSize,
		} );

		for ( const file of files ) {
			/*
			 Check if the caller (e.g. a block) supports this mime type.
			 Special case for file types such as HEIC which will be converted before upload anyway.
			 Another check will be done before upload.
			*/
			try {
				validateMimeType( file, allowedTypes );
				validateMimeTypeForUser(
					file,
					allowedTypes ? { [ file.type ]: file.type } : undefined
				);
			} catch ( error: unknown ) {
				onError?.( error as Error );
				continue;
			}

			try {
				validateFileSize( file, maxUploadFileSize );
			} catch ( error: unknown ) {
				onError?.( error as Error );
				continue;
			}

			dispatch.addItem( {
				file,
				batchId,
				onChange,
				onSuccess,
				onBatchSuccess,
				onError,
				additionalData,
			} );
		}
	};
}

/**
 * Cancels an item in the queue based on an error.
 *
 * @param id    Item ID.
 * @param error Error instance.
 */
export function cancelItem( id: QueueItemId, error: Error ) {
	return async ( { select, dispatch }: ThunkArgs ) => {
		const item = select.getItem( id );

		if ( ! item ) {
			/*
			 * Do nothing if item has already been removed.
			 * This can happen if an upload is cancelled manually
			 * while transcoding with vips is still in progress.
			 * Then, cancelItem() is once invoked manually and once
			 * by the error handler in optimizeImageItem().
			 */
			return;
		}

		// When cancelling a parent item, cancel all the children too.
		for ( const child of select.getChildItems( id ) ) {
			dispatch.cancelItem( child.id, error );
		}

		await vipsCancelOperations( id );

		item.abortController?.abort();

		// TODO: Do not log error for children if cancelling a parent and all its children.
		const { onError } = item;
		onError?.( error ?? new Error( 'Upload cancelled' ) );
		if ( ! onError && error ) {
			// TODO: Find better way to surface errors with sideloads etc.
			// eslint-disable-next-line no-console -- Deliberately log errors here.
			console.error( 'Upload cancelled', error );
		}

		dispatch< CancelAction >( {
			type: Type.Cancel,
			id,
			error,
		} );
		dispatch.removeItem( id );
		dispatch.revokeBlobUrls( id );

		// All other side-loaded items have been removed, so remove the parent too.
		if (
			item.parentId &&
			item.batchId &&
			select.isBatchUploaded( item.batchId )
		) {
			const parentItem = select.getItem( item.parentId ) as QueueItem;

			if (
				parentItem.batchId &&
				select.isBatchUploaded( parentItem.batchId )
			) {
				parentItem.onBatchSuccess?.();
			}

			dispatch.removeItem( item.parentId );
			dispatch.revokeBlobUrls( item.parentId );
		}
	};
}
