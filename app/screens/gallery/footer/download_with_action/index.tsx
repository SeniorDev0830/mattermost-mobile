// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import CameraRoll from '@react-native-community/cameraroll';
import * as FileSystem from 'expo-file-system';
import React, {useEffect, useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import {NativeModules, Platform, StyleSheet, Text, View} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import FileViewer from 'react-native-file-viewer';
import {TouchableOpacity} from 'react-native-gesture-handler';
import {useAnimatedStyle, withTiming} from 'react-native-reanimated';
import Share from 'react-native-share';

import {downloadFile} from '@actions/remote/file';
import CompassIcon from '@components/compass_icon';
import ProgressBar from '@components/progress_bar';
import Toast from '@components/toast';
import {GALLERY_FOOTER_HEIGHT} from '@constants/gallery';
import {useServerUrl} from '@context/server';
import {alertFailedToOpenDocument} from '@utils/document';
import {fileExists, getLocalFilePathFromFile, hasWriteStoragePermission} from '@utils/file';
import {galleryItemToFileInfo} from '@utils/gallery';
import {typography} from '@utils/typography';

import type {ClientResponse, ProgressPromise} from '@mattermost/react-native-network-client';

type Props = {
    action: GalleryAction;
    item: GalleryItemType;
    setAction: (action: GalleryAction) => void;
    onDownloadSuccess?: (path: string) => void;
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        flex: 1,
        flexDirection: 'row',
    },
    toast: {
        backgroundColor: '#3F4350', // intended hardcoded color
    },
    error: {
        backgroundColor: '#D24B4E',
    },
    fileSaved: {
        backgroundColor: '#3DB887',
    },
    option: {
        alignItems: 'flex-end',
        justifyContent: 'center',
        flex: 1,
        marginTop: 8,
    },
    progress: {
        marginTop: -10,
        width: '85%',
    },
    title: {
        color: '#FFF',
        ...typography('Body', 75, 'SemiBold'),
    },
});

const DownloadWithAction = ({action, item, onDownloadSuccess, setAction}: Props) => {
    const intl = useIntl();
    const serverUrl = useServerUrl();
    const [showToast, setShowToast] = useState<boolean|undefined>();
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);
    const [progress, setProgress] = useState(0);
    const mounted = useRef(false);
    const downloadPromise = useRef<ProgressPromise<ClientResponse>>();

    let title;
    let iconName;
    let message;
    let toastStyle = styles.toast;

    switch (action) {
        case 'sharing':
            title = intl.formatMessage({id: 'gallery.preparing', defaultMessage: 'Preparing...'});
            break;
        case 'opening':
            title = intl.formatMessage({id: 'gallery.opening', defaultMessage: 'Opening...'});
            break;
        default:
            title = intl.formatMessage({id: 'gallery.downloading', defaultMessage: 'Downloading...'});
            break;
    }

    if (error) {
        iconName = 'alert-circle-outline';
        message = error;
        toastStyle = styles.error;
    } else if (saved) {
        iconName = 'check';
        toastStyle = styles.fileSaved;

        switch (item.type) {
            case 'image':
                message = intl.formatMessage({id: 'gallery.image_saved', defaultMessage: 'Image saved'});
                break;
            case 'video':
                message = intl.formatMessage({id: 'gallery.video_saved', defaultMessage: 'Video saved'});
                break;
        }
    }

    const animatedStyle = useAnimatedStyle(() => ({
        position: 'absolute',
        bottom: GALLERY_FOOTER_HEIGHT + 8,
        opacity: withTiming(showToast ? 1 : 0, {duration: 300}),
    }));

    const cancel = async () => {
        try {
            await downloadPromise.current?.cancel?.();
            const path = getLocalFilePathFromFile(serverUrl, galleryItemToFileInfo(item));
            await FileSystem.deleteAsync(path, {idempotent: true});

            downloadPromise.current = undefined;
        } catch {
            // do nothing
        } finally {
            if (mounted.current) {
                setShowToast(false);
            }
        }
    };

    const externalAction = async (response: ClientResponse) => {
        if (response.data?.path && onDownloadSuccess) {
            onDownloadSuccess(response.data.path as string);
        }
        setShowToast(false);
    };

    const openFile = async (response: ClientResponse) => {
        if (mounted.current) {
            if (response.data?.path) {
                const path = response.data.path as string;
                onDownloadSuccess?.(path);
                FileViewer.open(path, {
                    displayName: item.name,
                    showAppsSuggestions: true,
                    showOpenWithDialog: true,
                }).catch(() => {
                    const file = galleryItemToFileInfo(item);
                    alertFailedToOpenDocument(file, intl);
                });
            }
            setShowToast(false);
        }
    };

    const saveFile = async (path: string) => {
        if (mounted.current) {
            if (Platform.OS === 'android') {
                try {
                    await NativeModules.MattermostManaged.saveFile(path.replace('file://', '/'));
                } catch {
                    // do nothing in case the user decides not to save the file
                }
                setAction('none');
                return;
            }

            Share.open({
                url: path,
                saveToFiles: true,
            }).catch(() => {
                // do nothing
            });

            setAction('none');
        }
    };

    const saveImageOrVideo = async (path: string) => {
        if (mounted.current) {
            try {
                const applicationName = DeviceInfo.getApplicationName();
                await CameraRoll.save(path, {
                    type: item.type === 'image' ? 'photo' : 'video',
                    album: applicationName,
                });
                setSaved(true);
            } catch {
                setError(intl.formatMessage({id: 'gallery.save_failed', defaultMessage: 'Unable to save the file'}));
            }
        }
    };

    const save = async (response: ClientResponse) => {
        if (response.data?.path) {
            const path = response.data.path as string;
            onDownloadSuccess?.(path);
            const hasPermission = await hasWriteStoragePermission(intl);

            if (hasPermission) {
                switch (item.type) {
                    case 'file':
                        saveFile(path);
                        break;
                    default:
                        saveImageOrVideo(path);
                        break;
                }
            }
        }
    };

    const shareFile = async (response: ClientResponse) => {
        if (mounted.current) {
            if (response.data?.path) {
                const path = response.data.path as string;
                onDownloadSuccess?.(path);
                Share.open({
                    message: '',
                    title: '',
                    url: path,
                    showAppsToView: true,
                }).catch(() => {
                    // do nothing
                });
            }
            setShowToast(false);
        }
    };

    const startDownload = async () => {
        try {
            const path = getLocalFilePathFromFile(serverUrl, galleryItemToFileInfo(item));
            if (path) {
                const exists = await fileExists(path);
                let actionToExecute: (response: ClientResponse) => Promise<void>;
                switch (action) {
                    case 'sharing':
                        actionToExecute = shareFile;
                        break;
                    case 'opening':
                        actionToExecute = openFile;
                        break;
                    case 'external':
                        actionToExecute = externalAction;
                        break;
                    default:
                        actionToExecute = save;
                        break;
                }
                if (exists) {
                    setProgress(100);
                    actionToExecute({
                        code: 200,
                        ok: true,
                        data: {path},
                    });
                } else {
                    downloadPromise.current = downloadFile(serverUrl, item.id!, path);
                    downloadPromise.current?.then(actionToExecute).catch(() => {
                        setError(intl.formatMessage({id: 'download.error', defaultMessage: 'Unable to download the file. Try again later'}));
                    });
                    downloadPromise.current?.progress?.(setProgress);
                }
            }
        } catch (e) {
            setShowToast(false);
        }
    };

    useEffect(() => {
        mounted.current = true;
        setShowToast(true);
        startDownload();

        return () => {
            mounted.current = false;
        };
    }, []);

    useEffect(() => {
        let t: NodeJS.Timeout;
        if (error || saved) {
            t = setTimeout(() => {
                setShowToast(false);
            }, 3500);
        }

        return () => clearTimeout(t);
    }, [error, saved]);

    useEffect(() => {
        let t: NodeJS.Timeout;
        if (showToast === false) {
            t = setTimeout(() => {
                if (mounted.current) {
                    setAction('none');
                }
            }, 350);
        }

        return () => clearTimeout(t);
    }, [showToast]);

    return (
        <Toast
            animatedStyle={animatedStyle}
            style={toastStyle}
            message={message}
            iconName={iconName}
        >
            {!error && !saved &&
                <View style={styles.container}>
                    <View style={styles.progress}>
                        <Text style={styles.title}>{title}</Text>
                        <ProgressBar
                            color='#fff'
                            progress={progress}
                            style={{marginTop: 5}}
                        />
                    </View>
                    <View style={styles.option}>
                        <TouchableOpacity onPress={cancel}>
                            <CompassIcon
                                color='#FFF'
                                name='close'
                                size={24}
                            />
                        </TouchableOpacity>
                    </View>
                </View>
            }
        </Toast>
    );
};

export default DownloadWithAction;
