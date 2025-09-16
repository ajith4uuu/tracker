import { useEffect } from "react"
import Modal from "./modal"

export type AlertBtn = {
    content: any,
    callback: any
}

export type AlertProps = {
    message: string,
    title: string | null,
    okBtn: AlertBtn | null,
    cancelBtn: AlertBtn | null
}

export default function Alert(props: AlertProps)
{
    const onBtnClicked = (e: any, btnType: string) => {
        e.preventDefault()
        e.stopPropagation()

        if (document.activeElement) document.activeElement.blur()

        const btn = btnType == 'ok' ? props.okBtn : props.cancelBtn

        if (btn && btn.callback) {
            btn.callback()
        }
    }

    useEffect(() => {
        // 
    }, [])

    return (
        <Modal>
            <h3 className="title is-3">{props.title ?? 'Alert'}</h3>

            <p className="mb-3">{props.message}</p>

            <div>
                <button className="btn-theme is-link" onClick={e => onBtnClicked(e, 'ok')}>{props.okBtn ? props.okBtn.content : 'Ok'}</button>

                {
                    props.cancelBtn &&
                    <button className="button is-light" onClick={e => onBtnClicked(e, 'cancel')}>{props.cancelBtn.content}</button>
                }
            </div>
        </Modal>
    )
}
