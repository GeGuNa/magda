import * as express from "express";

import Database from "./Database";
import { Content } from "./model";

export interface ApiRouterOptions {
    database: Database;
    jwtSecret: string;
}

export default function createApiRouter(options: ApiRouterOptions) {
    const database = options.database;

    const router: express.Router = express.Router();

    router.get("/:contentId.:format", async function(req, res) {
        const contentId = req.params.contentId;
        const format = req.params.format;
        try {
            const maybeContent = await database.getContentById(contentId);
            const content = maybeContent.caseOf({
                nothing: () => null,
                just: x => x
            });

            if (content === null) {
                res.status(404).end();
                return;
            }

            switch (format) {
                case "gif":
                    return returnImage(res, content, "image/gif");
                case "json":
                    return returnJSON(res, content);
                case "png":
                    return returnImage(res, content, "image/png");
                case "svg":
                    return returnImage(res, content, "image/svg+xml");
                case "text":
                    return returnText(res, content);
                default:
                    throw new Error(`Unsupported format requested: ${format}`);
            }
        } catch (e) {
            res.status(500).end();
            console.error(e);
        }
    });

    // This is for getting a JWT in development so you can do fake authenticated requests to a local server.
    if (process.env.NODE_ENV !== "production") {
        router.get("public/jwt", function(req, res) {
            res.status(200);
            res.write("X-Magda-Session: " + req.header("X-Magda-Session"));
            res.send();
        });
    }

    return router;
}

function returnImage(res: any, content: Content, mime: string) {
    const buffer = Buffer.from(content.content, "base64");
    res.header("Content-Type", mime).send(buffer);
}

function returnJSON(res: any, content: Content) {
    JSON.parse(content.content);
    res.header("Content-Type", "application/json").send(content.content);
}

function returnText(res: any, content: Content) {
    res.header("Content-Type", "text/plain").send(content.content);
}
