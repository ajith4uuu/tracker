import { useEffect, useRef } from 'react';
import './rangeSlider.css'

export default function RangeSlider(
    {className, id, min, max, value, onChange}
    :
    {className: string, id: string, min: number, max: number, value: any, onChange: (e: any) => void}
) {
    const inputRef = useRef(null)
    const outputRef = useRef(null)

    useEffect(() => {
        const input = inputRef.current
        const output = outputRef.current

        if (input && output) {
            let percentage = (value - min) / (max - min) * 100
            const sliderWidth = input.clientWidth
            let thumbWidth: any = parseFloat(getComputedStyle(input).getPropertyValue('--bulma-control-height')) / 2
            /* const thumbWidth = parseFloat(getComputedStyle(input).getPropertyValue('--bulma-control-height'))

            const left = percentage * (sliderWidth - thumbWidth) + thumbWidth / 2 */

            /* let left: any = ((sliderWidth * percentage) / 100) - (output.offsetWidth / 2)

            if (percentage > 50) {
                left = `calc(${left}px - calc(0.5em - ${thumbWidth}px))`
            } else if (percentage < 50) {
                left = `calc(${left}px + calc(0.5em + ${thumbWidth}px))`
            } */

            if (percentage < 0) {
                percentage = 0
            } else if (percentage > 100) {
                percentage = 100
            }

            if (percentage > 50) {
                thumbWidth = `- ${thumbWidth}`
            } else if (percentage < 50) {
                thumbWidth = `+ ${thumbWidth}`
            }

            output.style.left = `calc(${percentage}% ${thumbWidth}px)`
        }
    }, [ value, min, max ])

    return (
        <div className="range-slider">
            <input
                ref={inputRef}
                type="range"
                className={className}
                id={id}
                min={min}
                max={max}
                value={value ?? 0}
                onChange={onChange} />

            <div className="range-slider__progress"></div>

            <div className="range-slider__indicator" data-ind-type="min">{min}</div>
            <div className="range-slider__indicator" data-ind-type="max">{max}</div>

            <div ref={outputRef} className="range-slider__output">{value}</div>
        </div>
    )
}
