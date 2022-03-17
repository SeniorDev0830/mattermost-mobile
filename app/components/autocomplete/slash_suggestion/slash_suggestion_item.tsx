// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Image, Text, View} from 'react-native';
import FastImage from 'react-native-fast-image';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {SvgXml} from 'react-native-svg';

import TouchableWithFeedback from '@components/touchable_with_feedback';
import {COMMAND_SUGGESTION_ERROR} from '@constants/apps';
import {useTheme} from '@context/theme';
import {changeOpacity, makeStyleSheetFromTheme} from '@utils/theme';

const slashIcon = require('@assets/images/autocomplete/slash_command.png');
const bangIcon = require('@assets/images/autocomplete/slash_command_error.png');

const getStyleFromTheme = makeStyleSheetFromTheme((theme: Theme) => {
    return {
        icon: {
            fontSize: 24,
            backgroundColor: changeOpacity(theme.centerChannelColor, 0.08),
            width: 35,
            height: 35,
            marginRight: 12,
            borderRadius: 4,
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: 8,
        },
        uriIcon: {
            width: 16,
            height: 16,
        },
        iconColor: {
            tintColor: theme.centerChannelColor,
        },
        container: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingBottom: 8,
            paddingHorizontal: 16,
            overflow: 'hidden',
        },
        suggestionContainer: {
            flex: 1,
        },
        suggestionDescription: {
            fontSize: 12,
            color: changeOpacity(theme.centerChannelColor, 0.56),
        },
        suggestionName: {
            fontSize: 15,
            color: theme.centerChannelColor,
            marginBottom: 4,
        },
    };
});

type Props = {
    complete: string;
    description?: string;
    hint?: string;
    onPress: (complete: string) => void;
    suggestion?: string;
    icon?: string;
}

const SlashSuggestionItem = ({
    complete = '',
    description,
    hint,
    onPress,
    suggestion,
    icon,
}: Props) => {
    const insets = useSafeAreaInsets();
    const theme = useTheme();
    const style = getStyleFromTheme(theme);

    const completeSuggestion = () => {
        onPress(complete);
    };

    let suggestionText = suggestion;
    if (suggestionText?.[0] === '/' && complete.split(' ').length === 1) {
        suggestionText = suggestionText.substring(1);
    }

    if (hint) {
        if (suggestionText?.length) {
            suggestionText += ` ${hint}`;
        } else {
            suggestionText = hint;
        }
    }

    let image = (
        <Image
            style={style.iconColor}
            width={10}
            height={16}
            source={slashIcon}
        />
    );
    if (icon === COMMAND_SUGGESTION_ERROR) {
        image = (
            <Image
                style={style.iconColor}
                width={10}
                height={16}
                source={bangIcon}
            />
        );
    } else if (icon && icon.startsWith('http')) {
        image = (
            <FastImage
                source={{uri: icon}}
                style={style.uriIcon}
            />
        );
    } else if (icon && icon.startsWith('data:')) {
        if (icon.startsWith('data:image/svg+xml')) {
            const xml = ''; // base64.decode(icon.substring('data:image/svg+xml;base64,'.length));
            image = (
                <SvgXml
                    xml={xml}
                    width={32}
                    height={32}
                />
            );
        } else {
            image = (
                <Image
                    source={{uri: icon}}
                    style={style.uriIcon}
                />
            );
        }
    }

    return (
        <TouchableWithFeedback
            onPress={completeSuggestion}
            style={{marginLeft: insets.left, marginRight: insets.right}}
            underlayColor={changeOpacity(theme.buttonBg, 0.08)}
            type={'native'}
        >
            <View style={style.container}>
                <View style={style.icon}>
                    {image}
                </View>
                <View style={style.suggestionContainer}>
                    <Text style={style.suggestionName}>{`${suggestionText}`}</Text>
                    {Boolean(description) &&
                        <Text
                            ellipsizeMode='tail'
                            numberOfLines={1}
                            style={style.suggestionDescription}
                        >
                            {description}
                        </Text>
                    }
                </View>
            </View>
        </TouchableWithFeedback>
    );
};

export default SlashSuggestionItem;
