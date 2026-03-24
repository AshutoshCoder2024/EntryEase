/**
 * Shared registration validation for client + POST /api/register.
 * Keep rules in sync with the registration form.
 */

const ALLOWED_DEPARTMENTS = new Set(["", "BCA", "BBA", "B.Tech", "MCA", "Other"]);
const ALLOWED_YEARS = new Set(["", "1st Year", "2nd Year", "3rd Year", "4th Year"]);

export type NormalizedRegistration = {
  name: string;
  email: string;
  phone: string;
  department: string | null;
  year: string | null;
  roll_number: string | null;
  utr_number: string;
};

export type RegistrationInput = {
  fullName?: unknown;
  email?: unknown;
  phone?: unknown;
  department?: unknown;
  year?: unknown;
  rollNumber?: unknown;
  utrNumber?: unknown;
  agreeInfo?: unknown;
  agreeRules?: unknown;
};

export function validateRegistrationInput(input: RegistrationInput): {
  ok: true;
  data: NormalizedRegistration;
} | {
  ok: false;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};
  const phoneRegex = /^\d{10}$/;

  const fullName = typeof input.fullName === "string" ? input.fullName : "";
  const email = typeof input.email === "string" ? input.email : "";
  const phone = typeof input.phone === "string" ? input.phone.replace(/\D/g, "").slice(0, 10) : "";
  const departmentRaw = typeof input.department === "string" ? input.department : "";
  const yearRaw = typeof input.year === "string" ? input.year : "";
  const rollNumber = typeof input.rollNumber === "string" ? input.rollNumber : "";
  const utrNumber = typeof input.utrNumber === "string" ? input.utrNumber : "";
  const agreeInfo = input.agreeInfo === true;
  const agreeRules = input.agreeRules === true;

  if (!fullName.trim()) errors.fullName = "Full name is required";
  else if (fullName.trim().length > 120) errors.fullName = "Name is too long (max 120 characters)";

  if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
    errors.email = "Please enter a valid email address";
  } else if (email.trim().length > 254) errors.email = "Email is too long";

  if (!phoneRegex.test(phone)) {
    errors.phone = "Phone number must contain 10 digits";
  }

  if (!utrNumber.trim()) {
    errors.utrNumber = "Please enter your UTR (transaction) number after payment";
  } else if (utrNumber.trim().length < 10) {
    errors.utrNumber = "UTR number is usually 12 digits. Please enter the full UTR.";
  } else if (utrNumber.trim().length > 64) {
    errors.utrNumber = "UTR is too long";
  }

  if (!agreeInfo || !agreeRules) {
    errors.terms = "You must accept all terms to continue";
  }

  if (!ALLOWED_DEPARTMENTS.has(departmentRaw)) {
    // Allow custom course names when UI sends "Other" details as department text.
    if (!departmentRaw.trim()) {
      errors.department = "Invalid department selection";
    } else if (departmentRaw.trim().length > 80) {
      errors.department = "Course/department is too long";
    }
  }
  if (!ALLOWED_YEARS.has(yearRaw)) {
    errors.year = "Invalid year selection";
  }

  if (rollNumber.length > 64) {
    errors.rollNumber = "Roll number is too long";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      name: fullName.trim().slice(0, 120),
      email: email.trim().slice(0, 254).toLowerCase(),
      phone,
      department: departmentRaw ? departmentRaw : null,
      year: yearRaw ? yearRaw : null,
      roll_number: rollNumber.trim().slice(0, 64) || null,
      utr_number: utrNumber.trim().slice(0, 64),
    },
  };
}
