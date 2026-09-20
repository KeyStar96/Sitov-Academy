"use server";

import dns from "dns";
import util from "util";

const resolveMx = util.promisify(dns.resolveMx);


export async function validateEmail(email: string): Promise<{ isValid: boolean }> {
    try {
        const domain = email.split("@")[1];
        if (!domain) return { isValid: false };

        // 1. Check MX Records (Primary)
        try {
            const mxAddresses = await resolveMx(domain);
            if (mxAddresses && mxAddresses.length > 0) return { isValid: true };
        } catch (e) {
            // MX lookup failed.
        }

        // 2. Strict Mode: If MX fails, we usually REJECT.
        // Some systems fallback to A record (RFC 5321), but for modern email (Gmail etc), MX is mandatory.
        // User wants strictness. So we return false if MX missing.

        return { isValid: false };

    } catch (error) {
        console.error("Validation error:");
        return { isValid: false };
    }
}
