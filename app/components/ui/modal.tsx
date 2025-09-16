export default function Modal(
    {children}
    :
    {children: React.ReactNode}
) {
    return (
        <div className="modal is-active">
            <div className="modal-background"></div>
            <div className="modal-content">
                {children}
            </div>
        </div>
    )
}
