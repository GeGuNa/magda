import {} from "mocha";
import { expect } from "chai";
import ServiceRunner from "../ServiceRunner";
import { v4 as uuidV4 } from "uuid";
import AuthApiClient from "magda-typescript-common/src/authorization-api/ApiClient";
import { DEFAULT_ADMIN_USER_ID } from "magda-typescript-common/src/authorization-api/constants";
import RegistryApiClient from "magda-typescript-common/src/registry/AuthorizedRegistryClient";
import unionToThrowable from "magda-typescript-common/src/util/unionToThrowable";

const ENV_SETUP_TIME_OUT = 300000; // -- 5 mins
const jwtSecret = uuidV4();
const authApiClient = new AuthApiClient(
    "http://localhost:6104/v0",
    jwtSecret,
    DEFAULT_ADMIN_USER_ID
);

const getRegistryClient = (userId: string) =>
    new RegistryApiClient({
        baseUrl: "http://localhost:6101/v0",
        maxRetries: 0,
        tenantId: 0,
        jwtSecret: jwtSecret,
        userId
    });

describe("registry auth integration tests", () => {
    describe("Test Dataset Metadata Creation Workflow", function (this) {
        this.timeout(300000);
        const serviceRunner = new ServiceRunner();
        serviceRunner.enableRegistryApi = true;
        serviceRunner.jwtSecret = jwtSecret;

        let authenticatedUserId: string;
        let dataStewardUserId: string;

        //let draftDatasetId: string;

        before(async function (this) {
            this.timeout(ENV_SETUP_TIME_OUT);
            await serviceRunner.create();
            const authticatedUser = await authApiClient.createUser({
                displayName: "Test AuthtenticatedUser",
                email: "test@test.com",
                source: "internal",
                sourceId: uuidV4()
            });
            authenticatedUserId = authticatedUser.id;
            const dataStewardUser = await authApiClient.createUser({
                displayName: "Test AuthtenticatedUser",
                email: "test@test.com",
                source: "internal",
                sourceId: uuidV4()
            });
            dataStewardUserId = dataStewardUser.id;
            authApiClient;
        });

        after(async function (this) {
            this.timeout(ENV_SETUP_TIME_OUT);
            await serviceRunner.destroy();
        });

        it("should allow data steward user to create draft dataset with correct correct access", async () => {
            const registryClientDataSteward = getRegistryClient(
                dataStewardUserId
            );
            const registryClientAuthenticatedUser = getRegistryClient(
                authenticatedUserId
            );
            const datasetSetId = uuidV4();
            let result = await registryClientDataSteward.putRecord({
                id: datasetSetId,
                name: "test draft dataset",
                aspects: {
                    "dataset-draft": {
                        dataset: {
                            name: "test draft dataset"
                        },
                        data: "{}",
                        timeStamp: "Sun Apr 10 2022 15:33:56 GMT+1000"
                    },
                    "access-control": {
                        ownerId: dataStewardUserId
                    }
                },
                tenantId: 0,
                sourceTag: "",
                // authnReadPolicyId is deprecated and to be removed
                authnReadPolicyId: ""
            });
            expect(result).to.not.be.an.instanceof(Error);

            // authenticatedUser has no access to te draft dataset.
            result = await registryClientAuthenticatedUser.getRecord(
                datasetSetId
            );
            expect(result).to.be.an.instanceof(Error);

            // data steward has access to the draft dataset.
            result = await registryClientDataSteward.getRecord(datasetSetId);
            expect(result).to.not.be.an.instanceof(Error);
            expect(unionToThrowable(result).id).to.equal(datasetSetId);
        });
    });
});
