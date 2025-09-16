import { useEffect, useRef, useState } from 'react'
import './signPad.css'
import { consoleError, consoleLog } from '~/lib/utils'
import WithProgressBar from '~/components/ui/withProgressBar'
import { useOutletContext } from 'react-router'

export default function SignPad(
    {id, value = null, onChange = null, faAvailable = true}
    :
    {id: string, value: any, onChange: null|CallableFunction, faAvailable: boolean}
) {
    const DRAW_LINE_COLOR = '#0000FF'
    const DRAW_LINE_WIDTH_PX = 2
    const DRAW_IMAGE_FILE_MIME = 'image/png'
    const DRAW_IMAGE_FILE_NAME = 'signature.png'

    const { addToast }: {addToast: any} = useOutletContext();

    const [ isLoading, toggleLoading ] = useState(false)

    const [ isDrawing, toggleDrawing ] = useState(false)

    const [ lastOffset, setLastOffset ] = useState({
        'x': 0,
        'y': 0,
    })

    const [ drawnLines, setDrawnLines ] = useState(0)
    const [ imageData, setImageData ] = useState<any>(value || null)
    const [ imageURL, setImageURL ] = useState<any>(null)

    const isDrawingRef = useRef(isDrawing)
    const lastOffsetRef = useRef(lastOffset)
    const drawnLinesRef = useRef(drawnLines)
    const canvasRef = useRef(null)

    const getMousePos = (e: any) => {
        if (canvasRef.current) {
            const rect = canvasRef.current.getBoundingClientRect()

            let clientX = e.clientX;
            let clientY = e.clientY;

            if (e.touches && e.touches.length > 0) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            }

            return {
                'x': (clientX - rect.left) * (canvasRef.current.width / rect.width),
                'y': (clientY - rect.top) * (canvasRef.current.height / rect.height),
            }
        }

        return {
            'x': e.offsetX,
            'y': e.offsetY,
        }
    }

    const startDraw = (e: any) => {
        // consoleLog('startDraw', e)

        if (e instanceof TouchEvent) e.preventDefault();

        setLastOffset({ ...getMousePos(e) })

        toggleDrawing(true)
    }

    const stopDraw = (e: any) => {
        // consoleLog('stopDraw', e)

        if (e instanceof TouchEvent) e.preventDefault();

        toggleDrawing(false)
    }

    const draw = (e: any) => {
        if (e instanceof TouchEvent) e.preventDefault();
        // consoleLog('draw', isDrawingRef.current, canvasRef.current)

        if (!isDrawingRef.current || !canvasRef.current) return

        // consoleLog('draw', lastOffsetRef.current.x, lastOffsetRef.current.y, 'to', e.offsetX, e.offsetY)

        const ctx = canvasRef.current.getContext('2d')

        const currentOffset = getMousePos(e)

        ctx.beginPath()
        ctx.moveTo(lastOffsetRef.current.x, lastOffsetRef.current.y)
        ctx.lineTo(currentOffset.x, currentOffset.y)

        ctx.strokeStyle = DRAW_LINE_COLOR
        ctx.lineWidth = DRAW_LINE_WIDTH_PX
        ctx.lineCap = 'round'

        ctx.stroke()

        setDrawnLines(drawnLinesRef.current + 1)

        setLastOffset({ ...currentOffset })
    }

    const onBtnClearClicked = (e: any) => {
        e.preventDefault()
        e.stopPropagation()

        if (!canvasRef.current) return

        const ctx = canvasRef.current.getContext('2d')

        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)

        setDrawnLines(0)
    }

    const onBtnSaveClicked = (e: any) => {
        e.preventDefault()
        e.stopPropagation()

        if (!canvasRef.current) return

        if (drawnLinesRef.current <= 0) {
            addToast({
                type: 'error',
                message: 'Cannot save! You have not yet drawn your signature!'
            })

            return
        }

        toggleLoading(true)

        canvasRef.current.toBlob((blob: Blob) => {
            setImageData(blob)

            toggleLoading(false)
        }, DRAW_IMAGE_FILE_MIME, 1.0)/* .catch((error: any) => {
            consoleError('Error when trying to get Sign data:', error)

            setImageData(null)

            toggleLoading(false)
        }) */
    }

    const onBtnDeleteSavedSignClicked = (e: any) => {
        e.preventDefault()
        e.stopPropagation()

        if (confirm('Are you sure you want to delete the saved signature and create it again?')) {
            setImageData(null)
        }
    }

    useEffect(() => {
        if (onChange) {
            onChange(imageData)
        }

        let newImageURL = null

        // Revoke previous image URL
        if (imageURL) {
            URL.revokeObjectURL(imageURL)
        }

        if (imageData) {
            newImageURL = URL.createObjectURL(imageData)
        }

        setImageURL(newImageURL)
    }, [imageData])

    useEffect(() => {
        isDrawingRef.current = isDrawing
    }, [isDrawing])

    useEffect(() => {
        lastOffsetRef.current = lastOffset
    }, [lastOffset])

    useEffect(() => {
        drawnLinesRef.current = drawnLines
    }, [drawnLines])

    useEffect(() => {
        if (canvasRef.current) {
            canvasRef.current.addEventListener('mousedown', startDraw)
            canvasRef.current.addEventListener('touchstart', startDraw, { passive: false })
            canvasRef.current.addEventListener('mousemove', draw)
            canvasRef.current.addEventListener('touchmove', draw, { passive: false })
            canvasRef.current.addEventListener('mouseup', stopDraw)
            canvasRef.current.addEventListener('mouseout', stopDraw)
            canvasRef.current.addEventListener('touchend', stopDraw, { passive: false })
        }

        return () => {
            if (canvasRef.current) {
                canvasRef.current.removeEventListener('mousedown', startDraw)
                canvasRef.current.removeEventListener('touchstart', startDraw)
                canvasRef.current.removeEventListener('mousemove', draw)
                canvasRef.current.removeEventListener('touchmove', draw)
                canvasRef.current.removeEventListener('mouseup', stopDraw)
                canvasRef.current.removeEventListener('mouseout', stopDraw)
                canvasRef.current.removeEventListener('touchend', stopDraw)
            }
        }
    }, [canvasRef.current])

    return (
        <>
        <WithProgressBar
            isLoading={isLoading}>
                <div className="card">
                    <div className="card-content">
                        {
                            !imageData &&
                            <div className="signpad" id={id}>
                                <canvas ref={canvasRef}></canvas>
                            </div>
                        }

                        {
                            imageData &&
                            <div className="sign-preview">
                                <img src={imageURL} alt={DRAW_IMAGE_FILE_NAME} />
                            </div>
                        }
                    </div>
                    <div className="card-footer">
                        {
                            !imageData &&
                            <>
                                <a href="#" className="card-footer-item has-text-danger signpad-btn" onClick={onBtnClearClicked}>
                                    {
                                        faAvailable && <i className="fa-solid fa-circle-xmark"></i>
                                    }
                                    &nbsp;
                                    <span>Clear</span>
                                </a>

                                <a href="#" className="card-footer-item signpad-btn" onClick={onBtnSaveClicked}>
                                    {
                                        faAvailable && <i className="fa-solid fa-circle-check"></i>
                                    }
                                    &nbsp;
                                    <span>Save</span>
                                </a>
                            </>
                        }
                        {
                            imageData &&
                            <>
                                <a href="#" className="card-footer-item signpad-btn" onClick={onBtnDeleteSavedSignClicked}>
                                    {
                                        faAvailable && <i className="fa-solid fa-rotate-left"></i>
                                    }
                                    &nbsp;
                                    <span>Undo</span>
                                </a>
                            </>
                        }
                    </div>
                </div>
            </WithProgressBar>
        </>
    )
}
