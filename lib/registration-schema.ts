import * as z from "zod";
import { validateEmail } from "@/app/actions/validate-email";

// Stricter Phone Regex:
// 1. Must contain at least 8 digits (standard landline/mobile usually has area code + number >= 8)
// 2. Allowed chars: digits, spaces, +, -, (, ), /
// 3. Min length overall 8
// 4. Must start with + or digit or (
export const phoneRegex = /^(?=(?:[^0-9]*[0-9]){8})[\d\s\+\-\(\)\/]{8,}$/;

// Helper for whitespace normalization
const normalize = (val: string) => val.trim().replace(/\s+/g, ' ');

// Name Validation: letters of any script (A\u011Fao\u011Flu, \u041E\u043B\u0435\u043D\u0430), spaces, hyphens,
// apostrophes incl. the typographic one phones insert, dots (for Jr., St.).
// Disallows numbers and other special characters like ! @ # $ % ^ & * ( ) < >
const nameRegex = /^[\p{L}\p{M}\s\-\.'\u2019]+$/u;

// Safe Text: Disallow < and > to prevent basic HTML injection
const safeTextRegex = /^[^<>]*$/;

const isValidDate = (day: string, month: string, year: string) => {
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    const date = new Date(y, m - 1, d);
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
};

const isUnderage = (day: string, month: string, year: string) => {
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    const birthDate = new Date(y, m - 1, d);
    const today = new Date();

    // Check future
    if (birthDate > today) return true;

    // Check 18+
    let age = today.getFullYear() - birthDate.getFullYear();
    const mDiff = today.getMonth() - birthDate.getMonth();
    if (mDiff < 0 || (mDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age < 18;
};

export const createSchema = (t: Record<string, any>) => z.object({
    personal: z.object({
        firstName: z.string()
            .transform(normalize)
            .pipe(z.string()
                .min(2, t.registration.errors.firstname_required)
                .max(50, t.registration.errors.max_length || "Max 50 Chars")
                .regex(nameRegex, t.registration.errors.invalid_chars_name || "No numbers/special")
            ),
        lastName: z.string()
            .transform(normalize)
            .pipe(z.string()
                .min(2, t.registration.errors.lastname_required)
                .max(50, t.registration.errors.max_length || "Max 50 Chars")
                .regex(nameRegex, t.registration.errors.invalid_chars_name || "No numbers/special")
            ),
        email: z.string()
            .trim()
            .max(100, t.registration.errors.max_length || "Max 100 Chars")
            .email(t.registration.errors.email_invalid)
            .refine(val => !val.includes(".."), t.registration.errors.email_invalid || "Invalid Format")
            .refine(val => !/[<>]/.test(val), t.registration.errors.invalid_chars_generic || "Invalid Characters") // Extra Injection Check
            .refine(async (email) => {
                const { isValid } = await validateEmail(email);
                return isValid;
            }, t.registration.errors.email_domain_invalid || "Invalid Domain"),
        phone: z.string()
            .trim()
            .max(30, t.registration.errors.max_length || "Max Length Exceeded")
            .refine(val => !/[<>]/.test(val || ""), t.registration.errors.invalid_chars_generic || "Invalid Characters")
            .refine((val) => val === "" || phoneRegex.test(val), t.registration.errors.phone_invalid)
            .optional(),
        street: z.string()
            .transform(normalize)
            .pipe(z.string()
                .min(3, t.registration.errors.street_required)
                .max(100, t.registration.errors.max_length || "Max 100 Chars")
                .regex(safeTextRegex, t.registration.errors.invalid_chars_generic || "Invalid Characters")
            ),
        zip: z.string()
            .trim()
            .length(5, t.registration.errors.zip_length)
            .regex(/^\d+$/, t.registration.errors.zip_numeric),
        city: z.string()
            .transform(normalize)
            .pipe(z.string()
                .min(2, t.registration.errors.city_required)
                .max(50, t.registration.errors.max_length || "Max 50 Chars")
                .regex(safeTextRegex, t.registration.errors.invalid_chars_generic || "Invalid Characters")
            ),
        birthDate: z.string()
            .trim()
            .min(1, t.registration.errors.birthdate_required)
            .regex(/^\d{2}\.\d{2}\.\d{4}$/, t.registration.errors.birthdate_incomplete || "Complete Date Required")
            .refine((val) => {
                const [d, m, y] = val.split('.');
                return isValidDate(d, m, y);
            }, t.registration.errors.invalid_date || "Invalid Date")
            .refine((val) => {
                const [d, m, y] = val.split('.');
                return !isUnderage(d, m, y);
            }, t.registration.errors.underage || "Must be 18+"),
    }),
});

export type EnrollmentFormData = z.infer<ReturnType<typeof createSchema>>;
