import { useEffect, useState } from "react";
import { useOutletContext } from "react-router";
import { QuestionField } from "~/components/ui/question-field";
import { CONSENT_FILE_QUESTION_FIELD_NAME, CONSENT_FILE_FIELD_ALIASES, END_SURVEY_CONDITIONS, LANGUAGES_AVAILABLE } from "~/constant";
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
import TEMP_QUESTIONS_DATA from "~/temp-data";

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

    try {
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

          let usedFallback = false;

          try {
            await BQLoadQuestionsIntoFirestore(currentUser.uid);
          } catch (error) {
            consoleError('Failed to load questions from BigQuery into Firestore:', error);

            // Fallback: use bundled TEMP_QUESTIONS_DATA so UI remains functional
            try {
              const mapped = (TEMP_QUESTIONS_DATA || []).map((q: any, idx: number) => ({
                id: q.FieldID ?? q.FieldId ?? String(idx + 1),
                sequence: q.Sequence ?? idx + 1,
                page: Number(((q.PageNo ?? (q as any).page) ?? 1) || 1),
                name: q.FieldName || q.FieldName || ('field_' + (q.FieldID ?? idx + 1)),
                label_en: q.Question_EN || q.Question_En || q.Question_En || '',
                label_fr: q.Question_FR || q.Question_Fr || '',
                type: (q.FieldType || 'descriptive').toLowerCase(),
                choices_en: q.Choices_EN,
                choices_fr: q.Choices_FR,
                is_required: !!q.IsRequired,
                charLimit: q.CharLimit,
                format: q.Format,
                displayCondition: q.DisplayCondition,
              }));

              setAllPagesQuestions([...mapped]);

              firestoreQuestions = mapped;

              newSettings = {
                language: 'en',
                totalPages: mapped.reduce((acc: number, it: any) => Math.max(acc, Number(it.page) || 1), 1),
                resumePage: 1,
                surveyCompleted: false,
              };

              usedFallback = true;

              consoleLog('Using TEMP_QUESTIONS_DATA fallback, totalPages:', newSettings.totalPages);
            } catch (e) {
              toggleLoading(false);
              errorToast('Unable to fetch questions from backend and fallback failed. Error: ' + (error?.message || String(error)));
              return;
            }
          }

          if (!usedFallback) {
            firestoreQuestions = await fetchAllQuestionsFromFirestore(currentUser.uid);

            newSettings = await fetchUserSettingsFromFirestore(currentUser.uid)
          }
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

          if (CONSENT_FILE_FIELD_ALIASES.includes(question.name)) {
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

            if (CONSENT_FILE_FIELD_ALIASES.includes(question.name) && response.downloadURL) {
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
    } catch (error) {
      consoleError('Error fetching questions data:', error)
      toggleLoading(false)
      errorToast('Unable to load questions. Please refresh and try again.')
      return
    }

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

    // Skip only if this page has questions but all are hidden by conditions
    if (visibleQuestions === 0) {
      if (tempPageQuestions && tempPageQuestions.length > 0) {
        consoleLog('Skipping the page as there are no visible questions!')
        if (dir == 'b') {
          onPageSubmitted(null, page - 1, false)
        } else {
          onPageSubmitted(null, page + 1, false)
        }
        return
      } else {
        consoleLog('No questions exist for this page; showing empty state')
        toggleLoading(false)
        setCurrentPage(page)
        scrollToTop()
        return
      }
    }

    toggleLoading(false);

    setCurrentPage(page);

    scrollToTop()
  };

  const isQuestionVisible = (question: any) => {
    if (question.displayCondition) {
      let statement = question.displayCondition

      consoleLog('question.displayCondition:', question.displayCondition)

      // Build a context object with all question values so identifiers resolve safely
      const ctx: any = {};
      for (let i = 0; i < allPagesQuestions.length; i++) {
        const q = allPagesQuestions[i];
        if (!q || !q.name) continue;
        ctx[String(q.name)] = (responses[q.id] ?? {}).value ?? null;
      }

      // Preserve original dependency-checking behavior (recursive visibility)
      for (let i = 0; i < allPagesQuestions.length; i++) {
        if (question.id == allPagesQuestions[i].id) continue

        if (statement.indexOf(allPagesQuestions[i].name) > -1) {
          if (!isQuestionVisible(allPagesQuestions[i])) {
            return false
          }
        }
      }

      // First, replace ANY bracketed tokens [name] with their literal values (or null if missing)
      statement = statement.replace(/\[([A-Za-z_][A-Za-z0-9_]*)\]/g, (m: string, name: string) => {
        try {
          const v = (ctx as any)[name];
          return v == null ? 'null' : JSON.stringify(v);
        } catch {
          return 'null';
        }
      });

      // Replace bracketed tokens like [field_name] and bare identifiers with placeholders first,
      // then substitute placeholders with JSON literals. This prevents nested replacements for known keys in ctx.
      const placeholders: string[] = [];
      let iKey = 0;
      for (const k in ctx) {
        const escName = String(k).replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
        const placeholder = `@@FIELD_${iKey}@@`;
        placeholders.push(placeholder);
        // bracketed token [name] (already handled above, but keep to catch different casing/variants)
        statement = statement.replace(new RegExp(`\\[${escName}\\]`, 'g'), placeholder);
        // bare identifier (avoid replacing inside quotes, after dot, or inside existing brackets)
        statement = statement.replace(new RegExp(`(?<!['"\.\\w\\[])\\b${escName}\\b`, 'g'), placeholder);
        iKey++;
      }

      // convert <> to !=
      statement = statement.replaceAll('<>', '!=');

      // Now substitute placeholders with safe JSON literals
      iKey = 0;
      for (const k in ctx) {
        const v = (ctx as any)[k];
        const valLit = (v == null ? 'null' : JSON.stringify(v));
        const placeholder = `@@FIELD_${iKey}@@`;
        statement = statement.split(placeholder).join(valLit);
        iKey++;
      }

      try {
        consoleLog('evaluating with ctx (post-replace):', statement, ctx)

        // Basic safety check: only allow a restricted set of characters after replacement.
        const safePattern = /^[\sA-Za-z0-9_\[\]\'\"\(\)\.,:;<>!=&|+\-/*%?]+$/;
        if (!safePattern.test(statement)) {
          consoleError('Unsafe displayCondition detected, skipping eval:', statement);
          return false;
        }

        // Evaluate by binding all ctx keys as function parameters to avoid ReferenceError
        const keys = Object.keys(ctx || {});
        const vals = keys.map(k => (ctx as any)[k]);

        // If there are no keys, still evaluate safely
        let result: any = false;
        if (keys.length === 0) {
          // eslint-disable-next-line no-new-func
          const fnNoCtx = new Function(`return (${statement});`);
          result = fnNoCtx();
        } else {
          // eslint-disable-next-line no-new-func
          const fn = new Function(...keys, `return (${statement});`);
          result = fn(...vals);
        }

        if (result) {
          consoleLog('display condition met')

          return true
        } else {
          return false
        }
      } catch(error) {
        consoleError('Error when evaluating the displayCondition:', error, 'statement:', statement)

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
        // Reset statement to original to avoid any prior naive replacements
        statement = String(END_SURVEY_CONDITIONS[esI]);

        // Build context from all questions so identifiers resolve
        const ctx: any = {};
        for (let i = 0; i < allPagesQuestions.length; i++) {
          const qAll = allPagesQuestions[i];
          if (!qAll || !qAll.name) continue;
          const resp = (updatedResponses[qAll.id] ?? responses[qAll.id]) ?? {};
          ctx[String(qAll.name)] = resp.value ?? null;
        }

        // Replace bracketed tokens first
        statement = statement.replace(/\[([A-Za-z_][A-Za-z0-9_]*)\]/g, (m: string, name: string) => {
          try {
            const v = (ctx as any)[name];
            return v == null ? 'null' : JSON.stringify(v);
          } catch {
            return 'null';
          }
        });

        // Placeholders for known identifiers, then substitute with JSON literals
        let iKey = 0;
        for (const k in ctx) {
          const escName = String(k).replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
          const placeholder = `@@END_FIELD_${iKey}@@`;
          statement = statement.replace(new RegExp(`\\[${escName}\\]`, 'g'), placeholder);
          statement = statement.replace(new RegExp(`(?<!['"\.\\w\\[])\\b${escName}\\b`, 'g'), placeholder);
          iKey++;
        }

        // normalize operators
        statement = statement.replaceAll('<>', '!=');

        iKey = 0;
        for (const k in ctx) {
          const v = (ctx as any)[k];
          const valLit = (v == null ? 'null' : JSON.stringify(v));
          const placeholder = `@@END_FIELD_${iKey}@@`;
          statement = statement.split(placeholder).join(valLit);
          iKey++;
        }

        consoleLog('[END_SURVEY_CONDITIONS] evaluating (post-replace):', statement, ctx)

        const safePattern = /^[\sA-Za-z0-9_\[\]'"\(\)\.,:;<>!=&|+\-/*%?]+$/;
        if (!safePattern.test(statement)) {
          consoleError('Unsafe END_SURVEY_CONDITIONS detected, skipping eval:', statement);
        } else {
          // Evaluate by binding all ctx keys as function parameters to avoid ReferenceError
          const keys = Object.keys(ctx || {});
          const vals = keys.map(k => (ctx as any)[k]);

          let result: any = false;
          if (keys.length === 0) {
            // eslint-disable-next-line no-new-func
            const fnNoCtx = new Function(`return (${statement});`);
            result = fnNoCtx();
          } else {
            // eslint-disable-next-line no-new-func
            const fn = new Function(...keys, `return (${statement});`);
            result = fn(...vals);
          }

          if (result) {
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

      // If this page contains consent/signature confirmations, (re)generate consent PDF and persist its link
      try {
        const hasConsentStep = currPageQuestions.some((q: any) => /pt_signature|confirm|consent/i.test(String(q?.name || '')));
        if (hasConsentStep) {
          const [ok, payload] = await BQGenerateConsentPDFForUser(currentUser.uid, updatedResponses);
          if (ok && payload && payload.consentFile) {
            const consentQ = (allPagesQuestions || []).find((q: any) => CONSENT_FILE_FIELD_ALIASES.includes(q?.name));
            if (consentQ) {
              const downloadURL = await fetchFileDownloadURLFromGCS(payload.consentFile);
              updatedResponses[String(consentQ.id)] = { id: consentQ.id, name: consentQ.name, value: payload.consentFile, downloadURL };
              await storeAllUserResponsesToFirestore(currentUser.uid, updatedResponses);
              setResponses(updatedResponses);
            }
          }
        }
      } catch (e) {
        consoleError('Error when generating consent PDF after save:', e);
      }

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

  // Map DocAI extraction to survey fields and update responses
  const applyDocAIExtraction = async (extracted: any) => {
    if (!extracted || typeof extracted !== 'object') return;

    const lang = settings.language || 'en';

    const parseOptions = (q: any) => {
      const str = q?.[`choices_${lang}`] || q?.[`options_${lang}`] || q?.choices || q?.options || '';
      const out: Array<{ value: string; label: string }> = [];
      if (typeof str !== 'string' || !str) return out;
      if (str.includes('||')) {
        str.split('||').map(t => t.trim()).forEach(t => { const p = t.split('|'); if (p.length > 1) out.push({ value: p[0], label: p[1] }); });
      } else if (str.includes('|')) {
        str.split('|').map(t => t.trim()).forEach(t => out.push({ value: t, label: t }));
      } else if (str.includes('\n')) {
        str.split('\n').map(t => t.trim()).forEach(t => { if (t.includes('|')) { const p = t.split('|'); if (p.length > 1) out.push({ value: p[1], label: p[0] }); } else out.push({ value: t, label: t }); });
      }
      return out;
    };

    const pickByIncludes = (opts: any[], ...needles: string[]) => {
      const n = needles.map(s => s.toLowerCase());
      return opts.find(o => n.some(s => (o.label || '').toLowerCase().includes(s) || (o.value || '').toLowerCase().includes(s)))?.value ?? null;
    };

    const next: any = { ...responses };
    const ensureSet = (q: any, val: any) => {
      if (!q) return;
      if (!next[q.id]) next[q.id] = { id: q.id, name: q.name };
      next[q.id].value = val;
    };

    const all = allPagesQuestions || [];
    const byName = (re: RegExp) => all.find((q: any) => re.test(String(q?.name || '').toLowerCase()));
    const byLabel = (re: RegExp) => all.find((q: any) => re.test(String(q?.[`label_${lang}`] ?? q?.label ?? '')));

    // HER2 radio
    const qHER2 = byName(/her\s*-?\s*2|her2/) || byLabel(/her\s*-?\s*2/i);
    if (qHER2 && (extracted.HER2 || extracted.HER2Score)) {
      const opts = parseOptions(qHER2);
      let v: any = null;
      if (extracted.HER2Score) {
        const s = String(extracted.HER2Score).toLowerCase();
        if (/3\+/.test(s)) v = pickByIncludes(opts,'3+');
        else if (/2\+/.test(s)) v = pickByIncludes(opts,'2+');
        else if (/1\+/.test(s)) v = pickByIncludes(opts,'+1','1+');
        else if (/\b0\b/.test(s)) v = pickByIncludes(opts,'0');
      }
      if (!v && extracted.HER2) {
        v = (/positive/i.test(extracted.HER2)) ? pickByIncludes(opts, '3+', 'positive')
          : (/equivocal/i.test(extracted.HER2)) ? pickByIncludes(opts, '2+', 'equivocal')
          : pickByIncludes(opts, '0', 'negative','1+');
      }
      if (v) ensureSet(qHER2, v);
    }

    // Ki-67 text
    const qKi = byName(/ki\s*-?\s*67/) || byLabel(/ki\s*-?\s*67/i);
    if (qKi && extracted.Ki67) {
      const n = String(extracted.Ki67).replace('%', '').trim();
      ensureSet(qKi, n);
    }

    // ER / PR
    const qER = byName(/(^|[_-])er([_-]|$)/) || byLabel(/estrogen\s*receptor|\ber\b/i);
    if (qER && extracted.ER) {
      const opts = parseOptions(qER);
      if (opts?.length) {
        const v = /pos/i.test(extracted.ER) ? pickByIncludes(opts,'pos','positive','yes') : pickByIncludes(opts,'neg','negative','no','0%');
        if (v) ensureSet(qER, v); else ensureSet(qER, extracted.ER);
      } else ensureSet(qER, extracted.ER);
    }
    const qPR = byName(/(^|[_-])pr([_-]|$)/) || byLabel(/progesterone\s*receptor|\bpr\b/i);
    if (qPR && extracted.PR) {
      const opts = parseOptions(qPR);
      if (opts?.length) {
        const v = /pos/i.test(extracted.PR) ? pickByIncludes(opts,'pos','positive','yes') : pickByIncludes(opts,'neg','negative','no','0%');
        if (v) ensureSet(qPR, v); else ensureSet(qPR, extracted.PR);
      } else ensureSet(qPR, extracted.PR);
    }

    // PD-L1 percent (text)
    const qPDL1Pct = byName(/pd\s*-?\s*l1/) || byLabel(/pd\s*-?\s*l1[^\n]*%|pd\s*-?\s*l1[^\n]*percent/i);
    if (qPDL1Pct && extracted.PDL1Percent) ensureSet(qPDL1Pct, String(extracted.PDL1Percent).replace('%', '').trim());

    // Stage at diagnosis (radio)
    const qStage = byName(/^dx_stage$/) || byLabel(/what\s*stage.*diagnosis/i) || all.find((q:any)=>{
      const opts = parseOptions(q)||[]; const labels = opts.map(o=>String(o.label||'').toLowerCase());
      return labels.includes('stage 0') && labels.includes('stage i') && labels.includes('stage ii');
    });
    if (qStage && extracted.stage) {
      const opts = parseOptions(qStage);
      const val = /iv/i.test(extracted.stage) ? pickByIncludes(opts,'stage iv','iv','4')
        : /iii/i.test(extracted.stage) ? pickByIncludes(opts,'stage iii','iii','3')
        : /ii/i.test(extracted.stage) ? pickByIncludes(opts,'stage ii','ii','2')
        : /i\b/i.test(extracted.stage) ? pickByIncludes(opts,'stage i',' i ','1')
        : pickByIncludes(opts,'stage 0','dcis','0');
      if (val) ensureSet(qStage, val);
    }

    // Date of diagnosis (date)
    const qDx = byName(/dx[_-]?date|date[_-]?of[_-]?diagnosis|diagnosis[_-]?date|initial.*diagnosis/) || byLabel(/initial.*diagnosis|date.*diagnosis/i);
    if (qDx && extracted.dateOfDiagnosis) {
      const d = String(extracted.dateOfDiagnosis).replace(/\s+/g,'').replace(/\./g,'/');
      // normalize many forms to m/d/Y
      let out = d;
      const m1 = /^(\d{4})[-\/]?(\d{1,2})[-\/]?(\d{1,2})$/.exec(d);
      const m2 = /^(\d{1,2})[-\/]?(\d{1,2})[-\/]?(\d{2,4})$/.exec(d);
      if (m1) out = `${Number(m1[2])}/${Number(m1[3])}/${m1[1]}`;
      else if (m2) out = `${Number(m2[1])}/${Number(m2[2])}/${m2[3].length===2?('20'+m2[3]):m2[3]}`;
      ensureSet(qDx, out);
    }

    // PIK3CA tested/result
    const qPIK = byName(/pik3ca/) || byLabel(/pik3ca/i);
    if (qPIK && (extracted.PIK3CA || extracted.PIK3CAStatus)) {
      const opts = parseOptions(qPIK);
      const status = String(extracted.PIK3CA || extracted.PIK3CAStatus).toLowerCase();
      let v = pickByIncludes(opts, status.includes('pos')||status.includes('mutat')?'positive':'negative');
      if (!v) v = pickByIncludes(opts, status.includes('mutat')?'yes':'no');
      if (!v) v = pickByIncludes(opts, 'tested','not tested');
      if (v) ensureSet(qPIK, v);
    }

    // BRCA mutation
    const qBRCA = byName(/brca/) || byLabel(/brca/i);
    if (qBRCA && extracted.BRCA) {
      const opts = parseOptions(qBRCA);
      const s = String(extracted.BRCA).toLowerCase();
      let v = pickByIncludes(opts, /pos|mutat|detected/.test(s)?'yes':'no');
      if (!v) v = pickByIncludes(opts, /pos|mutat|detected/.test(s)?'positive':'negative');
      if (!v) v = pickByIncludes(opts, 'i do not know','unknown');
      if (v) ensureSet(qBRCA, v);
    }

    setResponses(next);
    try { await storeAllUserResponsesToFirestore(currentUser.uid, next); } catch(e) { consoleError('Failed to persist DocAI mapping:', e); }
  };

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
                <div className="page-content-card card">
                  <div className="card-content">
                    <div className="questions-list">
                      {currentPage === 5 ? (<DocAIUploader key={`docai-page-${currentPage}`} onExtract={(extracted: any) => applyDocAIExtraction(extracted)} />) : null}
                      {currPageQuestions.map((question, index) => {
                        if (!isQuestionVisible(question)) {
                          return null;
                        }

                        const isEmailField = (question.name || '').toLowerCase() === 'pt_email';

                        return (
                          <div key={`${question.id ?? 'q'}-${index}`} className="question-row">
                                                        <QuestionField
                              key={`qf-${question.id ?? index}`}
                              question={question}
                              value={((responses[question.id] ?? {}).value ?? null)}
                              questionIndex={index}
                              setQuestionValue={onQuestionValueChanged}
                              language={settings.language}
                            />
                          </div>
                        );
                      })}
                    </div>

                    <div className="questions-actions py-5">
                      {currentPage > 1 && (
                        <a
                          href="#"
                          className="btn-theme"
                          onClick={(e) => onPageSubmitted(e, "b", false)}
                        >
                          <i className="fa-solid fa-angles-left"></i> &nbsp; Back
                        </a>
                      )}

                      <span className="resume-code">{`Resume code: ${((currentUser?.uid || '').slice(0,6) || '------').toUpperCase()}`}</span>

                      {currentPage < settings.totalPages && (
                        <a
                          href="#"
                          className="btn-theme"
                          onClick={onPageSubmitted}
                        >
                          Next &nbsp;{" "}
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
                  </div>
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
