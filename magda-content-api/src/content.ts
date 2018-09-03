/**
 * We configure a list of assets we maintain here.
 */

/**
 * @apiDefine Content Content API
 *
 * Contents are dynamically configurable assets which are persisted in a
 * database. They are intended to support the magda UI/client.
 * They are identified by a string content id (e.g. "logo").
 * They are all encoded as text prior to storage in database and
 * are decoded prior to serving.
 *
 * The following content items (ids) are currently present:
 *
 * * "logo" - site logo - a png, gif, jpeg, webp or svg image - encoded as base64.
 */

const bodyParser = require("body-parser");

/**
 * Any encoding we perform on the content.
 */
export enum ContentEncoding {
    base64 // binary content are stored as base64 in the db
}

export interface ContentItem {
    body?: any; // <-- express middleware can go here
    encode?: ContentEncoding;
    contentType?: string;
    /**
     * TODO: if needed, add a schema property for json validation
     * TODO: if needed, add a custom validation callback function
     */
}

export const content: { [s: string]: ContentItem } = {
    logo: {
        body: bodyParser.raw({
            type: [
                "image/png",
                "image/gif",
                "image/jpeg",
                "image/webp",
                "image/svg+xml"
            ]
        }),
        encode: ContentEncoding.base64
    }
};
