
import { submitEnrollment } from "../app/actions/submit-enrollment";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/utils/supabase/admin";

// Mock @supabase/supabase-js (stateless client used by getCourses)
const mockSupabaseInstance = { from: jest.fn() };
jest.mock("@supabase/supabase-js", () => ({
    createClient: jest.fn(() => mockSupabaseInstance),
}));

// Mock next/cache so unstable_cache just passes through the function
jest.mock("next/cache", () => ({
    unstable_cache: <T,>(fn: T) => fn,
}));
jest.mock("@/utils/supabase/admin", () => ({
    createAdminClient: jest.fn(),
}));

// Mock ratelimit to avoid ESM issues with uncrypto/upstash in jsdom environment
jest.mock("@/lib/ratelimit", () => ({
    rateLimit: jest.fn().mockResolvedValue({ success: true, limit: 10, remaining: 9, reset: 0 })
}));

// Mock next/headers for submitEnrollment
jest.mock("next/headers", () => ({
    headers: () => ({
        get: (key: string) => {
            if (key === "x-forwarded-for") return "127.0.0.1";
            return null;
        }
    })
}));

describe("Database Integration Tests (Mocked)", () => {
    // --- Shared Spies ---
    const mockSelect = jest.fn();
    const mockCourseIn = jest.fn();
    const mockUserIlike = jest.fn();

    // Reg Table Mocks
    const mockRegSingle = jest.fn();
    const mockRegSelect = jest.fn();
    const mockRegInsert = jest.fn();

    // Enrollment Table Mocks
    const mockEnrollInsert = jest.fn();

    // Users Table Mocks
    const mockUserSelect = jest.fn();
    const mockUserEq1 = jest.fn(); // eq first_name
    const mockUserEq2 = jest.fn(); // eq last_name
    const mockUserEq3 = jest.fn(); // eq birth_date
    const mockUserLimit = jest.fn();

    // User Insert
    const mockUserInsert = jest.fn();
    const mockUserInsertSingle = jest.fn();
    const mockUserInsertSelect = jest.fn();

    // User Update
    const mockUserUpdate = jest.fn();
    const mockUserUpdateEq = jest.fn();

    // mockFrom is referenced from mockSupabaseInstance above

    // ... (inside describe) ...

    // Import getCourses AFTER mocks are set up
    let getCourses: typeof import("../app/actions/get-courses").getCourses;
    beforeAll(async () => {
        const mod = await import("../app/actions/get-courses");
        getCourses = mod.getCourses;
    });

    const mockFrom = mockSupabaseInstance.from;

    beforeEach(() => {
        jest.clearAllMocks();
        (createAdminClient as jest.Mock).mockReturnValue(mockSupabaseInstance);

        // SETUP DEFAULT BEHAVIOR
        mockFrom.mockImplementation((table) => {
            if (table === "courses") {
                return { select: mockSelect };
            }
            if (table === "registrations") {
                return { insert: mockRegInsert };
            }
            if (table === "enrollments") {
                return { insert: mockEnrollInsert };
            }
            if (table === "users") {
                return {
                    select: mockUserSelect,
                    insert: mockUserInsert,
                    update: mockUserUpdate
                };
            }
            return { select: jest.fn() };
        });

        // Default Valid Responses
        // 1. Courses
        mockSelect.mockReturnValue({ in: mockCourseIn });
        mockCourseIn.mockImplementation((_field: string, ids: string[]) => Promise.resolve({data: ids.map(id => ({id})), error:null}));

        // 2. Registration Chain: insert -> select -> single
        mockRegInsert.mockResolvedValue({ error: null });
        mockRegSelect.mockReturnValue({ single: mockRegSingle });
        mockRegSingle.mockResolvedValue({ data: { id: "mock-reg-uuid" }, error: null });

        // 3. Enrollments Chain: insert -> Promise
        mockEnrollInsert.mockResolvedValue({ error: null });

        // 4. Users Select Chain: select -> eq -> eq -> eq -> limit
        mockUserSelect.mockReturnValue({ eq: mockUserEq1 });
        mockUserEq1.mockReturnValue({ eq: mockUserEq2 });
        mockUserEq2.mockReturnValue({ eq: mockUserEq3 });
        mockUserEq3.mockReturnValue({ ilike: mockUserIlike });
        mockUserIlike.mockReturnValue({ limit: mockUserLimit });

        // Default: No existing user found (Simulate new user flow)
        mockUserLimit.mockResolvedValue({ data: [], error: null });

        // 5. Users Insert Chain: insert -> select -> single
        mockUserInsert.mockReturnValue({ select: mockUserInsertSelect });
        mockUserInsertSelect.mockReturnValue({ single: mockUserInsertSingle });
        mockUserInsertSingle.mockResolvedValue({ data: { id: "mock-new-user-id" }, error: null });

        // 6. Users Update Chain: update -> eq
        mockUserUpdate.mockReturnValue({ eq: mockUserUpdateEq });
        mockUserUpdateEq.mockResolvedValue({ error: null });
    });

    describe("getCourses", () => {
        it("should fetch courses and transform snake_case to camelCase", async () => {
            const mockDbCourses = [
                {
                    id: "c_test_1",
                    translation_key: "key_1",
                    type: "presence",
                    price: 100,
                    sessions: [{ day: "Mo", startTime: "10:00", endTime: "12:00" }],
                    instructor: "standard",
                    unit_duration: 45
                }
            ];
            mockSelect.mockResolvedValue({ data: mockDbCourses, error: null });

            const result = await getCourses();

            expect(mockFrom).toHaveBeenCalledWith("courses");
            expect(mockSelect).toHaveBeenCalledWith("*");
            expect(result[0]).toMatchObject({
                id: "c_test_1",
                translationKey: "key_1",
                type: "presence",
                unitDuration: 45
            });
        });

        it("should return empty array on DB error", async () => {
            mockSelect.mockResolvedValue({ data: null, error: { message: "Fail" } });
            const result = await getCourses();
            expect(result).toEqual([]);
        });
    });

    describe("submitEnrollment", () => {
        const mockFormData = {
            personal: {
                firstName: "Max",
                lastName: "Mustermann",
                email: "max@example.com",
                phone: "+4912345678",
                street: "Teststr. 1",
                zip: "12345",
                city: "Berlin",
                birthDate: "01.01.1990"
            }
        };

        it("should create new user and insert registration correctly", async () => {
            const result = await submitEnrollment(
                mockFormData,
                ["c_1", "c_2"],
                "01.01.2026", // Valid date
                500,
                { privacy: true, agb: true, revocation: true, videoRecording: true },
                { "c_1": 250, "c_2": 250 } // Course prices
            );

            expect(result.success).toBe(true);

            // 1. Verify User Check
            expect(mockFrom).toHaveBeenCalledWith("users");
            expect(mockUserSelect).toHaveBeenCalledWith("id"); // Checking existence
            expect(mockUserLimit).toHaveBeenCalledWith(2);
            expect(mockUserIlike).toHaveBeenCalledWith("email", "max@example.com");

            // 2. Verify User Creation (since finding returned [])
            expect(mockUserInsert).toHaveBeenCalledWith(expect.objectContaining({
                first_name: "Max",
                last_name: "Mustermann",
                birth_date: "01.01.1990",
                email: "max@example.com"
            }));

            // 3. Verify Registration Insert Linked to NEW User
            expect(mockFrom).toHaveBeenCalledWith("registrations");
            expect(mockRegInsert).toHaveBeenCalledWith(expect.objectContaining({
                user_id: "mock-new-user-id", // Linked!
                start_date: "2026-01-01",
                total_price: 500
            }));

            // 4. Verify Enrollment Inserts (NOT HAPPENING ANYMORE IN submitEnrollment, managed by DB trigger)
            // The test expects enrollments to be inserted, but the code comment says:
            // "Enrollments are now created via Database Trigger when status -> 'confirmed'. So we do NOT insert into 'enrollments' here anymore."
            // So we should expect it NOT to be called.
            expect(mockEnrollInsert).not.toHaveBeenCalled();
            // Or better, check that registration has course_ids
            expect(mockRegInsert).toHaveBeenCalledWith(expect.objectContaining({
                course_ids: ["c_1", "c_2"]
            }));
        });

        it("should identify returning user and Link Registration (Deduplication)", async () => {
            // Mock finding a user (Name+DOB match)
            mockUserLimit.mockResolvedValue({ data: [{ id: "existing-user-id" }], error: null });

            const result = await submitEnrollment(
                mockFormData,
                ["c_1"],
                "01.01.2026",
                100,
                { privacy: true, agb: true, revocation: true, videoRecording: true },
                { "c_1": 100 }
            );

            expect(result.success).toBe(true);

            // 1. Verify NO NEW User Created
            expect(mockUserInsert).not.toHaveBeenCalled();

            // 2. Verify Registration Linked to EXISTING ID
            expect(mockRegInsert).toHaveBeenCalledWith(expect.objectContaining({
                user_id: "existing-user-id", // The critical check
                total_price: 100
            }));
        });

        it("never overwrites established contact details and records submitted changes in the registration snapshot", async () => {
            // Mock finding a user
            mockUserLimit.mockResolvedValue({ data: [{ id: "existing-user-id" }], error: null });

            // Simulate NEW contact info in the form
            const updatedFormData = {
                ...mockFormData,
                personal: {
                    ...mockFormData.personal,
                    email: "new-email@example.com",
                    city: "Munich",
                    street: "New Street 1"
                }
            };

            const result = await submitEnrollment(
                updatedFormData,
                ["c_1"],
                "01.01.2026",
                100,
                { privacy: true, agb: true, revocation: true, videoRecording: true },
                { "c_1": 100 }
            );

            expect(result.success).toBe(true);

            expect(mockUserUpdate).not.toHaveBeenCalled();
            expect(mockUserIlike).toHaveBeenCalledWith("email", "new-email@example.com");
            expect(mockRegInsert).toHaveBeenCalledWith(expect.objectContaining({
                status: "pending",
                contact_snapshot: expect.objectContaining({email:"new-email@example.com",city:"Munich",street:"New Street 1"})
            }));
        });

        it("should handle Registration Table failure", async () => {
            mockRegInsert.mockResolvedValue({ error: { message: "Private database error" } });

            const result = await submitEnrollment(
                mockFormData,
                ["c_1"],
                "01.01.2026",
                100,
                { privacy: true, agb: true, revocation: true, videoRecording: true },
                { "c_1": 100 }
            );

            expect(result.success).toBe(false);
            expect(result).toEqual({success:false,message:"generic_error"});
            expect(mockEnrollInsert).not.toHaveBeenCalled();
        });

        // The Enrollment Table failure test is obsolete because enrollments are not inserted manually anymore
        // I will remove it or update it to check registration logic errors if applicable.
        // For now, removing it or commenting it out is safest.
    });
});
