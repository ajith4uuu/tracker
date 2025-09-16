import { useEffect } from "react"
import { useOutletContext } from "react-router";

export default function WelcomePage() {
    const { setPageTitle, setRHSNavItems, toggleLoading, currentUser, errorToast, successToast, setPageType } = useOutletContext();

    useEffect(() => {
        setPageTitle('Survey Page');

        toggleLoading(false);
    }, []);

    return (
        <>
            <div className="nav-progress">
                <div className="circle active" title="Consent">1</div>
                <div className="circle" title="Registration">2</div>
                <div className="circle" title="Status Scan">3</div>
                <div className="circle" title="Periodic PROs">4</div>
                <div className="circle" title="Longterm Impacts">5</div>
                <div className="circle" title="Participation Status">6</div>
                <div className="circle" title="Progress Snapshot">7</div>
            </div>

            <div className="section-header">Consent</div>

            <div className="section-content">
                <div className="consent-form">
                    <h2>Informed Consent Form for Participation in a Research Study</h2>

                    <p>
                    The information below is also available to read as a PDF document. 
                    If it is easier for you, please open the PDF document by clicking on the attachment. 
                    Then, return to this page and scroll down to answer all questions.
                    </p>

                    <p>
                    FINAL COPY OF ICF ATTACHED: 
                    <a href="http://link-to-google-storage-where-this-file-is-stored" target="_blank">HERE</a>
                    </p>

                    <h3>Study Title</h3>
                    <p><strong>PROgress TRACKER Breast Cancer Registry</strong></p>

                    <h3>Co-Principal Investigators</h3>
                    <p>
                    Dr. Omar Khan, MD, MBA, FRCPC, University of Calgary, Calgary AB<br/>
                    Dr. Doris Howell, RN, PhD, University Health Network, Toronto, ON
                    </p>

                    <h3>Sponsor</h3>
                    <p>Breast Cancer Canada</p>

                    <h3>Ethics Approval</h3>
                    <p>
                    The ethics of this study have been reviewed and approved by the 
                    University of Calgary through the Health Research Ethics Board of Alberta - Cancer Committee 
                    and the national ethics review board, Veritas IRB.
                    </p>

                    <h3>What are the Key Points of this Study?</h3>
                    <p>
                    We invite you to join this research registry or "study". We are conducting this registry 
                    to learn about what people's lives look like after a breast cancer diagnosis and any form 
                    of breast cancer therapy. The study will also help us give better care to future patients.
                    </p>
                    <p>You are being asked to join because you:</p>
                    <ul>
                    <li>Have been diagnosed with breast cancer at any stage 0, I, II, III or IV</li>
                    <li>Reside in Canada</li>
                    <li>If you join, you will answer surveys (also known as questionnaires) about your health and well-being.</li>
                    <li>Participating in any research study is voluntary.</li>
                    <li>You may or may not benefit from being in the study. Knowledge we gain may help others.</li>
                    <li>There are few risks to being in this study (e.g., recalling your cancer experience may be upsetting).</li>
                    <li>There are some risks of privacy and confidentiality breach due to storage of information.</li>
                    <li>If you join, you will receive surveys every 3 months for up to 10 years. You can quit anytime.</li>
                    <li>If you quit, your data will remain in the database, but no further surveys will be sent.</li>
                    <li>If you decide to quit, it won't affect your medical care.</li>
                    <li>You can contact Breast Cancer Canada or the Principal Investigator at any time for questions.</li>
                    <li>Take the time to talk about the study with your doctor, study staff, volunteers, family, and friends.</li>
                    <li>Information you provide is not part of your medical record and is not shared with your medical team.</li>
                    </ul>

                    <h3>What is the Purpose of the PROgress Tracker Registry?</h3>
                    <p>
                    Breast cancer is the most common cancer in women, and one in eight Canadian women are diagnosed 
                    according to Canadian Cancer Statistics. Around 270 men are also diagnosed each year. 
                    Treatments have progressed substantially, but side effects remain common. 
                    This registry helps researchers learn about the impact of breast cancer diagnosis and treatment on patients’ lives.
                    </p>
                    <ol>
                    <li>The impact of cancer treatment on your life (short, medium, and long term).</li>
                    <li>The impact of cancer on your general health outcomes.</li>
                    <li>The impact of cancer and treatment on breast, cardiac, neurologic, and bone health.</li>
                    </ol>

                    <h3>What Will Happen if I Join the Registry?</h3>
                    <p>If you decide to take part, the following information will be collected to the best of your knowledge:</p>
                    <ul>
                    <li><strong>Demographics:</strong> Date of birth, sex, gender identity, healthcare ID, education, postal code, ethnicity, employment.</li>
                    <li><strong>Financial and personal situation:</strong> Financial concerns, assistance needs, caregiver status.</li>
                    <li><strong>Medical information:</strong> Diagnosis date, stage, biomarkers (ER, PR, HER-2), recurrence.</li>
                    <li><strong>Treatment information:</strong> Biopsy, surgery, radiation, systemic therapy (hormone, targeted, chemo, immunotherapy).</li>
                    <li>Participation in clinical trials (if applicable).</li>
                    </ul>

                </div>
            </div>
        </>
    )
}
