
export type Day = "Mo" | "Di" | "Mi" | "Do" | "Fr" | "Sa" | "So";
export type CourseType = "presence" | "online";

export interface CourseSession {
    day: Day;
    startTime: string; // HH:MM
    endTime: string; // HH:MM
}

export interface CourseConfig {
    id: string;
    slug: string;
    title?: string;
    description?: string;
    category?: 'german' | 'speaking' | 'online' | 'private';
    sortOrder?: number;
    translations?: {locale:string;title:string;description:string}[];
    type: CourseType;
    unitPrice: number;
    sessions: CourseSession[];
    level?: string;
    unitMinutes: number;
    startDate?: string;
    endDate?: string;
    trialLessons?: boolean;
}


export interface CourseException {
    date: string; // YYYY-MM-DD
    reason: string;
    courseIds?: string[]; // Optional: Specific Course IDs. If omitted, applies to ALL courses.
}
