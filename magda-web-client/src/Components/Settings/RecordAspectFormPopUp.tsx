import React, {
    ForwardRefRenderFunction,
    useState,
    forwardRef,
    useImperativeHandle,
    useRef
} from "react";
import Modal from "rsuite/Modal";
import Button from "rsuite/Button";
import Placeholder from "rsuite/Placeholder";
import Loader from "rsuite/Loader";
import Message from "rsuite/Message";
import SelectPicker from "rsuite/SelectPicker";
import { useAsync, useAsyncCallback } from "react-async-hook";
import "./RecordAspectFormPopUp.scss";
import {
    getAspectDefs,
    getRecordAspect,
    updateRecordAspect,
    RecordAspectRecord,
    AspectDefRecord
} from "api-clients/RegistryApis";
import Form from "rsuite/Form";
import reportError from "./reportError";
import { ItemDataType } from "rsuite/esm/@types/common";

interface AspectDefDropdownItemType extends ItemDataType {
    rawData: AspectDefRecord;
}

const Paragraph = Placeholder.Paragraph;

type PropsType = {
    recordId: string;
};

type SubmitCompleteHandlerType = (submittedAspectId: string) => void;

export type RefType = {
    open: (aspectId?: string, onComplete?: SubmitCompleteHandlerType) => void;
    close: () => void;
};

const RecordAspectFormPopUp: ForwardRefRenderFunction<RefType, PropsType> = (
    props,
    ref
) => {
    const { recordId } = props;
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [aspectId, setAspectId] = useState<string>();
    const [aspect, setAspect] = useState<Partial<RecordAspectRecord>>();
    const isCreateForm = aspectId ? false : true;
    const onCompleteRef = useRef<SubmitCompleteHandlerType>();
    const [aspectReloadToken, setAspectReloadToken] = useState<string>("");

    useImperativeHandle(ref, () => ({
        open: (
            selectAspectId?: string,
            onComplete?: SubmitCompleteHandlerType
        ) => {
            onCompleteRef.current = onComplete;
            if (typeof selectAspectId === "string") {
                selectAspectId = selectAspectId.trim();
                if (selectAspectId) {
                    setAspectId(selectAspectId);
                }
                if (selectAspectId === aspectId) {
                    setAspectReloadToken(`${Math.random()}`);
                }
            }
            setIsOpen(true);
        },
        close: () => setIsOpen(false)
    }));

    const { loading, error } = useAsync(
        async (
            recordId: string,
            aspectId?: string,
            recordReloadToken?: string
        ) => {
            if (!aspectId) {
                setAspect(undefined);
            } else {
                const aspectData = await getRecordAspect(
                    recordId,
                    aspectId,
                    true
                );
                setAspect({
                    id: aspectId,
                    data: aspectData
                });
            }
        },
        [recordId, aspectId, aspectReloadToken]
    );

    const submitData = useAsyncCallback(async () => {
        try {
            if (typeof recordId !== "string" || !recordId.trim()) {
                throw new Error("Record ID can't be blank!");
            }
            if (typeof aspect?.id !== "string" || !aspect.id.trim()) {
                throw new Error("Aspect ID can't be blank!");
            }
            if (typeof aspect?.data !== "object") {
                throw new Error("Aspect data can't be an emmpty value!");
            }

            await updateRecordAspect(recordId, aspect.id, aspect.data, true);
            setIsOpen(false);
            if (typeof onCompleteRef.current === "function") {
                onCompleteRef.current(aspect.id);
            }
        } catch (e) {
            reportError(
                `Failed to ${
                    isCreateForm
                        ? "create record aspect"
                        : "update record aspect"
                }: ${e}`
            );
            throw e;
        }
    });

    const {
        result: aspectDefDropdownData,
        loading: loadingAspectDefDropdownData
    } = useAsync(async () => {
        try {
            if (!isCreateForm) {
                // not create form, not need to generate aspect def select dropdown
                return [];
            }
            const aspectDefs = await getAspectDefs(true);
            return aspectDefs.map(
                (item) =>
                    ({
                        value: item.id,
                        label: item.name,
                        rawData: item
                    } as AspectDefDropdownItemType)
            );
        } catch (e) {
            reportError(`Failed to retrieve aspect definition list: ${e}`);
            throw e;
        }
    }, []);

    return (
        <Modal
            className="record-aspect-form-popup"
            size="lg"
            backdrop={"static"}
            keyboard={false}
            open={isOpen}
            onClose={() => setIsOpen(false)}
        >
            <Modal.Header>
                <Modal.Title>
                    {isCreateForm
                        ? "Create Record Aspect"
                        : "Edit Record Aspect"}
                </Modal.Title>
            </Modal.Header>

            <Modal.Body>
                {loading ? (
                    <Paragraph rows={8}>
                        <Loader center content="loading" />
                    </Paragraph>
                ) : error ? (
                    <Message showIcon type="error" header="Error">
                        Failed to retrieve record aspect: {`${error}`}
                    </Message>
                ) : (
                    <>
                        {submitData.loading ? (
                            <Loader
                                backdrop
                                content={`${
                                    isCreateForm ? "Creating" : "updating"
                                } record aspect...`}
                                vertical
                            />
                        ) : null}
                        <Form className="record-aspect-form-popup-form" fluid>
                            <Form.Group controlId="aspect-id">
                                <Form.ControlLabel>Aspect ID</Form.ControlLabel>
                                {isCreateForm ? (
                                    <SelectPicker
                                        block
                                        data={
                                            aspectDefDropdownData
                                                ? aspectDefDropdownData
                                                : []
                                        }
                                    />
                                ) : (
                                    <Form.Control
                                        name="id"
                                        disabled={
                                            !isCreateForm || submitData.loading
                                        }
                                    />
                                )}

                                {isCreateForm ? (
                                    <Form.HelpText>Required</Form.HelpText>
                                ) : null}
                            </Form.Group>
                            <Form.Group controlId="record-name">
                                <Form.ControlLabel>
                                    Record Name
                                </Form.ControlLabel>
                                <Form.Control
                                    name="name"
                                    disabled={submitData.loading}
                                />
                                <Form.HelpText>Required</Form.HelpText>
                            </Form.Group>
                        </Form>
                    </>
                )}
            </Modal.Body>
            <Modal.Footer>
                <Button appearance="primary" onClick={submitData.execute}>
                    {isCreateForm ? "Create" : "Update"}
                </Button>
                <Button onClick={() => setIsOpen(false)}>Cancel</Button>
            </Modal.Footer>
        </Modal>
    );
};

export default forwardRef<RefType, PropsType>(RecordAspectFormPopUp);
