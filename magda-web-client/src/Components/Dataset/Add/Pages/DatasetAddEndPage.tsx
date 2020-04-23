import "./DatasetAddEndPage.scss";

import giantTickIcon from "assets/giant-tick.svg";
import draftIcon from "assets/format-active.svg";
import printIcon from "assets/print.svg";
import React from "react";

// If you are not in preview mode
export default function DatasetAddEndPage() {
    return (
        <div className="row">
            <div className="col-sm-12 end-preview-page-1">
                <div className="end-preview-container-1">
                    <img src={giantTickIcon} className="giant-tick" />
                    <h2>You're all done!</h2>
                </div>
                <br />
                <div className="end-preview-container-2">
                    <h3>
                        Your dataset has been successfully sent off for
                        approval.
                    </h3>
                    <br />
                    <p className="dataset-status-txt">
                        You can view the status of your dataset from{" "}
                        <a href="/">your home page</a>.
                    </p>
                </div>
                <br />
                <br />
                <br />
            </div>
            <div className="end-preview-page-2">
                <button className="au-btn next-button end-preview-button draft-dataset-btn">
                    <img className="draft-image-icon" src={draftIcon} />
                    <p className="draft-dataset-txt">View your draft dataset</p>
                </button>
                <br />
                <br />
                <button className="au-btn next-button end-preview-button print-metadata-btn">
                    <img className="print-icon" src={printIcon} />
                    <p className="print-metadata-txt">
                        Print a copy of your metadata
                    </p>
                </button>
            </div>
        </div>
    );
}