import { useEffect } from "react";

export default function Toast(
    {type, title, message, id, closeToast, time = 3}
    :
    {type: "error" | "success" | "info", title: string, message: string, id: number, closeToast: (i: number) => void, time: number}
) {
    const onBtnCloseClicked = (e: any) => {
        e.preventDefault()
        e.stopPropagation()

        closeToast(id)
    }

    useEffect(() => {
        const timeout = setTimeout(() => {
            closeToast(id)
        }, time * 1000)

        return () => {
            clearTimeout(timeout)
        }
    }, [id])

    return (
        <article className={"message toast is-" + (type == 'error' ? 'danger' : type)}>
            <div className="message-header">
                <p>
                    {
                        title ? title : (
                            type == 'error' ? 'Error' : (
                                type == 'success' ? 'Success' : 'Info'
                            )
                        )
                    }
                </p>

                <button className="delete" onClick={onBtnCloseClicked}></button>
            </div>

            <div className="message-body">{message}</div>
        </article>
    )
}
