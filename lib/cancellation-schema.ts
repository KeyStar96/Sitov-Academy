import { z } from "zod";
import { validateEmail } from "@/app/actions/validate-email";

export const createCancellationSchema = (t: any) => z.object({
    fullName: z.string().min(2, t?.cancellation?.errors?.name_required || "Name must be at least 2 characters"),
    email: z.string()
        .trim()
        .email(t?.cancellation?.errors?.email_invalid || "Invalid email address")
        .refine(val => !val.includes(".."), t?.cancellation?.errors?.email_invalid || "Invalid Format")
        .refine(val => !/[<>]/.test(val), t?.cancellation?.errors?.generic_error || "Invalid Characters")
        .refine(async (email) => {
            // Only validate if it looks like an email to save server calls
            if (!email.includes("@")) return false;
            const { isValid } = await validateEmail(email);
            return isValid;
        }, t?.cancellation?.errors?.email_invalid || "Invalid Domain"),
    courseId: z.string().uuid().or(z.literal('')).optional(),
    terminationDate: z.enum(["asap", "specific_date"]),
    specificDate: z.string().optional(), // In case they pick a date
}).refine((data) => {
    if (data.terminationDate === "specific_date") {
        if (!data.specificDate) return false;
        // Strict check for DD.MM.YYYY format
        return /^\d{2}\.\d{2}\.\d{4}$/.test(data.specificDate);
    }
    return true;
}, {
    message: t?.cancellation?.errors?.date_required_specific || "Date is required when specific date is selected",
    path: ["specificDate"],
});

export type CancellationFormData = z.infer<ReturnType<typeof createCancellationSchema>>;
