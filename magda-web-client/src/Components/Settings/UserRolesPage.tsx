import React, { FunctionComponent } from "react";
import { useParams } from "react-router-dom";
import "./main.scss";
import SideNavigation from "./SideNavigation";
import Breadcrumb from "./Breadcrumb";
import AccessVerification from "./AccessVerification";
import RolesDataGrid from "./RolesDataGrid";
import { getUserById } from "api-clients/AuthApis";
import { useAsync } from "react-async-hook";

type PropsType = {};

const UserRolesPage: FunctionComponent<PropsType> = (props) => {
    const { userId } = useParams<{ userId: string }>();

    const { result: user } = useAsync(
        async (userId: string) => {
            if (!userId) {
                return undefined;
            }
            return await getUserById(userId);
        },
        [userId]
    );

    return (
        <div className="flex-main-container setting-page-main-container roles-page">
            <SideNavigation />
            <div className="main-content-container">
                <Breadcrumb
                    items={[
                        { to: "/settings/users", title: "Users" },
                        {
                            title: user?.displayName
                                ? `Roles of User: ${user?.displayName}`
                                : "Roles"
                        }
                    ]}
                />
                <AccessVerification operationUri="authObject/role/read" />

                <RolesDataGrid queryParams={{ user_id: userId }} />
            </div>
        </div>
    );
};

export default UserRolesPage;
