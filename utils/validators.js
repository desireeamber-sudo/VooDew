// Small, dependency-free validation helpers used across create/edit forms.

export function isRequired(value) {
  return typeof value === "string" ? value.trim().length > 0 : value !== null && value !== undefined;
}

export function isValidAmount(value) {
  const n = Number(value);
  return !Number.isNaN(n) && Number.isFinite(n) && n > 0;
}

export function isValidUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (e) {
    return false;
  }
}

export function isValidEmail(value) {
  if (!value) return true; // email is optional on travelers
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

// Runs a field -> validator map against a values object and returns
// an { fieldName: errorMessage } object. Empty object means the form is valid.
export function validateFields(values, rules) {
  const errors = {};
  Object.keys(rules).forEach((field) => {
    const { check, message } = rules[field];
    if (!check(values[field])) {
      errors[field] = message;
    }
  });
  return errors;
}
