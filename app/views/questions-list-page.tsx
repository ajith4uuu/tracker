import { useEffect, useState } from "react";
import { useOutletContext } from "react-router";
import { QuestionField } from "~/components/ui/question-field";
import { CONSENT_FILE_QUESTION_FIELD_NAME, END_SURVEY_CONDITIONS, LANGUAGES_AVAILABLE } from "~/constant";
import { BQGenerateConsentPDFForUser, BQLoadQuestionsIntoFirestore } from "~/lib/bqService";
import {
  fetchQuestionsFromFirestore,
  fetchUserResponseFromFirestore,
  storeUserResponseToFirestore,
  uploadFileToGLS,
  fetchFileFromGLS,
  fetchUserSettingsFromFirestore,
  storeAllUserResponsesToFirestore,
  storeUserSettingsToFirestore,
  fetchAllUserResponsesFromFirestore,
  fetchFileDownloadURLFromGCS,
  fetchAllQuestionsFromFirestore,
} from "~/lib/firestoreService";
import { consoleError, consoleLog, validateQuestionField } from "~/lib/utils";

import type { AlertProps } from "~/components/ui/alert"
import Alert from "~/components/ui/alert"
import DocAIUploader from "~/components/ui/docai-uploader";

export default function QuestionsListPage() {
  const { setPageTitle, currentLang, setCurrentLang, isLoading, toggleLoading, currentUser, errorToast, successToast, setPageType, scrollToTop, scrollToElement, toggleNavbar, toggleFooter } = useOutletContext();

  const [currentPage, setCurrentPage] = useState(1);

  const [allPagesQuestions, setAllPagesQuestions] = useState<any[]>([]);

  const [currPageQuestions, setCurrPageQuestions] = useState<any[]>([]);

  const [responses, setResponses] = useState<any>({});

  const [oldSettings, setOldSettings] = useState<USER_SETTINGS_TYPE>({
    language: 'en',
    totalPages: 1,
    resumePage: 1,
    surveyCompleted: false,
  });
  const [settings, setSettings] = useState<USER_SETTINGS_TYPE>({
    language: 'en',
    totalPages: 1,
    resumePage: 1,
    surveyCompleted: false,
  });

  const [isLangDropdownActive, toggleLangDropdown] = useState(false);

  const [ confirmation, toggleConfirmation ] = useState<AlertProps|null>(null);

  const fetchQuestionsData = async (page = 0, dir = 'f') => {
    toggleLoading(true);

    consoleLog("fetchQuestionsData start");

    let tempPageQuestions: any[] = [];
    let pastResponses: any = {};
    let visibleQuestions = 0;

    await new Promise(async (resolve) => {
      // consoleLog('page:',page)

      let newSettings: any = await fetchUserSettingsFromFirestore(currentUser.uid)
      let firestoreQuestions: any = [];

      consoleLog('newSettings:', newSettings);

      if (page === 0) {
        consoleLog('Fetching questions from Firebase...');

        firestoreQuestions = await fetchAllQuestionsFromFirestore(currentUser.uid);

        consoleLog('firestoreQuestions:', firestoreQuestions);

        if (!(firestoreQuestions && firestoreQuestions.length > 0)) {
          consoleLog('Uploading questions into Firestore from BigQuery...');

          await BQLoadQuestionsIntoFirestore(currentUser.uid);

          firestoreQuestions = await fetchAllQuestionsFromFirestore(currentUser.uid);

          newSettings = await fetchUserSettingsFromFirestore(currentUser.uid)
        }

        setAllPagesQuestions([
          ...firestoreQuestions,
        ]);

        page = newSettings.resumePage;

        firestoreQuestions = firestoreQuestions.filter((q: any) => q.page == page);
      } else {
        consoleLog('Fetching questions from the allPagesQuestions array...');

        firestoreQuestions = allPagesQuestions.filter((q: any) => q.page == page);
      }

      if (currentLang !== newSettings.language) {
        setCurrentLang(newSettings.language)
      }

      setSettings(prevData => {
        return {
          ...prevData,
          ...newSettings,
        }
      });

      consoleLog('current page:', page)

      consoleLog('firestoreQuestions:', firestoreQuestions);

      tempPageQuestions = firestoreQuestions;

      pastResponses = await fetchAllUserResponsesFromFirestore(currentUser.uid) ?? {};

      consoleLog('pastResponses', pastResponses)

      if (
        pastResponses &&
        typeof pastResponses === "object"
      ) {
        for (let qI = 0; qI < tempPageQuestions.length; qI++) {
          let question = tempPageQuestions[qI]

          // consoleLog('current page responses', pastResponses[`page-${page}`])

          let response = pastResponses[`${question.id}`] ?? {
            'id': question.id,
            'name': question.name,
            'value': null
          }

          if (question.name === CONSENT_FILE_QUESTION_FIELD_NAME) {
            try {
              const [consentFileSuccess, consentFileResp] = await BQGenerateConsentPDFForUser(currentUser.uid, pastResponses);

              // consoleLog('consentFileResp:', consentFileResp);

              if (consentFileSuccess && consentFileResp && consentFileResp.consentFile) {
                response = {
                  'id': question.id,
                  'name': question.name,
                  'value': consentFileResp.consentFile,
                  'downloadURL': await fetchFileDownloadURLFromGCS(consentFileResp.consentFile)
                }

                pastResponses[`${question.id}`] = response
              }
            } catch(error) {
              consoleError('Error occurred when trying to generate consent PDF:', error);
            }
          }

          // consoleLog('response of', question.id, response);

          if (response) {
            let tempValue = response.value

            if (['sign', 'signature', 'file'].includes(question.type) && tempValue) {
              try {
                tempValue = (await fetchFileFromGLS(tempValue)).blob
              } catch(error) {
                consoleError('Error when fetching file from GSL:', error)

                tempValue = null
              }
            }

            response.value = tempValue ?? null;

            if (question.name === CONSENT_FILE_QUESTION_FIELD_NAME && response.downloadURL) {
              question.downloadURL = response.downloadURL;
            }
          }

          tempPageQuestions[qI] = question;
          pastResponses[`${question.id}`] = response;

          // consoleLog('tempQuestion', question, tempPageQuestions[qI]);
        }
      }

      for (let rI in pastResponses) {
        let tempResp = pastResponses[rI];

        consoleLog('label update -> tempResp', tempResp.id, tempResp.value);

        if (!tempResp.name) continue

        // consoleLog('tempResp.name', tempResp.name)

        for (let qI = 0; qI < tempPageQuestions.length; qI++) {
          let tempQ = tempPageQuestions[qI]

          // consoleLog('pre -> tempQ', tempResp.name, tempResp.id, tempQ.id)

          if (tempQ.label_en) {
            tempQ.label_en = tempQ.label_en.replace(`[${tempResp.name}]`, tempResp.value ?? '')
          }

          if (tempQ.label_fr) {
            tempQ.label_fr = tempQ.label_fr.replace(`[${tempResp.name}]`, tempResp.value ?? '')
          }

          tempPageQuestions[qI] = tempQ

          // consoleLog('post -> tempQ', tempQ.label_en)
        }
      }

      for (let qI = 0; qI < tempPageQuestions.length; qI++) {
        if (isQuestionVisible(tempPageQuestions[qI])) {
          visibleQuestions++;
        }
      }

      resolve("Questions fetched.");
    });

    /* let resumeData = null;
    try {
      resumeData = await loadPartialResponse("TEMP_TOKEN");
      consoleLog(
        "resumeData from Firestore (full):",
        JSON.stringify(resumeData, null, 2)
      );
    } catch (e) {
      consoleError("Error loading from Firestore:", e);
    }

    if (resumeData) {
      const savedAnswers = resumeData.partial_answers || {};
      tempPageQuestions = tempPageQuestions.map((q) => ({
        ...q,
        value: savedAnswers[q.name] ?? q.value ?? "",
      }));
    } */

    consoleLog("✅ Final tempPageQuestions before setCurrPageQuestions:", tempPageQuestions);

    setCurrPageQuestions(tempPageQuestions);
    setResponses(pastResponses);

    // Skip If there are no questions visible in this page
    if (visibleQuestions === 0) {
      consoleLog('Skipping the page as there are no questions visible!')

      if (dir == 'b') {
        onPageSubmitted(null, page - 1, false)
      } else {
        onPageSubmitted(null, page + 1, false)
      }

      return
    }

    toggleLoading(false);

    setCurrentPage(page);

    scrollToTop()
  };

  const isQuestionVisible = (question: any) => {
    if (question.displayCondition) {
      let statement = question.displayCondition

      consoleLog('question.displayCondition:', question.displayCondition)

      for (let i = 0; i < allPagesQuestions.length; i++) {
        // consoleLog('allPagesQuestions[i]:', allPagesQuestions[i]);

        if (question.id == allPagesQuestions[i].id) continue

        if (statement.indexOf(allPagesQuestions[i].name) > -1) {
          if (!isQuestionVisible(allPagesQuestions[i])) {
            return false
          }
        }

        const resp = responses[allPagesQuestions[i].id] ?? {};

        statement = statement.replace(new RegExp(`\\[${allPagesQuestions[i].name}\\]`, 'g'), `'${resp.value}'`)
        statement = statement.replaceAll('<>', '!=');
      }

      try {
        consoleLog('evaluating:', statement)

        if (eval(statement)) {
          consoleLog('display condition met')

          return true
        } else {
          return false
        }
      } catch(error) {
        consoleError('Error when evaluating the displayCondition:', error)

        return false
      }
    }

    return true
  }

  const onQuestionValueChanged = (index: number, value: any) => {
    let updatedResponses = {...responses};
    let question = currPageQuestions[index];

    if (!updatedResponses[question.id]) {
      updatedResponses[question.id] = {
        'id': question.id,
        'name': question.name,
      };
    }

    updatedResponses[question.id].value = value;

    consoleLog('onQuestionValueChanged() -> updatedResponses:', updatedResponses)

    setResponses({...updatedResponses});

    for (let esI in END_SURVEY_CONDITIONS) {
      let statement = END_SURVEY_CONDITIONS[esI]
      consoleLog('endsurvey statement', statement)

      currPageQuestions.forEach(q => {
        let resp = responses[q.id];

        statement = statement.replace(new RegExp(`${q.name}`), `'${resp.value}'` || '\"\"')
      })
      consoleLog('formatted statement', statement)

      try {
        consoleLog('[END_SURVEY_CONDITIONS] evaluating:', statement)

        if (eval(statement)) {
          consoleLog('end survey conditions met')

          toggleConfirmation({
              title: 'End the Survey?',
              message: 'You have selected an option that triggers this survey to end right now. To save your responses and end the survey, click the \'End Survey\' button below. If you have selected the wrong option by accident and/or wish to return to the survey, click the \'Return and Edit Response\' button.',
              okBtn: {
                  content: 'Return and Edit Response',
                  callback: () => {
                      toggleConfirmation(null)

                      setResponses((prevValue: any) => {
                        if (!prevValue[question.id]) {
                          prevValue[question.id] = {
                            'id': question.id,
                            'name': question.name,
                          }
                        }

                        prevValue[question.id].value = null

                        return prevValue
                      })
                  }
              },
              cancelBtn: {
                  content: 'End Survey',
                  callback: async () => {
                      toggleConfirmation(null)

                      setSettings(prevData => {
                        return {
                          ...prevData,
                          'surveyCompleted': true
                        }
                      })
                  }
              }
          })

          break
        }
      } catch(error) {
        consoleError('Error when evaluating the END_SURVEY_CONDITIONS:', error)
      }
    }

    validateQuestion(question, index)
  };

  const validateQuestion = (question: any, questionIndex: any) => {
    consoleLog('validating field on change', question, questionIndex);

    if (isQuestionVisible(question)) {
      question.error = validateQuestionField(question, responses[question.id].value ?? null);
    } else {
      question.error = null;
    }

    consoleLog('question.error', question.error);

    setCurrPageQuestions(prevQuestions => {
      return prevQuestions.map((q, i) => i == questionIndex ? question : q);
    });
  };

  const onPageSubmitted = async (
    e: any,
    navigateDir: string|number = "f",
    validate = true
  ) => {
    if (e) e.preventDefault();
    if (e) e.stopPropagation();

    if (document.activeElement) {
      document.activeElement.blur();
    }

    toggleLoading(true);

    let invalidQuestions = false;

    await new Promise((resolve) => {
      let validatedQuestions = [...currPageQuestions];

      for (let i = 0; i < validatedQuestions.length; i++) {
        let question = validatedQuestions[i];

        if (validate) {
          if (isQuestionVisible(question)) {
            question.error = validateQuestionField(question, (responses[question.id] ?? {}).value);
          } else {
            question.error = null;
          }

          validatedQuestions[i] = question;

          if (question.error) {
            consoleLog('invalid question', question.id, question.error)
            invalidQuestions = true;
          }
        }
      }

      setCurrPageQuestions([...validatedQuestions]);

      resolve("Responses validated.");
    });

    if (invalidQuestions) {
      toggleLoading(false);

      errorToast('There are some invalid inputs found! Please correct them all to continue.')

      scrollToElement(document.querySelector('.question-field:has(.help.is-danger)'))

      return;
    }

    await new Promise(async (resolve) => {
      let updatedResponses : any = await fetchAllUserResponsesFromFirestore(currentUser.uid) ?? {};

      consoleLog('save -> responses:', responses)
      consoleLog('save -> updatedResponses:', updatedResponses);

      for(let rI in responses) {
        let tempResponse = responses[rI];

        consoleLog('tempResponse', rI, tempResponse)

        if (tempResponse.value instanceof Blob) {
          tempResponse.value = await uploadFileToGLS(`responses/${currentUser.uid}/${tempResponse.id}`, tempResponse.value)
        }

        updatedResponses[`${tempResponse.id}`] = tempResponse
      }

      consoleLog('currentUser:', currentUser);
      consoleLog('updatedResponses:', updatedResponses);

      await storeAllUserResponsesToFirestore(currentUser.uid, updatedResponses)

      resolve("Responses stored.");
    });

    /* await savePartialResponse("TEMP_TOKEN", {
      current_page: currentPage,
      last_saved_ts: Date.now(),
      partial_answers: responses.reduce(
        (acc, r) => {
          acc[r.id] = r.value;
          return acc;
        },
        {} as Record<string, any>
      ),
    }); */

    toggleLoading(false);

    // successToast('The responses have been stored.')

    if (navigateDir == "f") {
      if (settings.totalPages > currentPage) {
        fetchQuestionsData(currentPage + 1, 'f');
      } else {
        setSettings(prevData => {
          return {
            ...prevData,
            'surveyCompleted': true
          }
        });
      }
    } else if (navigateDir == "b") {
      if (currentPage > 1) {
        fetchQuestionsData(currentPage - 1, 'b');
      }
    } else if (typeof(navigateDir) === 'number') {
      fetchQuestionsData(navigateDir, 'n');
    }
  };

  const onEditResponsesClicked = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (document.activeElement) {
      document.activeElement.blur();
    }

    if (confirm("Are you sure you want to edit your responses?")) {
      setSettings(prevData => {
        return {
          ...prevData,
          'surveyCompleted': false
        }
      });
    }
  };

  const onLangDropdownClicked = async (e: any) => {
    e.preventDefault();
    e.stopPropagation();

    if (document.activeElement) {
      document.activeElement.blur();
    }

    toggleLangDropdown(!isLangDropdownActive)
  }

  useEffect(() => {
    setPageTitle(`Page ${currentPage} of ${settings.totalPages}`);

  }, [currentPage, settings, isLangDropdownActive]);

  useEffect(() => {
    setSettings(prevData => {
      return {
        ...prevData,
        'resumePage': currentPage,
      }
    });
  }, [currentPage]);

  useEffect(() => {
    if (currentLang !== settings.language) {
      setSettings(prevData => {
        return {
          ...prevData,
          'language': currentLang,
        }
      });
    }
  }, [currentLang]);

  useEffect(() => {
    if (isLoading) return;

    new Promise(async (resolve) => {
      await storeUserSettingsToFirestore(currentUser.uid, {
        ...settings
      });

      if (oldSettings.surveyCompleted && !settings.surveyCompleted) {
        fetchQuestionsData(1);
      }

      setOldSettings({
        ...settings
      })

      resolve('Settings updated!');
    });
  }, [settings]);

  useEffect(() => {
    const initialize = async () => {
      setPageType('normal')

      toggleNavbar(true)

      toggleFooter(true)

      fetchQuestionsData();
    }

    initialize()
  }, []);

  return (
    <>
      <div className="columns">
        <div className="column">
          <div className="section-header">{`Page ${currentPage}`}</div>

          <div className="section-content">
            {!settings.surveyCompleted && currPageQuestions && currPageQuestions.length > 0 && (
              <>
                {/* <div className="notification is-info is-light">
                  <strong className="mb-2">Note:</strong>
                  <ul>
                    <li>
                      (<span className="required-field-marker">*</span>) marked
                      fields are mandatory.
                    </li>
                  </ul>
                </div> */}

                <div className="questions-list">
                  {currPageQuestions.map((question, index) => {
                    if (!isQuestionVisible(question)) {
                      return null;
                    }

                    const isEmailField = (question.name || '').toLowerCase() === 'pt_email';

                    return (
                      <>
                        {isEmailField && (
                          <DocAIUploader />
                        )}
                        <QuestionField
                          key={question.id}
                          question={question}
                          value={((responses[question.id] ?? {}).value ?? null)}
                          questionIndex={index}
                          setQuestionValue={onQuestionValueChanged}
                          language={settings.language}
                        />
                      </>
                    );
                  })}
                </div>

                <div className="questions-actions py-5">
                  {currentPage > 1 && (
                    <a
                      href="#"
                      className="btn-theme mr-auto"
                      onClick={(e) => onPageSubmitted(e, "b", false)}
                    >
                      <i className="fa-solid fa-angles-left"></i> &nbsp; Previous
                      Page
                    </a>
                  )}
                  {currentPage < settings.totalPages && (
                    <a
                      href="#"
                      className="btn-theme ml-auto"
                      onClick={onPageSubmitted}
                    >
                      Next Page &nbsp;{" "}
                      <i className="fa-solid fa-angles-right"></i>
                    </a>
                  )}
                  {currentPage == settings.totalPages && (
                    <a
                      href="#"
                      className="btn-theme"
                      onClick={onPageSubmitted}
                    >
                      <i className="fa-solid fa-paper-plane"></i> &nbsp; Submit
                    </a>
                  )}
                </div>
              </>
            )}

            {
              !isLoading && !settings.surveyCompleted && !(currPageQuestions && currPageQuestions.length > 0) && (
                <>
                  <div className="card">
                    <div className="card-content">
                      <div className="notification is-danger is-light">
                        <i className="fa-solid fa-triangle-exclamation"></i> &nbsp; There are no questions found in the Database!
                      </div>
                    </div>

                    <footer className="card-footer">
                      <a
                        href="#"
                        className="btn-theme mx-auto my-5"
                        onClick={(e) => fetchQuestionsData(currentPage)}
                      >
                        <i className="fa-solid fa-rotate-right"></i> &nbsp; Refresh to Check
                      </a>
                    </footer>
                  </div>
                </>
              )
            }

            {settings.surveyCompleted && (
              <div className="card">
                <div className="card-content">
                  <div className="notification is-success is-light">
                    <i className="fa-solid fa-check-double"></i> &nbsp; All the
                    Questions have been completed and submitted.
                  </div>
                </div>

                <footer className="card-footer">
                  <a
                    href="#"
                    className="btn-theme mx-auto my-5"
                    onClick={onEditResponsesClicked}
                  >
                    <i className="fa-solid fa-pen-to-square"></i> &nbsp; Edit My Response
                  </a>
                </footer>
              </div>
            )}
          </div>

        </div>
      </div>
      
      {
          confirmation &&
          <Alert {...confirmation} />
      }
    </>
  );
}
