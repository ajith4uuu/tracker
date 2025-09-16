const { getFirestore, setDoc, doc, writeBatch } = require('firebase/firestore');
const { initializeApp } = require('firebase/app');

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const FirebaseApp = initializeApp(firebaseConfig);
const FirebaseDB = getFirestore(FirebaseApp);

const { TEMP_QUESTIONS_DATA } = require("./app/temp-data.ts"); // adjust path if needed

const COLUMNS_MAPPING = {
  'id': 'FieldID',
  'page': 'PageNo',
  'sequence': 'Sequence',
  'name': 'FieldName',
  'label_en': 'Question_EN',
  'label_fr': 'Question_FR',
  'type': 'FieldType',
  'choices_en': 'Choices_EN',
  'choices_fr': 'Choices_FR',
  'is_required': 'IsRequired',
  'charLimit': 'CharLimit',
  'format': 'Format',
  'displayCondition': 'DisplayCondition',
  'validationRules': 'ValidationRules',
};

function sanitize(obj) {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, v === undefined ? null : v])
  );
}

async function uploadQuestions() {
  try {
    let totalPages = 0;

    const batch = writeBatch(FirebaseDB);

    for (let i = 0; i < TEMP_QUESTIONS_DATA.length; i++) {
      let tempQuestion = TEMP_QUESTIONS_DATA[i];
      let question = {};

      if (typeof(tempQuestion['id']) === 'undefined') {
        Object.keys(COLUMNS_MAPPING).forEach(k => {
          question[k] = tempQuestion[COLUMNS_MAPPING[k]];
        });
      } else {
        question = {...tempQuestion};
      }

      if (!question.id) {
        // Skip questions with invalid ID
        continue;
      }

      let qId = `Q-${question.id}`.replaceAll('.', '-');

      console.log(qId);

      batch.set(doc(FirebaseDB, "questions", qId), sanitize(question));

      if (question.page && !isNaN(question.page)) {
        totalPages = Math.max(totalPages, question.page);
      }
    }

    console.log('totalPages:',totalPages);

    batch.set(doc(FirebaseDB, "meta", "totalPages"), { 'value': totalPages });

    await batch.commit();

    console.log("All questions uploaded successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Error uploading questions:", err);
    process.exit(1);
  }
}

uploadQuestions();
