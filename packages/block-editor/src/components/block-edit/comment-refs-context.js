/**
 * WordPress dependencies
 */
import { createContext, useContext, useMemo, useRef } from '@wordpress/element';

const CommentRefsContext = createContext( {} );

export function CommentRefsProvider( { children } ) {
	const refs = useRef( new Map() );

	const contextValue = useMemo(
		() => ( {
			registerRef: ( commentId, ref ) => {
				refs.current.set( commentId, ref );
			},
			unregisterRef: ( commentId ) => {
				refs.current.delete( commentId );
			},
			getRef: ( commentId ) => refs.current.get( commentId ),
			getAllRefs: () => refs.current,
		} ),
		[]
	);

	return (
		<CommentRefsContext.Provider value={ contextValue }>
			{ children }
		</CommentRefsContext.Provider>
	);
}

export function useCommentRefs() {
	return useContext( CommentRefsContext );
}
