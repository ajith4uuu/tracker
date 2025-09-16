import { useEffect, useState } from "react"
import { useNavigate, useOutletContext } from "react-router"
import type { AlertProps } from "~/components/ui/alert"
import Alert from "~/components/ui/alert"
import { APP_TITLE } from "~/constant"
import { deletedUserCollectionID, fetchFirestoreDocs, getFirestoreDoc, questionsCollectionID, userCollectionID } from "~/lib/firestoreService"
import { consoleError } from "~/lib/utils"

export default function TempLandingPage() {
    const { setPageTitle, setRHSNavItems, toggleLoading, currentUser, errorToast, successToast, setPageType } = useOutletContext()

    const navigate = useNavigate()

    const [ confirmation, toggleConfirmation ] = useState<AlertProps|null>(null)

    const deletePreviousResponses = async () => {
        /* const deleteRef = getFirestoreDoc(deletedUserCollectionID(currentUser.uid))

        const colSnap = await fetchFirestoreDocs(questionsCollectionID(currentUser.uid))

        colSnap.forEach(docSnap => {
            deleteRef['QUESTIONS'][docSnap.id] = docSnap.data()
        }) */
    }

    const onBtnFreshSurveyClicked = async (e: any) => {
        try {
            e.preventDefault()
            e.stopPropagation()

            if (document.activeElement) document.activeElement.blur()

            /* toggleConfirmation({
                title: 'Are you sure?',
                message: 'This will delete all the previous responses. Are you sure you want to proceed?',
                okBtn: {
                    content: 'No',
                    callback: () => {
                        toggleConfirmation(null)
                    }
                },
                cancelBtn: {
                    content: 'Yes',
                    callback: async () => {
                        toggleConfirmation(null)

                        toggleLoading(true)

                        await deletePreviousResponses()

                        navigate('/survey')
                    }
                }
            }) */

            toggleLoading(true)
            navigate('/survey')
        } catch(err) {
            consoleError('[onBtnFreshSurveyClicked] Error occurred:', err)

            errorToast('Some error occurred! Please try again.')
        }
    }

    const onBtnResumeSurveyClicked = async (e: any) => {
        try {
            e.preventDefault()
            e.stopPropagation()

            if (document.activeElement) document.activeElement.blur()

            toggleLoading(true)
            navigate('/survey')
        } catch(err) {
            consoleError('[onBtnResumeSurveyClicked] Error occurred:', err)

            errorToast('Some error occurred! Please try again.')
        }
    }

    useEffect(() => {
        setPageTitle('Welcome')

        setPageType('auth')

        toggleLoading(false)
    }, [])

    return (
        <>

            <div className="columns mb-6 has-text-centered">
                <div className="column is-narrow">
                    <div className="">
                        <h1 className="title">Welcome to the {APP_TITLE}</h1>

                        <p>Choose how you'd like to begin. You can start fresh, continue where you left off, or restart after 3 months if your last survey has expired.</p>
                    </div>
                </div>
            </div>

            <div className="columns">
                <div className="column is-narrow">

                    <div className="card is-danger">
                        <div className="card-content">
                            <div className="content">
                                <h3>
                                    <i className="fa-solid fa-plus-circle"></i>&nbsp;Fresh Survey
                                </h3>
                                <p>Start a brand new survey from scratch.</p>
                                <button className="button is-link is-ghost" onClick={onBtnFreshSurveyClicked}>
                                    Start Fresh Survey&nbsp;<i className="fa-solid fa-angles-right"></i>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="card is-primary">
                        <div className="card-content">
                            <div className="content">
                                <h3>
                                    <i className="fa-solid fa-circle-play"></i>&nbsp;Continue Previous Survey
                                </h3>
                                <p>Resume your survey where you left off.</p>
                                <button className="button is-link is-ghost" onClick={onBtnResumeSurveyClicked}>
                                    Continue&nbsp;<i className="fa-solid fa-angles-right"></i>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="card is-link">
                        <div className="card-content">
                            <div className="content">
                                <h3>
                                    <i className="fa-solid fa-clipboard-list"></i>&nbsp;Fresh Survey After 3 Months
                                </h3>
                                <p>Only available if 3 months passed since last survey.</p>
                                <button className="button is-link is-ghost">
                                    Start After 3 Months&nbsp;<i className="fa-solid fa-angles-right"></i>
                                </button>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            {
                confirmation &&
                <Alert {...confirmation} />
            }

        </>
    )
}
