import { useBlockProps } from '@wordpress/block-editor';

const save = ( { attributes } ) => {
    const { color, height } = attributes;
    const blockProps = useBlockProps.save( {
        style: {
            '--wp--reading-progress--color': color,
            '--wp--reading-progress--height': height + 'px',
        },
    } );

	return <div { ...blockProps }></div>;
};
export default save;
