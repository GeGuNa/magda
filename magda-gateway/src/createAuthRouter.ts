import { Router } from "express";
import fetch from "isomorphic-fetch";
import ApiClient from "magda-typescript-common/src/authorization-api/ApiClient";
import addTrailingSlash from "magda-typescript-common/src/addTrailingSlash";
import Authenticator from "./Authenticator";
import createAuthPluginRouter, {
    AuthPluginBasicConfig,
    AuthPluginConfig
} from "./createAuthPluginRouter";
import passport from "passport";

export interface AuthRouterOptions {
    authenticator: Authenticator;
    jwtSecret: string;
    facebookClientId: string;
    facebookClientSecret: string;
    authorizationApi: string;
    externalUrl: string;
    userId: string;
    plugins: AuthPluginBasicConfig[];
}

export default function createAuthRouter(options: AuthRouterOptions): Router {
    const authRouter: Router = Router();
    const authApi = new ApiClient(
        options.authorizationApi,
        options.jwtSecret,
        options.userId
    );
    const authenticatorMiddleware =
        options.authenticator.authenticatorMiddleware;

    const providers = [
        {
            id: "facebook",
            enabled: options.facebookClientId ? true : false,
            authRouter: options.facebookClientId
                ? require("./oauth2/facebook").default({
                      authorizationApi: authApi,
                      passport: passport,
                      clientId: options.facebookClientId,
                      clientSecret: options.facebookClientSecret,
                      externalAuthHome: `${options.externalUrl}/auth`
                  })
                : null
        }
    ];

    /**
     * @apiGroup Authentication API
     * @api {get} https://<host>/auth/plugins Get the list of available authentication plugins
     * @apiDescription Returns all installed authentication plugins. This endpoint is only available when gateway `enableAuthEndpoint`=true
     *
     * @apiSuccessExample {json} 200
     *    [{
     *        "key":"google",
     *        "name":"Google",
     *        "iconUrl":"http://xxx/sds/sds.jpg",
     *        "authenticationMethod": "IDP-URI-REDIRECTION"
     *    }]
     *
     */
    authRouter.get("/plugins", async (req, res) => {
        if (!options?.plugins?.length) {
            res.json([]);
            return;
        }

        const data = await Promise.all(
            options.plugins.map(async (plugin) => {
                try {
                    const res = await fetch(
                        addTrailingSlash(plugin.baseUrl) + "config"
                    );
                    const data = (await res.json()) as AuthPluginConfig;
                    return {
                        ...data,
                        key: plugin.key
                    };
                } catch (e) {
                    // when failed to load, skip loading this config item by returning null
                    console.error(
                        `Failed to load authentication plugin config from ${plugin.baseUrl}: ` +
                            e
                    );
                    return null;
                }
            })
        );

        res.json(data.filter((item) => !!item));
    });

    // setup auth plugin routes
    if (options?.plugins?.length) {
        authRouter.use(
            "/login/plugin",
            createAuthPluginRouter({
                plugins: options.plugins
            })
        );
    }

    providers
        .filter((provider) => provider.enabled)
        .forEach((provider) => {
            authRouter.use("/login/" + provider.id, [
                // actually, body-parser is only required by localStrategy (i.e. `internal` & ckan provider)
                // since we are moving all auth providers to external auth plugins soon, we add bodyParser to all providers routes as before
                require("body-parser").urlencoded({ extended: true }),
                authenticatorMiddleware,
                provider.authRouter
            ]);
        });

    /**
     * @apiGroup Authentication API
     * @api {get} https://<host>/auth/providers Get the list of available authentication providers (deprecated)
     * @apiDescription Returns all installed authentication providers.
     *  This endpoint is only available when gateway `enableAuthEndpoint`=true.
     *  Please note: We are gradually replacing non-plugable authenticaiton providers with [authentication plugins](https://github.com/magda-io/magda/tree/master/deploy/helm/internal-charts/gateway#authentication-plugin-config)
     *
     * @apiSuccessExample {string} 200
     *    ["facebook"]
     *
     */
    authRouter.get("/providers", (req, res) => {
        res.json(
            providers
                .filter((provider) => provider.enabled)
                .map((provider) => provider.id)
        );
    });

    /**
     * @apiGroup Authentication API
     * @api {get} https://<host>/auth/logout Explicitly logout current user session
     * @apiDescription Returns result of logout action.
     * This endpoint implements the behaviour that is described in [this doc](https://github.com/magda-io/magda/blob/master/docs/docs/authentication-plugin-spec.md#get-logout-endpoint-optional)
     * in order to support auth plugin logout process.
     * When the `redirect` query parameter does not present, this middleware should be compatible with the behaviour prior to version 0.0.60.
     * i.e.:
     * - Turn off Magda session only without forwarding any requests to auth plugins
     * - Response a JSON response (that indicates the outcome of the logout action) instead of redirect users.
     * This endpoint is only available when gateway `enableAuthEndpoint`=true
     *
     * @apiSuccessExample {json} 200
     *    {
     *        "isError": false
     *    }
     *
     * @apiErrorExample {json} 500
     *    {
     *        "isError": true,
     *        "errorCode": 500,
     *        "errorMessage": "xxxxxx"
     *    }
     *
     */
    authRouter.get("/logout", authenticatorMiddleware);

    return authRouter;
}
