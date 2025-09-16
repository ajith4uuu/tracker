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
            <h1><span dangerouslySetInnerHTML={{ __html: lang('welcome') }} /> {APP_TITLE}</h1>

            <p dangerouslySetInnerHTML={{ __html: lang('welcome_para_1') }}></p>

            <p><span dangerouslySetInnerHTML={{ __html: lang('welcome_para_2') }} /></p>

            <p><span dangerouslySetInnerHTML={{ __html: lang('welcome_para_3') }} /></p>

            <div className="columns mt-5">
                <div className="column is-narrow">

                    <div className="card is-danger">
                        <div className="card-content">
                            <div className="content">
                                <h3>
                                    <i className="fa-solid fa-plus-circle"></i>&nbsp;<span dangerouslySetInnerHTML={{ __html: lang('fresh_survey') }} />
                                </h3>
                                <p dangerouslySetInnerHTML={{ __html: lang('fresh_survey_desc') }} />
                                <button className="button is-link is-ghost" onClick={onBtnFreshSurveyClicked}>
                                    <span dangerouslySetInnerHTML={{ __html: lang('fresh_survey_start_btn') }} />&nbsp;<i className="fa-solid fa-angles-right"></i>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="card is-primary">
                        <div className="card-content">
                            <div className="content">
                                <h3>
                                    <i className="fa-solid fa-circle-play"></i>&nbsp;<span dangerouslySetInnerHTML={{ __html: lang('resume_prev_survey') }} />
                                </h3>
                                <p dangerouslySetInnerHTML={{ __html: lang('resume_prev_survey_desc') }} />
                                <button className="button is-link is-ghost" onClick={onBtnResumeSurveyClicked}>
                                    <span dangerouslySetInnerHTML={{ __html: lang('resume_prev_survey_start_btn') }} />&nbsp;<i className="fa-solid fa-angles-right"></i>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="card is-link">
                        <div className="card-content">
                            <div className="content">
                                <h3>
                                    <i className="fa-solid fa-clipboard-list"></i>&nbsp;<span dangerouslySetInnerHTML={{ __html: lang('post_2_mont_survey') }} />
                                </h3>
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
