import React from "react";
import { Link } from "react-router-dom";
import PropTypes from "prop-types";
import uniq from "lodash/uniq";
import reduce from "lodash/reduce";
import ucwords from "ucwords";
import "./TagsBox.scss";

const tagSeperatorRegex = /[,|;|/||]/g;

function mergeTags(tags) {
    return uniq(
        reduce(
            tags,
            (acc, cur) => {
                return acc.concat(
                    cur
                        .split(tagSeperatorRegex)
                        .map((item) => item.toLowerCase().trim())
                );
            },
            []
        )
    );
}

function TagsBox(props) {
    const title = props.title;
    return (
        <div className="tags-box">
            <div className="description-heading">{title}: </div>
            {props.content && props.content.length > 0 ? (
                <ul className="au-tags">
                    {props.content &&
                        mergeTags(props.content)
                            .sort((a, b) => {
                                if (a < b) return -1;
                                else if (a > b) return 1;
                                else return 0;
                            })
                            .map((t, idx) => (
                                <li key={idx}>
                                    <Link
                                        to={`/search?q=${encodeURIComponent(
                                            t
                                        )}`}
                                        className="au-tag"
                                    >
                                        {ucwords(t)}
                                    </Link>
                                </li>
                            ))}
                </ul>
            ) : (
                <span>No {title} defined</span>
            )}
        </div>
    );
}

TagsBox.propTypes = {
    tags: PropTypes.arrayOf(PropTypes.string),
    title: PropTypes.string
};

TagsBox.defaultProps = {
    tags: [],
    title: "Tags: "
};

export default TagsBox;
