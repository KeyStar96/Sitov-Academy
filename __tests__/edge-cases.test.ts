/**
 * CRITICAL EDGE CASE TESTS
 * These test scenarios that could silently break the application.
 */
import { calculateMonthlyStats, getNext6Months } from "../lib/course-calculations";
import { createSchema } from "../lib/registration-schema";
import { CourseConfig } from "../lib/course-config";

// Mock dictionary for tests
const mockT = {
    registration: {
        errors: {
            firstname_required: "Required",
            lastname_required: "Required",
            email_invalid: "Invalid email",
            email_domain_invalid: "Invalid domain",
            phone_invalid: "Invalid phone",
            street_required: "Required",
            zip_length: "Must be 5 digits",
            zip_numeric: "Numbers only",
            city_required: "Required",
            birthdate_required: "Required",
            birthdate_incomplete: "Incomplete",
            invalid_date: "Invalid date",
            underage: "Must be 18+",
            invalid_chars_name: "Invalid characters",
            max_length: "Too long",
            invalid_chars_generic: "Invalid characters"
        }
    }
};

// Mock email validation
jest.mock("@/app/actions/validate-email", () => ({
    validateEmail: jest.fn().mockResolvedValue({ isValid: true })
}));

describe('Critical Edge Cases', () => {

    describe('Year Boundary Course Calculations', () => {
        const testCourse: CourseConfig = {
            id: "test_course",
            slug: "test",
            type: "presence",
            unitPrice: 5.00,
            unitMinutes: 45,
                sessions: [{ day: "Mo", startTime: "09:00", endTime: "10:30" }]
        };

        test('December base date should calculate for January next year', () => {
            const decemberDate = new Date(2025, 11, 15); // Dec 15, 2025
            const months = getNext6Months('de', decemberDate);

            // First month should be January 2026
            expect(months[0].month).toBe(0); // January
            expect(months[0].year).toBe(2026);
            expect(months[0].label).toContain('2026');
        });

        test('Calculation for January after December rollover', () => {
            const stats = calculateMonthlyStats(testCourse, 'de', 0, 2026, []);

            expect(stats.targetMonth).toBe(0);
            expect(stats.targetYear).toBe(2026);
            expect(stats.sessionCount).toBeGreaterThan(0);
        });

        test('Full year rollover maintains correct session counts', () => {
            // Calculate December 2025
            const decStats = calculateMonthlyStats(testCourse, 'de', 11, 2025, []);
            // Calculate January 2026
            const janStats = calculateMonthlyStats(testCourse, 'de', 0, 2026, []);

            // Both should have reasonable session counts (4-5 Mondays)
            expect(decStats.sessionCount).toBeGreaterThanOrEqual(4);
            expect(janStats.sessionCount).toBeGreaterThanOrEqual(4);
        });
    });

    describe('Leap Year Date Validation', () => {
        const schema = createSchema(mockT);

        test('Feb 29 on leap year (2004) should be valid for 18+ person', async () => {
            const result = await schema.safeParseAsync({
                personal: {
                    firstName: "Test",
                    lastName: "User",
                    email: "test@example.com",
                    street: "Test Street 1",
                    zip: "12345",
                    city: "Berlin",
                    birthDate: "29.02.2004" // Valid leap year, person is 22 in 2026
                }
            });
            expect(result.success).toBe(true);
        });

        test('Feb 29 on non-leap year (2023) should be invalid', async () => {
            const result = await schema.safeParseAsync({
                personal: {
                    firstName: "Test",
                    lastName: "User",
                    email: "test@example.com",
                    street: "Test Street 1",
                    zip: "12345",
                    city: "Berlin",
                    birthDate: "29.02.2023" // Invalid - 2023 is not a leap year
                }
            });
            expect(result.success).toBe(false);
        });

        test('Feb 29 on century non-leap year (1900) should be invalid', async () => {
            const result = await schema.safeParseAsync({
                personal: {
                    firstName: "Test",
                    lastName: "User",
                    email: "test@example.com",
                    street: "Test Street 1",
                    zip: "12345",
                    city: "Berlin",
                    birthDate: "29.02.1900" // 1900 is NOT a leap year (century rule)
                }
            });
            expect(result.success).toBe(false);
        });

        test('Feb 29 on century leap year (2000) should be valid', async () => {
            const result = await schema.safeParseAsync({
                personal: {
                    firstName: "Test",
                    lastName: "User",
                    email: "test@example.com",
                    street: "Test Street 1",
                    zip: "12345",
                    city: "Berlin",
                    birthDate: "29.02.2000" // 2000 IS a leap year (400 rule)
                }
            });
            expect(result.success).toBe(true);
        });
    });

    describe('International Phone Formats (Valid Cases)', () => {
        const schema = createSchema(mockT);

        const validPhones = [
            "+49 170 1234567",      // German mobile with spaces
            "+1 (555) 123-4567",    // US format
            "0049 170 12345678",    // German with country code
            "+44 20 7123 4567",     // UK landline
            "(030) 12345678",       // German landline with area code
            "+33 1 42 68 53 00",    // French format
        ];

        test.each(validPhones)('Valid international format: %s', async (phone) => {
            const result = await schema.safeParseAsync({
                personal: {
                    firstName: "Test",
                    lastName: "User",
                    email: "test@example.com",
                    phone: phone,
                    street: "Test Street 1",
                    zip: "12345",
                    city: "Berlin",
                    birthDate: "01.01.1990"
                }
            });
            expect(result.success).toBe(true);
        });

        test('Empty phone should be valid (optional field)', async () => {
            const result = await schema.safeParseAsync({
                personal: {
                    firstName: "Test",
                    lastName: "User",
                    email: "test@example.com",
                    phone: "",
                    street: "Test Street 1",
                    zip: "12345",
                    city: "Berlin",
                    birthDate: "01.01.1990"
                }
            });
            expect(result.success).toBe(true);
        });
    });
});
