import { useEffect, useState } from "react";
import { useOutletContext } from "react-router";
import { consoleError } from "~/lib/utils";

export default function LoginPage() {
    const { setPageTitle, setRHSNavItems, toggleLoading, currentUser, errorToast, successToast, setPageType } = useOutletContext();

    const [ stage, setStage ] = useState('enter-email');

    const [ data, setData ] = useState({
        'email': null,
        'otp': null,
    });

    const [ errors, setErrors ] = useState<any>({});

    const onBtnLoginClicked = async (e: any) => {
        try {
            e.preventDefault();
            e.stopPropagation();

            if (document.activeElement) document.activeElement.blur();

            toggleLoading(true);

            let isInvalid = false;
            let tempErrors: any = {
                'email': null,
                'otp': null,
            };

            if (stage === 'enter-email') {
                if (data.email && /^[^@]+@[^@]+\.[^@]+$/.test(data.email)) {
                    // TODO: Call Auth Cloud Function

                    setStage('validate-otp');
                } else {
                    isInvalid = true;

                    tempErrors.email = 'Invalid email address.';
                }
            } else {
                if (data.otp && /^[0-9]*$/.test(data.otp)) {
                    // TODO: Call the Validate OTP Cloud Function

                    //
                } else {
                    isInvalid = true;

                    tempErrors.otp = 'Invalid OTP.';
                }
            }

            setErrors({
                ...tempErrors,
            });

            toggleLoading(false);
        } catch(err) {
            consoleError('[onBtnLoginClicked] Error occurred:', err);

            toggleLoading(false);

            errorToast('Some error occurred! Please try again.');
        }
    };

    useEffect(() => {
        setPageTitle('Login');

        setPageType('auth');

        toggleLoading(false);
    }, []);

    return (
        <>

            <div className="columns">
                <div className="column is-narrow">
                    <div className="card">
                        <header className="card-header">
                            <p className="card-header-title">Login/Signup with Email</p>
                        </header>
                        <div className="card-content">
                            <div className="content">

                                {
                                    stage == 'enter-email' &&
                                    <div className="field">
                                        <label className="label">Enter your email address here</label>
                                        <div className="control has-icons-left has-icons-right">
                                            <input className={"input " + (errors && typeof(errors['email']) !== 'undefined' ? "is-danger" : "")} type="email" placeholder="hello@example.com" autoFocus />

                                            <span className="icon is-small is-left">
                                                <i className="fa-solid fa-envelope"></i>
                                            </span>

                                            {
                                                errors && typeof(errors['email']) !== 'undefined' &&
                                                <span className="icon is-small is-right"></span>
                                            }
                                        </div>

                                        {
                                            errors && typeof(errors['email']) !== 'undefined' &&
                                            <p className="help is-danger">{ errors['email'] }</p>
                                        }
                                    </div>
                                }

                                {
                                    stage == 'validate-otp' &&
                                    <div className="field">
                                        <label className="label">Enter the OTP here</label>
                                        <div className="control has-icons-left has-icons-right">
                                            <input className={"input " + (errors && typeof(errors['otp']) !== 'undefined' ? "is-danger" : "")} type="password" placeholder="OTP" autoFocus />

                                            <span className="icon is-small is-left">
                                                <i className="fa-solid fa-lock"></i>
                                            </span>

                                            {
                                                errors && typeof(errors['otp']) !== 'undefined' &&
                                                <span className="icon is-small is-right"></span>
                                            }
                                        </div>

                                        {
                                            errors && typeof(errors['otp']) !== 'undefined' &&
                                            <p className="help is-danger">{ errors['otp'] }</p>
                                        }
                                    </div>
                                }

                                <div className="field">
                                    <div className="control">
                                        <button className="btn-theme" onClick={onBtnLoginClicked}>
                                            { stage == 'enter-email' ? 'Send OTP' : 'Login' }
                                        </button>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </>
    );
}
