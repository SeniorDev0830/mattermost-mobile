// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Pressable, useWindowDimensions, View} from 'react-native';
import Animated, {Extrapolate, interpolate, useAnimatedStyle} from 'react-native-reanimated';

import CompassIcon from '@components/compass_icon';
import FormattedText from '@components/formatted_text';
import {buttonBackgroundStyle, buttonTextStyle} from '@utils/buttonStyles';
import {makeStyleSheetFromTheme} from '@utils/theme';

type Props = {
    theme: Theme;
    lastSlideIndex: number;
    nextSlideHandler: () => void;
    signInHandler: () => void;
    scrollX: Animated.SharedValue<number>;
};

const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => ({
    button: {
        marginTop: 5,
    },
    rowIcon: {
        color: theme.buttonColor,
        fontSize: 12,
        marginLeft: 5,
        marginTop: 2,
    },
    nextButtonText: {
        flexDirection: 'row',
        position: 'absolute',
    },
    signInButtonText: {
        flexDirection: 'row',
    },
    footerButtonsContainer: {
        flexDirection: 'column',
        height: 150,
        marginTop: 15,
        width: '100%',
        marginHorizontal: 10,
        alignItems: 'center',
    },
}));

const AnimatedButton = Animated.createAnimatedComponent(Pressable);
const BUTTON_SIZE = 80;

const FooterButtons = ({
    theme,
    nextSlideHandler,
    signInHandler,
    lastSlideIndex,
    scrollX,
}: Props) => {
    const {width} = useWindowDimensions();
    const styles = getStyleSheet(theme);

    // keep in mind penultimate and ultimate slides to run buttons text/opacity/size animations
    const penultimateSlide = lastSlideIndex - 1;

    const inputRange = [(penultimateSlide * width), lastSlideIndex * width];

    // the next button must resize in the last slide to be the 80% wide of the screen with animation
    const resizeStyle = useAnimatedStyle(() => {
        const interpolatedWidth = interpolate(
            scrollX.value,
            inputRange,
            [BUTTON_SIZE, width * 0.8],
            Extrapolate.CLAMP,
        );

        return {width: interpolatedWidth};
    });

    // use for the opacity of the button text in the penultimate and last slide
    const opacityNextTextStyle = useAnimatedStyle(() => {
        const interpolatedScale = interpolate(
            scrollX.value,
            [penultimateSlide * width, ((penultimateSlide * width) + (width / 2))],
            [1, 0], // from last to penultimate it must fade out (from 1 to 0), once it starts getting the penultimate range it must fade in again (from 0 to 1)
            Extrapolate.CLAMP,
        );

        return {opacity: interpolatedScale};
    });

    const opacitySignInTextStyle = useAnimatedStyle(() => {
        const interpolatedScale = interpolate(
            scrollX.value,
            [lastSlideIndex * width, ((penultimateSlide * width) + (width / 2))],
            [1, 0], // from last to penultimate it must fade out (from 1 to 0), once it starts getting the penultimate range it must fade in again (from 0 to 1)
            Extrapolate.CLAMP,
        );

        return {opacity: interpolatedScale};
    });

    // the sign in button should fade out until dissappear in the last slide
    const opacitySignInButton = useAnimatedStyle(() => {
        const interpolatedScale = interpolate(
            scrollX.value,
            inputRange,
            [1, 0],
            Extrapolate.CLAMP,
        );

        return {opacity: interpolatedScale};
    });

    const nextButtonText = (
        <Animated.View style={[styles.nextButtonText, opacityNextTextStyle]}>
            <FormattedText
                id='mobile.onboarding.next'
                defaultMessage='Next'
                style={buttonTextStyle(theme, 'm', 'primary', 'default')}
            />
            <CompassIcon
                name='arrow-forward-ios'
                style={styles.rowIcon}
            />
        </Animated.View>
    );

    const signInButtonText = (
        <Animated.View style={[styles.signInButtonText, opacitySignInTextStyle]}>
            <FormattedText
                id='mobile.onboarding.sign_in_to_get_started'
                defaultMessage='Sign in to get started'
                style={buttonTextStyle(theme, 's', 'primary', 'default')}
            />
        </Animated.View>
    );

    return (
        <View style={styles.footerButtonsContainer}>
            <AnimatedButton
                testID='mobile.onboaring.next'
                onPress={nextSlideHandler}
                style={[styles.button, buttonBackgroundStyle(theme, 'm', 'primary', 'default'), resizeStyle]}
            >
                {nextButtonText}
                {signInButtonText}
            </AnimatedButton>
            <AnimatedButton
                testID='mobile.onboaring.sign_in'
                onPress={signInHandler}
                style={[styles.button, buttonBackgroundStyle(theme, 'm', 'link', 'default'), opacitySignInButton]}
            >
                <FormattedText
                    id='mobile.onboarding.sign_in'
                    defaultMessage='Sign in'
                    style={buttonTextStyle(theme, 's', 'primary', 'inverted')}
                />
            </AnimatedButton>
        </View>
    );
};

export default FooterButtons;
