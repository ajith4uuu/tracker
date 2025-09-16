export default function WithProgressBar(
    {children, text = 'Loading...', isLoading = false}
    :
    {children: React.ReactNode, text: string, isLoading: boolean}
) {

    return (
        <div className="container-with-progress-bar">
            {
                isLoading &&
                <div className="progress-bar">
                    <span className="progress-bar-indicator"></span>

                    <span className="progress-bar-text">{text || 'Loading...'}</span>
                </div>
            }

            {children}
        </div>
    )
}
