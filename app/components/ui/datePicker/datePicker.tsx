import { useEffect, useRef } from "react"

import flatpickr from 'flatpickr'

import 'flatpickr/dist/flatpickr.min.css'

export default function DatePicker(
    {id, value, error, onChange}
    :
    {id: string, value: any, error: any, onChange: any}
) {
    const inputRef = useRef(null)
    const flatpickrRef = useRef<any>(null)

    const onFieldChanged = (selectedDates: any, dateStr: any, instance: any) => {
        onChange(dateStr)
    }

    useEffect(() => {
        if (inputRef.current) {
            flatpickrRef.current = flatpickr(inputRef.current, {
                dateFormat: 'm/d/Y',
                maxDate: 'today',
                onChange: onFieldChanged,
            })
        }

        return () => {
            if (inputRef.current) {
                //
            }
        }
    }, [])

    return (
        <>
            <input
                ref={inputRef}
                type="text"
                className={"input " + (error ? 'is-danger' : '')}
                id={"question-" + id}
                value={value ?? ''}
                readOnly={true} />

            {
                error &&
                <span className="icon is-small is-right"><i className="fa-solid fa-triangle-exclamation"></i></span>
            }
        </>
    )
}
