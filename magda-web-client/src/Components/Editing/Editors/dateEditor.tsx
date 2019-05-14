import React, { useState } from "react";
import "react-dates/initialize";
import "react-dates/lib/css/_datepicker.css";

import { SingleDatePicker, DateRangePicker } from "react-dates";
import Moment from "moment";

import Editor from "./Editor";
import { ListMultiItemEditor } from "./multiItem";
import { Interval } from "Components/Dataset/Add/DatasetAddCommon";

import Styles from "Components/Editing/Editors/dateEditor.module.scss";

const FORMAT = "DD/MM/YYYY";

function formatDateForOutput(date: Date | undefined | null) {
    return date ? Moment(date).format(FORMAT) : "Unknown";
}

function MagdaSingleDatePicker({
    date,
    callback
}: {
    date?: Date;
    callback: Function;
}) {
    const [focused, setFocused] = useState(false);

    const onDateChange = (moment: Moment.Moment | null) => {
        callback(moment && moment.toDate());
    };

    return (
        <span className={Styles.wrapper}>
            <SingleDatePicker
                date={Moment(date)}
                onDateChange={onDateChange}
                id={Math.random().toString()}
                focused={focused}
                onFocusChange={state => setFocused(!!state.focused)}
                isOutsideRange={() => false}
                displayFormat={FORMAT}
                showClearDate
                noBorder
                small
                showDefaultInputIcon
            />
        </span>
    );
}

export const dateEditor: Editor<Date> = {
    edit: (value: Date | undefined, onChange: (date: Date) => void) => {
        return <MagdaSingleDatePicker callback={onChange} date={value} />;
    },
    view: (value: Date | undefined) => {
        return <React.Fragment>{formatDateForOutput(value)}</React.Fragment>;
    }
};

function MagdaDateRangePicker(props: {
    value: Interval | undefined;
    onChange: Function;
}) {
    const [focusedInput, setFocusedInput] = useState(null as (
        | "startDate"
        | "endDate"
        | null));

    const onDatesChange = ({
        startDate,
        endDate
    }: {
        startDate: Moment.Moment | null;
        endDate: Moment.Moment | null;
    }) => {
        props.onChange({
            start: startDate && startDate.toDate(),
            end: endDate && endDate.toDate()
        });
    };

    return (
        <span className={Styles.wrapper}>
            <DateRangePicker
                startDate={
                    props.value && props.value.start
                        ? Moment(props.value.start)
                        : null
                }
                endDate={
                    props.value && props.value.end
                        ? Moment(props.value.end)
                        : null
                }
                onDatesChange={onDatesChange}
                startDateId={Math.random().toString()}
                endDateId={Math.random().toString()}
                focusedInput={focusedInput}
                onFocusChange={focusedInput => setFocusedInput(focusedInput)}
                isOutsideRange={() => false}
                displayFormat={FORMAT}
                noBorder
                small
                showDefaultInputIcon
            />
        </span>
    );
}

export const dateIntervalEditor: Editor<Interval> = {
    edit: (value: Interval | undefined, onChange: Function) => {
        return <MagdaDateRangePicker value={value} onChange={onChange} />;
    },
    view: (value: Interval | undefined) => {
        return (
            <React.Fragment>
                {formatDateForOutput(value && value.start)} -{" "}
                {formatDateForOutput(value && value.end)}
            </React.Fragment>
        );
    }
};

export const multiDateIntervalEditor: Editor<
    Interval[]
> = ListMultiItemEditor.create(
    dateIntervalEditor,
    () => {
        return {
            start: undefined,
            end: undefined
        };
    },
    (value: Interval) => !!value.start && !!value.end,
    true
);