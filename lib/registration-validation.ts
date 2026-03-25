/**
 * Shared registration validation for client + POST /api/register.
 * Keep rules in sync with the registration form.
 *
 * Security goals:
 * - Use Zod for strict schema validation.
 * - Strip unknown fields so attackers can’t smuggle extra payload.
 * - Normalize inputs (trim, collapse spaces, remove control chars).
 * - Reject suspicious strings (control chars / HTML angle brackets).
 */

import { z } from "zod";

const ALLOWED_DEPARTMENT_CODES = [
  // Keep in sync with possible UI values (including older/deprecated ones).
  "BCA",
  "BBA",
  "B.Tech",
  "MCA",
  "Bsc-IT",
  "Bsc-CA",
  "PHY",
  "MAt",
];

const ALLOWED_YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"] as const;

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

function normalizeSpaces(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function stripControlChars(s: string) {
  // Remove ASCII control chars to avoid log/header/HTML weirdness.
  return s.replace(/[\u0000-\u001F\u007F]/g, "");
}

function rejectHtmlLike(s: string) {
  // Basic guard: don’t accept angle brackets in free-text fields.
  if (s.includes("<") || s.includes(">")) return false;
  return true;
}

function sanitizeAlphaNumPlus(s: string) {
  // Allow common course-name characters without being overly permissive.
  // (Spaces are collapsed by normalizeSpaces().)
  return s.replace(/[^a-zA-Z0-9 .,'&/()\-_]/g, "");
}

const FreeTextSchema = z
  .string()
  .trim()
  .max(120)
  .refine(rejectHtmlLike, { message: "Invalid characters" })
  .transform((s) => normalizeSpaces(stripControlChars(s)));

const DepartmentSchema = z
  .string()
  .trim()
  .max(80)
  .refine(rejectHtmlLike, { message: "Invalid characters" })
  .transform((s) => sanitizeAlphaNumPlus(normalizeSpaces(stripControlChars(s))));

const YearSchema = z.enum(ALLOWED_YEARS);

const PhoneSchema = z
  .string()
  .trim()
  .transform((s) => s.replace(/\D/g, "").slice(0, 10))
  .refine((s) => /^\d{10}$/.test(s), { message: "Phone must be 10 digits" });

const EmailSchema = z
  .string()
  .trim()
  .max(254)
  .email({ message: "Invalid email address" })
  .transform((s) => normalizeSpaces(stripControlChars(s)).toLowerCase());

const UtrSchema = z
  .string()
  .trim()
  .max(96)
  .refine(rejectHtmlLike, { message: "Invalid characters" })
  .transform((s) => normalizeSpaces(stripControlChars(s)).replace(/\s+/g, ""))
  .refine((s) => /^[a-zA-Z0-9]{10,64}$/.test(s), { message: "Invalid UTR format" })
  .transform((s) => s.slice(0, 64));

const RollNumberSchema = z
  .string()
  .trim()
  .max(64)
  .refine(rejectHtmlLike, { message: "Invalid characters" })
  .transform((s) => normalizeSpaces(stripControlChars(s)))
  .optional()
  .or(z.literal(""))
  .transform((s) => (typeof s === "string" && s.trim() ? s.slice(0, 64) : null));

const RegistrationSchema = z
  .object({
    fullName: FreeTextSchema,
    email: EmailSchema,
    phone: PhoneSchema,
    // In this app, `department` may contain a selected department code OR a custom course name when UI sends "Other".
    department: DepartmentSchema
      .refine((d) => {
        const trimmed = d.trim();
        if (!trimmed) return false;
        if (trimmed === "Other") return false;
        if (ALLOWED_DEPARTMENT_CODES.includes(trimmed)) return true;
        // Custom course name: allow a conservative character set.
        const sanitized = normalizeSpaces(sanitizeAlphaNumPlus(trimmed));
        return sanitized.length > 0 && sanitized.length <= 80;
      }, { message: "Invalid department" }),
    year: YearSchema.nullable().transform((v) => (v ? v : null)),
    rollNumber: RollNumberSchema.optional(),
    utrNumber: UtrSchema,
    agreeInfo: z.boolean(),
    agreeRules: z.boolean(),
  })
  .strip()
  .refine((data) => data.agreeInfo === true && data.agreeRules === true, {
    message: "You must accept all terms to continue",
  });

export function validateRegistrationInput(
  input: RegistrationInput
): { ok: true; data: NormalizedRegistration } | { ok: false; errors: Record<string, string> } {
  const parsed = RegistrationSchema.safeParse({
    fullName: input.fullName,
    email: input.email,
    phone: input.phone,
    department: input.department,
    year: input.year,
    rollNumber: input.rollNumber ?? "",
    utrNumber: input.utrNumber,
    agreeInfo: input.agreeInfo === true,
    agreeRules: input.agreeRules === true,
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path[0];
      if (typeof path === "string") {
        // Map Zod paths to the app’s expected error keys.
        if (path === "fullName") errors.fullName = issue.message;
        else if (path === "phone") errors.phone = issue.message;
        else if (path === "email") errors.email = issue.message;
        else if (path === "department") errors.department = issue.message;
        else if (path === "year") errors.year = issue.message;
        else if (path === "utrNumber") errors.utrNumber = issue.message;
        else if (path === "rollNumber") errors.rollNumber = issue.message;
        else if (path === "agreeInfo" || path === "agreeRules") errors.terms = issue.message;
        else errors[path] = issue.message;
      } else {
        errors.terms = issue.message;
      }
    }
    // Fallback generic terms error (if refine failed without a field path).
    if (!errors.terms && parsed.error.issues.some((i) => i.message.includes("accept"))) {
      errors.terms = "You must accept all terms to continue";
    }
    return { ok: false, errors };
  }

  const data = parsed.data;

  return {
    ok: true,
    data: {
      name: data.fullName,
      email: data.email,
      phone: data.phone,
      department: data.department || null,
      year: data.year || null,
      roll_number: data.rollNumber ?? null,
      utr_number: data.utrNumber,
    },
  };
}
