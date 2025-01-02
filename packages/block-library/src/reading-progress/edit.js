import { useBlockProps, InspectorControls } from '@wordpress/block-editor';
import { PanelBody, PanelColorSettings, RangeControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useEffect, useState, useRef } from '@wordpress/element';
import { ProgressBar } from '@wordpress/components';

const edit = ( { attributes, setAttributes } ) => {
    const { color, height } = attributes;
    const [ progress, setProgress ] = useState( 0 );
    const blockRef = useRef();

    const blockProps = useBlockProps( {
        style: {
            '--wp--reading-progress--color': color,
            '--wp--reading-progress--height': height + 'px',
        },
        ref: blockRef
    } );

    useEffect(() => {
        const handleScroll = () => {
            if(!blockRef.current) return;

            const { top } = blockRef.current.getBoundingClientRect();
            if(top > 0) {
                setProgress(0);
                return;
            }

            const windowHeight = window.innerHeight;
            const documentHeight = document.documentElement.scrollHeight;
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

            const newProgress = Math.max(0, Math.min(100, (scrollTop / (documentHeight - windowHeight)) * 100));
            setProgress(newProgress);
        }

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);

    }, []);

	return (
		<>
            <InspectorControls>
                <PanelBody title={ __( 'Settings', 'create-block' ) }>
                    <PanelColorSettings
                        title={ __( 'Color', 'create-block' ) }
                        colorSettings={ [
                            {
                                value: color,
                                onChange: ( newColor ) => setAttributes( { color: newColor } ),
                                label: __( 'Progress Bar Color', 'create-block' ),
                            },
                        ] }
                    />
                    <RangeControl
                        label={ __( 'Height', 'create-block' ) }
                        value={ height }
                        onChange={ ( newHeight ) => setAttributes( { height: newHeight } ) }
                        min={ 1 }
                        max={ 20 }
                    />

                </PanelBody>
            </InspectorControls>
			<div { ...blockProps }>
                <ProgressBar value={ progress } />
			</div>
		</>
	);
};

export default edit;

