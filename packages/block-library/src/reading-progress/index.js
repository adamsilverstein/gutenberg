import { registerBlockType } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';
import edit from './edit';
import save from './save';
import './style.scss';

registerBlockType( 'reading-progress', {
	title: __( 'Reading Progress', 'create-block' ),
	icon: 'book',
	category: 'common',
	keywords: [
		__( 'reading', 'create-block' ),
		__( 'progress', 'create-block' ),
		__( 'scroll', 'create-block' ),
	],
	attributes: {
        color: {
            type: 'string',
            default: '#0000ff',
        },
        height: {
            type: 'number',
            default: 5,
        },

    },
	edit,
	save,
} );
