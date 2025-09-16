
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Outlet } from "react-router";
import { APP_TITLE, LANGUAGES_AVAILABLE } from '~/constant';

import { FirebaseAuth } from "../../firebaseConfig";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth"
import { consoleError, consoleLog } from "~/lib/utils";
import Toast from "./toast";

import en from "~/lang/en";
import fr from "~/lang/fr";

type ToastMessage = {
    id: number,
    type: string,
    title: string,
    message: string
}

export default function BasePageLayout() {
    const [ pageTitle, setPageTitle ] = useState(APP_TITLE)

    const [ isNavbarVisible, toggleNavbar ] = useState(false)
    const [ isFooterVisible, toggleFooter ] = useState(false)

    const [ isLoading, toggleLoading ] = useState(true)

    const [ currentUser, setCurrentUser ] = useState<any>(null)

    const [ isLangDropdownActive, toggleLangDropdown ] = useState(false)

    const [ currentLang, setCurrentLang ] = useState('en')
    const [ currentLangText, setCurrentLangText ] = useState('English')

    const toastIdRef = useRef(0)
    const [ toastMessages, setToastMessages ] = useState<ToastMessage[]>([])

    const [ pageType, setPageType ] = useState('normal');

    const headerRef = useRef(null)
    const langContainerRef = useRef(null)

    const addToast = (toast: ToastMessage) => {
        const id = toastIdRef.current++

        setToastMessages(prevToasts => {
            return [
                ...prevToasts,
                {
                    ...toast,
                    'id': id
                }
            ]
        })
    };

    const errorToast = (message: string) => {
        addToast({
            'id': -1,
            'type': 'error',
            'title': 'Error',
            'message': message,
        })
    };

    const successToast = (message: string) => {
        addToast({
            'id': -1,
            'type': 'success',
            'title': 'Success',
            'message': message,
        })
    };

    const deleteToast = (id: number) => {
        setToastMessages(prevToasts => {
            return prevToasts.filter((toast) => toast.id != id)
        })
    };

    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }

    const scrollToElement = (element: any) => {
        if (element && element.scrollIntoView) {
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            })
        }
    }

    const onLangSwitchClicked = (e: any) => {
        e.preventDefault()
        e.stopPropagation()

        if (document.activeElement) document.activeElement.blur()

        toggleLangDropdown(!isLangDropdownActive)
    }

    const onChooseLanguageClicked = (e: any, lang: string) => {
        e.preventDefault()
        e.stopPropagation()

        if (document.activeElement) document.activeElement.blur()

        toggleLangDropdown(false)

        setCurrentLang(lang)
    }

    const lang = (code: string) => {
        try {
            let text = code
            let langObj: any = {}

            if (currentLang == 'en') {
                langObj = en
            } else {
                langObj = fr
            }

            // consoleLog('langObj:', langObj)

            if (typeof(langObj[code]) === 'undefined') {
                text = code
            } else {
                text = langObj[code]
            }

            return text
        } catch(error) {
            consoleError('[lang] Error occurred:', error)

            return code
        }
    }

    useEffect(() => {
        let newLangText = 'English';

        for (let i in LANGUAGES_AVAILABLE) {
            if (LANGUAGES_AVAILABLE[i].code == currentLang) {
                newLangText = LANGUAGES_AVAILABLE[i].label
                break
            }
        }

        setCurrentLangText(newLangText)
    }, [currentLang])

    useEffect(() => {
        let newPageTitle = pageTitle

        if (newPageTitle && newPageTitle.trim() && newPageTitle != APP_TITLE) {
            newPageTitle = newPageTitle + ' | ' + APP_TITLE
        } else {
            newPageTitle = APP_TITLE
        }

        document.title = newPageTitle
    }, [pageTitle])

    useEffect(() => {
        const langDropDownOutsideClickListener = (e: any) => {
            if (langContainerRef.current && !langContainerRef.current.contains(e.target as Node))  {
                toggleLangDropdown(false)
            }
        }

        document.addEventListener('click', langDropDownOutsideClickListener)

        const unsubscribe = onAuthStateChanged(FirebaseAuth, user => {
            if (user) {
                setCurrentUser(user)

                consoleLog('Authenticated user:', user)
            } else {
                signInAnonymously(FirebaseAuth).catch(error => {
                    consoleError('Error occurred when signing into Firebase:', error)

                    setCurrentUser(-1)
                })
            }

            document.removeEventListener('click', langDropDownOutsideClickListener)
        })

        return unsubscribe
    }, [])

    useEffect(() => {
        if (headerRef.current) {
            try {
                document.querySelector('body > main')!.style.marginTop = headerRef.current.getBoundingClientRect().height + 'px'
            } catch(error) {
                consoleError('Error when setting `main` content margin:', error)
            }
        }
    }, [pageType, isNavbarVisible, isLoading])

    return (
        <>
            {
                isNavbarVisible && !isLoading &&
                <header ref={headerRef}>
                    <img src="/assets/images/logo.png" alt={APP_TITLE + " Logo"} />
                    {
                        LANGUAGES_AVAILABLE.length > 0 &&
                        <>
                            <div className="lang-dropdown" ref={langContainerRef}>
                                <button className="lang-switch" onClick={onLangSwitchClicked}>{currentLangText}</button>

                                <div className={"lang-dropdown-menu " + (isLangDropdownActive ? 'show' : '')}>
                                    {
                                        LANGUAGES_AVAILABLE.map((lang, i) => {
                                            return (
                                                <a key={"lang-" + i} className={(lang.code == currentLang ? "is-selected" : "")} onClick={e => onChooseLanguageClicked(e, lang.code)}>{lang.label}</a>
                                            )
                                        })
                                    }
                                </div>
                            </div>
                        </>
                    }
                </header>
            }

            {
                isLoading &&
                <div className="app-progress-bar">
                    <span className="app-progress-indicator"></span>

                    <span className="app-progress-text">Loading...</span>
                </div>
            }

            {
                toastMessages && toastMessages.length > 0 &&
                <div id="toast-container">
                    <div id="toast-container__content">
                        {
                            toastMessages.map((toast: any, i: number) => {
                                return (
                                    <Toast
                                        key={toast.id}
                                        id={toast.id}
                                        type={toast.type ?? 'info'}
                                        title={toast.title ?? null}
                                        message={toast.message ?? null}
                                        closeToast={deleteToast} />
                                )
                            })
                        }
                    </div>
                </div>
            }

            <main className={"bd-docs is-fullwidth " + (pageType === 'auth' ? 'auth-page' : '')}>
                <div className="container">
                    {/* Render the Page component */}
                    {
                        currentUser && currentUser !== -1 &&
                        <Outlet context={{
                            setPageTitle,
                            currentLang,
                            setCurrentLang,
                            isLoading,
                            toggleLoading,
                            currentUser,
                            addToast,
                            errorToast,
                            successToast,
                            setPageType,
                            scrollToTop,
                            scrollToElement,
                            isNavbarVisible,
                            toggleNavbar,
                            isFooterVisible,
                            toggleFooter,
                            lang,
                        }} />
                    }

                    {
                        !(currentUser && currentUser !== -1) &&
                        <div className="card">
                            <div className="card-content">
                                <div className="notification is-danger is-light">
                                    <i className="fa-solid fa-triangle-exclamation"></i> &nbsp; Oops! Unable to authenticate via Firebase.
                                </div>
                            </div>
                        </div>
                    }
                </div>
            </main>

            {
                isFooterVisible && !isLoading &&
                <footer>&copy; {(new Date()).getFullYear()} {APP_TITLE}</footer>
            }
        </>
    )
}
