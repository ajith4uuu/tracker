import { useEffect, useRef, useState } from "react";
import { consoleLog, validateQuestionField } from "~/lib/utils";

import SignPad from "./signPad/signPad";
import RangeSlider from "./rangeSlider/rangeSlider";
import DatePicker from "./datePicker/datePicker";
import { CONSENT_FILE_QUESTION_FIELD_NAME } from "~/constant";

export const NON_ANSWERABLE_QUESTION_TYPES = [
    'heading', 'descriptive'
];

export function QuestionField(
    {question, questionIndex, value, setQuestionValue, language = 'en'}
    :
    {question: any, questionIndex: any, value: any, setQuestionValue: any, language: any}
) {
    const [ options, setOptions ] = useState<any>([]);

    const onFieldChanged = (e: any) => {
        let value = null

        if (['sign', 'signature', 'date'].includes(question.type)) {
            value = e
        } else {
            let element = e.target
            value = element.value

            // consoleLog('onFieldChanged', e, element, value, element.tagName, element.type, element.checked)

            if (element.tagName == 'INPUT' && ['checkbox', 'radio'].includes(element.type)) {
                if (!element.checked) {
                    value = null
                }
            }
        }

        setQuestionValue(questionIndex, value)
    };

    const resetQuestionValue = (e: any) => {
        e.preventDefault()
        e.stopPropagation()

        if (document.activeElement) document.activeElement.blur()

        setQuestionValue(questionIndex, null)
    }

    useEffect(() => {
        let formattedOpts: any = [];

        if (question) {
            let tempOpts = '';

            if (question[`options_${language}`]) {
                tempOpts = question[`options_${language}`]
            } else if (question[`choices_${language}`]) {
                tempOpts = question[`choices_${language}`]
            } else if (question.options) {
                tempOpts = question.options;
            } else if (question.choices) {
                tempOpts = question.choices;
            }

            if (tempOpts && typeof(tempOpts) === 'string' && tempOpts.length > 0) {
                if (tempOpts.indexOf('||') > -1) {
                    tempOpts.split('||').map(t => t.trim()).forEach(t => {
                        let tSplit = t.split('|')

                        if (tSplit.length > 1) {
                            formattedOpts.push({
                                'value': tSplit[0],
                                'label': tSplit[1],
                            })
                        }
                    })
                } else if (tempOpts.indexOf('|') > -1) {
                    tempOpts.split('|').map(t => t.trim()).forEach(t => {
                        formattedOpts.push({
                            'value': t,
                            'label': t,
                        })
                    })
                } else if (tempOpts.indexOf('\n') > -1) {
                    tempOpts.split('\n').map(t => t.trim()).forEach(t => {
                        if (t.indexOf('|') > -1) {
                            let tSplit = t.split('|')

                            if (tSplit.length > 1) {
                                formattedOpts.push({
                                    'value': tSplit[1],
                                    'label': tSplit[0],
                                })
                            }
                        } else {
                            formattedOpts.push({
                                'value': t,
                                'label': t,
                            })
                        }
                    })
                }
            }
        }

        setOptions(formattedOpts);
    }, [language]);

    return (
        <div
        className={
            "question-field " +
            (
                question.type == 'calc' && question.name != CONSENT_FILE_QUESTION_FIELD_NAME ? 'is-hidden ' : ''
            )
        }
        data-question-id={question.id}
        data-question-name={question.name} {...(question.sequence && {"data-seq": question.sequence})}>

            {
                question.type == 'heading' && <h5 className="is-size-5 mt-5" dangerouslySetInnerHTML={{ __html: (question[`label_${language}`] ?? question.label) }}></h5>
            }

            {
                question.type == 'descriptive' && <p className="descriptive-content mt-5"  dangerouslySetInnerHTML={{ __html: (question[`label_${language}`] ?? question.label) }}></p>
            }

            {
                !['heading', 'descriptive'].includes(question.type) &&
                <div className={"field is-horizontal mt-5 " + (question.is_required ? 'is-required-field' : '')}>
                    {
                        question.type != 'checkbox' &&
                        <div className={"field-label " + ((question[`label_${language}`] ?? question.label) ? '' : 'empty-label')}>
                            <label className="label"  dangerouslySetInnerHTML={{ __html: (question[`label_${language}`] ?? question.label) }}></label>
                        </div>
                    }

                    <div className="field-body">
                        <div className="field">
                            <div className={"control " + ((['text', 'date'].includes(question.type) && question.error) ? 'has-icons-right' : '')}>
                                {/* Render textbox */}
                                {
                                    question.type == 'text' &&
                                    <>
                                        <input
                                            type="text"
                                            className={"input " + (question.error ? 'is-danger' : '')}
                                            id={"question-" + question.id}
                                            value={value ?? ''}
                                            onChange={onFieldChanged} />

                                        {
                                            question.error &&
                                            <span className="icon is-small is-right"><i className="fa-solid fa-triangle-exclamation"></i></span>
                                        }
                                    </>
                                }

                                {/* Render date field */}
                                {
                                    question.type == 'date' &&
                                    <>
                                        <DatePicker
                                            id={"question-" + question.id}
                                            value={value ?? null}
                                            error={question.error}
                                            onChange={onFieldChanged} />
                                    </>
                                }

                                {/* Render select field */}
                                {
                                    ['select', 'dropdown'].includes(question.type) &&
                                    <>
                                        <div className="select">
                                            <select
                                                id={"question-" + question.id}
                                                value={value ?? ''}
                                                onChange={onFieldChanged}>
                                                <option value=""></option>
                                                {
                                                    options.map((option, i) => {
                                                        return (
                                                            <option
                                                                key={"question-" + question.id + '-' + i}
                                                                value={option.value}>{(option[`label_${language}`] ?? option.label)}</option>
                                                        )
                                                    })
                                                }
                                            </select>
                                        </div>

                                        {
                                            question.error &&
                                            <span className="icon is-small is-right"><i className="fa-solid fa-triangle-exclamation"></i></span>
                                        }
                                    </>
                                }

                                {/* Render checkbox */}
                                {
                                    question.type == 'checkbox' &&
                                    <label
                                        key={"question-" + question.id}
                                        className="checkbox">

                                        <input
                                            type="checkbox"
                                            name={"question-" + question.id}
                                            value='1'
                                            checked={value == '1'}
                                            onChange={onFieldChanged} />
                                        &nbsp;
                                        <span  dangerouslySetInnerHTML={{ __html: (question[`label_${language}`] ?? question.label) }}></span>

                                    </label>
                                }

                                {/* Render radio button */}
                                {
                                    question.type == 'radio' &&
                                    <>
                                        {
                                            options.map((option, i) => {
                                                return (
                                                    <label
                                                        key={"question-" + question.id + '-' + i}
                                                        className="radio">

                                                        <input
                                                            type="radio"
                                                            name={"question-" + question.id + '-' + i}
                                                            value={option.value}
                                                            checked={(value ?? '') == option.value}
                                                            onChange={onFieldChanged} />
                                                        &nbsp;
                                                        <span dangerouslySetInnerHTML={{ __html: (option[`label_${language}`] ?? option.label) }}></span>

                                                    </label>
                                                )
                                            })
                                        }

                                        {
                                            value &&
                                            <button className="button is-light mx-auto mt-2" onClick={resetQuestionValue} tabIndex={-1}>
                                                <i className="fa-solid fa-rotate-right"></i>&nbsp;Reset
                                            </button>
                                        }
                                    </>
                                }

                                {/* Render file input */}
                                {
                                    question.type == 'file' &&
                                    <>
                                        <div className="file has-name is-fullwidth">
                                            <label className="file-label">
                                                <input
                                                    type="file"
                                                    className={"file-input " + (question.error ? 'is-danger' : '')}
                                                    id={"question-" + question.id}
                                                    onChange={onFieldChanged} />

                                                <span className="file-cta">
                                                    <span className="file-icon"></span>

                                                    <span className="file-label">Choose a file</span>
                                                </span>
                                                <span className="file-name"></span>
                                            </label>
                                        </div>
                                    </>
                                }

                                {/* Render textarea */}
                                {
                                    question.type == 'textarea' &&
                                    <>
                                        <textarea
                                            className={"textarea " + (question.error ? 'is-danger' : '')}
                                            id={"question-" + question.id}
                                            value={value ?? ''}
                                            onChange={onFieldChanged} />
                                    </>
                                }

                                {/* Render slider */}
                                {
                                    question.type == 'slider' &&
                                    <>
                                        <RangeSlider
                                            className={"" + (question.error ? 'is-danger' : '')}
                                            id={"question-" + question.id}
                                            min={question.min}
                                            max={question.max}
                                            value={value ?? 0}
                                            onChange={onFieldChanged} />
                                    </>
                                }

                                {/* Render SignPad */}
                                {
                                    ['sign', 'signature'].includes(question.type) &&
                                    <>
                                        <SignPad
                                            id={"question-" + question.id}
                                            value={value ?? null}
                                            onChange={onFieldChanged} />
                                    </>
                                }

                                {/* Render Consent PDF */}
                                {
                                    question.type == 'calc' && question.name == CONSENT_FILE_QUESTION_FIELD_NAME &&
                                    <>
                                        {
                                            question.downloadURL &&
                                            <>
                                                <object data={question.downloadURL} type="application/pdf" width="100%" height="100%"></object>

                                                <div className="notification is-info is-light mt-3">
                                                    You can download the Consent file by clicking here:
                                                    <br /><br />
                                                    <a href={question.downloadURL} download={true} target="_blank" className="button is-link">
                                                        <i className="fa-solid fa-download"></i>&nbsp; Download Consent
                                                    </a>
                                                </div>
                                            </>
                                        }
                                        {
                                            !question.downloadURL &&
                                            <div className="notification is-danger is-light">
                                                <i className="fa-solid fa-triangle-exclamation"></i> &nbsp; There was some problems with generating Consent file!
                                            </div>
                                        }
                                    </>
                                }

                                {/* Render Calc Field */}
                                {
                                    question.type == 'calc' && question.name != CONSENT_FILE_QUESTION_FIELD_NAME &&
                                    <>
                                        <input
                                            type="hidden"
                                            className={"input " + (question.error ? 'is-danger' : '')}
                                            id={"question-" + question.id}
                                            value={value ?? ''}
                                            onChange={onFieldChanged} />
                                    </>
                                }
                            </div>

                            {
                                question.error &&
                                <p className="help is-danger">{question.error}</p>
                            }
                        </div>
                    </div>
                </div>
            }

        </div>
    )
}
