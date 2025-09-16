// Avoid logging to console in production
export function consoleLog(...args: any[]) {
  if (!import.meta.env.PROD) {
    console.log(...args)
  }
}

export function consoleError(...args: any[]) {
  if (!import.meta.env.PROD) {
    console.error(...args)
  }
}

export function validateQuestionField(question: any, value: any) {
  let error = '';

  if (['heading', 'descriptive', 'calc'].includes(question.type)) return null;

  if (question.is_required) {
    if (!value) {
      error = 'Required';
    }
  }

  if (!error) {
    if (question.format) {
      let format = question.format.toLowerCase();

      if (format == 'email' && !/^[^@]+@[^@]+\.[^@]+$/.test(value)) {
        error = 'Invalid Email. This field must be a valid email address (like john@example.com)';
      }

      if (format == 'phone' && !/^\(?[2-9]\d{2}\)?[-.\s]?[2-9]\d{2}[-.\s]?\d{4}$/.test(value)) {
        error = 'Invalid Phone Number. This field must be a 10 digit U.S. phone number (like 415 555 1212)';
      }

      if (format == 'number' && value && !/^[0-9]*$/.test(value)) {
        error = 'Only numbers are allowed here';
      }
    }
  }

  if (!error) {
    if (question.charLimit) {
      if (`${value}`.length > question.charLimit) {

        error = `The maximum allowed letters are ${question.charLimit}`;
      }
    }
  }

  if (error) {
    consoleLog('validation', question)
  }

  return error;
}
