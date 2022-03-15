import React, { useState } from "react";
import { RouterProps, withRouter } from "react-router-dom";
import { connect } from "react-redux";

import { loadState, State } from "./DatasetAddCommon";
import { User } from "reducers/userManagementReducer";
import { config } from "config";
import { useAsync } from "react-async-hook";
import { findPermissionGap } from "helpers/accessControlUtils";

/* eslint-disable react-hooks/rules-of-hooks */

type Props = { initialState: State; user: User } & RouterProps;

function mapStateToProps(state: any) {
    return {
        user: state.userManagement && (state.userManagement.user as User),
        isFetchingWhoAmI: state.userManagement.isFetchingWhoAmI as boolean
    };
}

function hasMetaDataCreationToolAccess(user: User) {
    return findPermissionGap(
        [
            "object/dataset/draft/read",
            "object/dataset/published/read",
            "object/dataset/draft/create",
            "object/dataset/draft/update",
            "object/dataset/published/create",
            "object/dataset/published/update"
        ],
        user
    );
}

export default <T extends Props>(Component: React.ComponentType<T>) => {
    const withAddDatasetState = (props: T) => {
        const missingOperations = hasMetaDataCreationToolAccess(props.user);
        const isDisabled =
            !config.featureFlags.previewAddDataset && missingOperations?.length;

        const [state, updateData] = useState<State | undefined>(undefined);
        const { loading, error } = useAsync(
            async (isDisabled, datasetId, user) => {
                if (isDisabled || !datasetId) {
                    return;
                }
                const datasetState = await loadState(datasetId, user);
                updateData(datasetState);
            },
            [isDisabled, props.match.params.datasetId, props.user]
        );

        if (props.isFetchingWhoAmI) {
            return <div>Loading...</div>;
        } else if (isDisabled) {
            return (
                <div
                    className="au-body au-page-alerts au-page-alerts--error"
                    style={{ marginTop: "50px" }}
                >
                    <div>
                        You need permissions of the following operations to
                        access this page:
                        <ul>
                            {missingOperations.map((operationUri, idx) => (
                                <li key={idx}>{operationUri}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            );
        } else if ((!state || loading) && !error) {
            return <div>Loading...</div>;
        } else if (error) {
            return <div>Failed to load dataset data: {"" + error}</div>;
        } else {
            return <Component {...props} initialState={state} />;
        }
    };

    return connect(mapStateToProps)(withRouter(withAddDatasetState));
};

/* eslint-enable react-hooks/rules-of-hooks */
