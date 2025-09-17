import { useEffect } from "react"
import { useNavigate, useOutletContext } from "react-router";

import './welcome-page.css';

import { APP_TITLE } from "~/constant";

export default function WelcomePage() {
    const { setPageTitle, setRHSNavItems, toggleLoading, currentUser, errorToast, successToast, setPageType, toggleNavbar, toggleFooter, lang } = useOutletContext();

    const navigate = useNavigate()

    const onBtnFreshSurveyClicked = async (e: any) => {
        e.preventDefault();
        e.stopPropagation();

        if (document.activeElement) document.activeElement.blur();

            toggleLoading(true)
            navigate('/survey')
    };
    
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
        setPageTitle('Welcome');

        setPageType('auth');

        toggleLoading(false);

        toggleNavbar(true);
    }, []);

    return (
        <>
            <div className="welcome-card">
                <h1><span dangerouslySetInnerHTML={{ __html: lang('welcome') }} /> {APP_TITLE}</h1>
                <p dangerouslySetInnerHTML={{ __html: lang('welcome_para_1') }}></p>
                <p><span dangerouslySetInnerHTML={{ __html: lang('welcome_para_2') }} /></p>
                <p><span dangerouslySetInnerHTML={{ __html: lang('welcome_para_3') }} /></p>

                <div className="scenario-grid">
                    <div className="scenario-card card is-danger" onClick={onBtnFreshSurveyClicked} role="button" tabIndex={0}>
                        <a href="#start-fresh" className="stretched-link" aria-label="Start Fresh Survey" onClick={onBtnFreshSurveyClicked}></a>
                        <div className="card-content">
                            <div className="content">
                                <h3><i className="fa-solid fa-plus-circle"></i><span dangerouslySetInnerHTML={{ __html: lang('fresh_survey') }} /></h3>
                                <p dangerouslySetInnerHTML={{ __html: lang('fresh_survey_desc') }} />
                                <button className="button is-link is-ghost" onClick={onBtnFreshSurveyClicked}>
                                    <span dangerouslySetInnerHTML={{ __html: lang('fresh_survey_start_btn') }} />&nbsp;<i className="fa-solid fa-angles-right"></i>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="scenario-card card is-primary" onClick={onBtnResumeSurveyClicked} role="button" tabIndex={0}>
                        <a href="#resume" className="stretched-link" aria-label="Continue Previous Survey" onClick={onBtnResumeSurveyClicked}></a>
                        <div className="card-content">
                            <div className="content">
                                <h3><i className="fa-solid fa-circle-play"></i><span dangerouslySetInnerHTML={{ __html: lang('resume_prev_survey') }} /></h3>
                                <p dangerouslySetInnerHTML={{ __html: lang('resume_prev_survey_desc') }} />
                                <button className="button is-link is-ghost" onClick={onBtnResumeSurveyClicked}>
                                    <span dangerouslySetInnerHTML={{ __html: lang('resume_prev_survey_start_btn') }} />&nbsp;<i className="fa-solid fa-angles-right"></i>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="scenario-card card is-link" role="button" tabIndex={0}>
                        <a href="#start-after-3-months" className="stretched-link" aria-label="Start After 3 Months"></a>
                        <div className="card-content">
                            <div className="content">
                                <h3><i className="fa-solid fa-clipboard-list"></i><span dangerouslySetInnerHTML={{ __html: lang('post_2_mont_survey') }} /></h3>
                                <p dangerouslySetInnerHTML={{ __html: lang('post_2_mont_survey_desc') }} />
                                <button className="button is-link is-ghost">
                                    <span dangerouslySetInnerHTML={{ __html: lang('post_2_mont_survey_start_btn') }} />&nbsp;<i className="fa-solid fa-angles-right"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <footer>&copy; {(new Date()).getFullYear()} {APP_TITLE}</footer>
        </>
    )
}
