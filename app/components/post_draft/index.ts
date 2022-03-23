// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {withDatabase} from '@nozbe/watermelondb/DatabaseProvider';
import withObservables from '@nozbe/with-observables';
import {combineLatest, of as of$, from as from$} from 'rxjs';
import {switchMap} from 'rxjs/operators';

import {General, Permissions} from '@constants';
import {observeChannel} from '@queries/servers/channel';
import {queryDraft} from '@queries/servers/drafts';
import {observeConfigBooleanValue, observeCurrentChannelId} from '@queries/servers/system';
import {observeCurrentUser, observeUser} from '@queries/servers/user';
import {hasPermissionForChannel} from '@utils/role';
import {isSystemAdmin, getUserIdFromChannelName} from '@utils/user';

import PostDraft from './post_draft';

import type {WithDatabaseArgs} from '@typings/database/database';
import type DraftModel from '@typings/database/models/servers/draft';

type OwnProps = {
    channelId: string;
    channelIsArchived?: boolean;
    rootId?: string;
}

const observeFirst = (v: DraftModel[]) => v[0]?.observe() || of$(undefined);

const enhanced = withObservables([], (ownProps: WithDatabaseArgs & OwnProps) => {
    const {database, rootId = ''} = ownProps;
    let channelId = of$(ownProps.channelId);
    if (!ownProps.channelId) {
        channelId = observeCurrentChannelId(database);
    }

    const draft = channelId.pipe(
        switchMap((cId) => queryDraft(database, cId, rootId).observeWithColumns(['message', 'files']).pipe(
            switchMap(observeFirst),
        )),
    );

    const files = draft.pipe(switchMap((d) => of$(d?.files)));
    const message = draft.pipe(switchMap((d) => of$(d?.message)));

    const currentUser = observeCurrentUser(database);

    const channel = channelId.pipe(
        switchMap((id) => observeChannel(database, id!)),
    );

    const canPost = combineLatest([channel, currentUser]).pipe(switchMap(([c, u]) => (c && u ? from$(hasPermissionForChannel(c, u, Permissions.CREATE_POST, false)) : of$(false))));
    const channelIsArchived = channel.pipe(switchMap((c) => (ownProps.channelIsArchived ? of$(true) : of$(c?.deleteAt !== 0))));

    const experimentalTownSquareIsReadOnly = observeConfigBooleanValue(database, 'ExperimentalTownSquareIsReadOnly');
    const channelIsReadOnly = combineLatest([currentUser, channel, experimentalTownSquareIsReadOnly]).pipe(
        switchMap(([u, c, readOnly]) => of$(c?.name === General.DEFAULT_CHANNEL && !isSystemAdmin(u?.roles || '') && readOnly)),
    );

    const deactivatedChannel = combineLatest([currentUser, channel]).pipe(
        switchMap(([u, c]) => {
            if (!u || !c) {
                return of$(false);
            }
            if (c.type !== General.DM_CHANNEL) {
                return of$(false);
            }
            const teammateId = getUserIdFromChannelName(u.id, c.name);
            if (teammateId) {
                return observeUser(database, teammateId).pipe(
                    switchMap((u2) => (u2 ? of$(Boolean(u2.deleteAt)) : of$(false))), // eslint-disable-line max-nested-callbacks
                );
            }
            return of$(true);
        }),
    );

    return {
        canPost,
        channelIsArchived,
        channelIsReadOnly,
        deactivatedChannel,
        files,
        message,
    };
});

export default withDatabase(enhanced(PostDraft));
