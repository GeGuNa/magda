import { config, DATASETS_BUCKET } from "config";
import getStorageUrl from "@magda/typescript-common/dist/getStorageUrl";
import promisifySetState from "helpers/promisifySetState";
import { DatasetStateUpdaterType } from "../../DatasetAddCommon";
import urijs from "urijs";
import uniq from "lodash/uniq";

export default async function uploadFile(
    datasetId: string,
    file: File,
    distId: string,
    datasetStateUpdater: DatasetStateUpdaterType,
    onProgressUpdate: (progress: number) => void,
    saveDatasetToStorage: () => Promise<string>
) {
    // Save first, so that the record id will be present.
    await saveDatasetToStorage();

    const fileStorageUrl = getStorageUrl(datasetId, distId, file.name);
    const [processedDatasetId, processedDistId, processedfileName] = urijs(
        fileStorageUrl
    ).segmentCoded();

    const formData = new FormData();
    formData.append(processedfileName, file, processedfileName);

    const fetchUri = urijs(config.storageApiUrl);
    const fetchUrl = fetchUri
        .segmentCoded([
            ...fetchUri.segmentCoded(),
            "upload",
            DATASETS_BUCKET,
            processedDatasetId,
            processedDistId
        ])
        .search({ recordId: datasetId })
        .toString();

    let uploadProgress = 0;
    const fakeProgressInterval = setInterval(() => {
        uploadProgress += (1 - uploadProgress) / 4;
        onProgressUpdate(uploadProgress);
    }, 1000);

    try {
        const res = await fetch(fetchUrl, {
            ...config.credentialsFetchOptions,
            method: "POST",
            body: formData
        });
        if (res.status !== 200) {
            throw new Error("Could not upload file");
        }
        // --- successfully upload the file, add to state.uploadedFileUrls
        await promisifySetState(datasetStateUpdater)((state) => ({
            ...state,
            uploadedFileUrls: uniq([...state.uploadedFileUrls, fileStorageUrl])
        }));

        // --- save a draft to storage
        // --- we should do that even for edit flow so that there is no files will be lost track
        await saveDatasetToStorage();
    } finally {
        uploadProgress = 1;
        onProgressUpdate(uploadProgress);
        clearInterval(fakeProgressInterval);
    }
}
