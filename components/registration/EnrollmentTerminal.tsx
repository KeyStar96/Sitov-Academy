"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, ArrowLeft, ArrowRight, CalendarDays, Check, Gift, Info, Loader2, MapPin, Mic, Monitor, Send } from "lucide-react";
import BrandLogo from "@/components/layout/BrandLogo";
import type { CourseConfig, CourseException } from "@/lib/course-config";
import type { CourseSelection } from "@/lib/course-selection";
import { calculateMonthlyStats } from "@/lib/course-calculations";
import { courseText } from "@/lib/business-courses";
import { formatCourseQuantity } from "@/lib/course-quantity-i18n";
import { createSchema, type EnrollmentFormData } from "@/lib/registration-schema";
import { firstStartDate, isoToGerman, monthStarts, upcomingCourseDays } from "@/lib/registration-start-dates";
import { submitEnrollment } from "@/app/actions/submit-enrollment";
import { submitTrialLesson } from "@/app/actions/submit-trial";
import { trialEligibilityHint } from "@/app/actions/trialEligibilityHint";
import { trackMetaEvent } from "@/lib/analytics/meta-pixel";
import CourseQuantityInput from "./CourseQuantityInput";
import EnrollmentCourseCard from "./EnrollmentCourseCard";
import EnrollmentStartDates, { type StartOption } from "./EnrollmentStartDates";
import EnrollmentCosts, { EnrollmentTrialCosts, monthCost } from "./EnrollmentCosts";
import EnrollmentConsents, { type ConsentItem, type ConsentKey } from "./EnrollmentConsents";
import { BirthDateField, PhoneField, TextField } from "./EnrollmentFields";
import { EnrollmentDone, EnrollmentTrialUsed } from "./EnrollmentResult";
import { countLabel, fill, formatDay, formatEuro, type RegistrationDictionary } from "./registration-copy";
import "./registration.css";

export type { RegistrationDictionary };

type Step = 1 | 2 | 3 | 4;
const TOTAL_STEPS = 4;
const START_WINDOW_DAYS = 183; // about six months ahead, as before
const TRIAL_WINDOW_DAYS = 60;
const PERSONAL_FIELDS = ["firstName", "lastName", "email", "phone", "birthDate", "street", "zip", "city"] as const;
const FIELD_IDS: Record<(typeof PERSONAL_FIELDS)[number], string> = {
    firstName: "reg-first-name", lastName: "reg-last-name", email: "reg-email", phone: "reg-phone",
    birthDate: "reg-birth-date-day", street: "reg-street", zip: "reg-zip", city: "reg-city",
};
const EMPTY_PERSONAL = { firstName: "", lastName: "", email: "", phone: "", birthDate: "", street: "", zip: "", city: "" };
const GROUP_ICONS = { presence: MapPin, speech: Mic, online: Monitor } as const;

/** Moves focus to what is missing and brings it into view. */
function focusFirst(selector: string) {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) return;
    element.focus({ preventScroll: true });
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    (element.closest(".reg-course, .reg-day, .reg-consent, .reg-field") ?? element)
        .scrollIntoView?.({ block: "center", behavior: reduced ? "auto" : "smooth" });
}

/**
 * Course registration (and free trial lesson) as one question per step:
 * 1. course, 2. start date, 3. personal details, 4. check, consent and send.
 * Costs appear once a course is chosen. "Weiter" always says what is missing.
 */
export default function EnrollmentTerminal({ dictionary, lang = "de", serverTime, courses, exceptions = [] }: {
    dictionary: RegistrationDictionary;
    lang: string;
    serverTime?: number;
    courses: CourseConfig[];
    exceptions?: CourseException[];
}) {
    const searchParams = useSearchParams();
    const initialCourseId = searchParams.get("courseId");
    const isTrial = searchParams.get("trial") === "1";
    const t = dictionary.registration;
    const copy = t.flow;

    const [now] = useState(() => serverTime ?? Date.now());
    const firstIso = useMemo(() => firstStartDate(now), [now]);
    const referenceYear = firstIso.slice(0, 4);

    const [step, setStep] = useState<Step>(1);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [requestedUnits, setRequestedUnits] = useState<Record<string, number>>({});
    const [startIso, setStartIso] = useState("");
    const [consents, setConsents] = useState<Record<ConsentKey, boolean>>({ privacy: false, agb: false, revocation: false, videoRecording: false });
    const [nudge, setNudge] = useState(false);
    const [detailsInvalid, setDetailsInvalid] = useState(false);
    const [checking, setChecking] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const submittingRef = useRef(false);
    const [submitFailed, setSubmitFailed] = useState(false);
    const [done, setDone] = useState(false);
    const [trialUsed, setTrialUsed] = useState(false);
    const headingRef = useRef<HTMLHeadingElement>(null);
    const firstStepRender = useRef(true);

    const schema = useMemo(() => createSchema(dictionary), [dictionary]);
    const form = useForm<EnrollmentFormData>({ resolver: zodResolver(schema), mode: "onTouched", defaultValues: { personal: EMPTY_PERSONAL } });
    const { register, control, trigger, getValues, getFieldState, handleSubmit, formState } = form;
    const errors = formState.errors.personal;

    const catalog = useMemo(() => [...courses]
        .filter(course => !isTrial || course.trialLessons !== false)
        .sort((a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100)), [courses, isTrial]);
    const groups = useMemo(() => [
        { key: "presence", title: copy.groups.presence, courses: catalog.filter(c => c.type === "presence" && c.category !== "speaking") },
        { key: "speech", title: copy.groups.speech, courses: catalog.filter(c => c.category === "speaking") },
        { key: "online", title: copy.groups.online, courses: catalog.filter(c => c.type === "online" && c.category !== "speaking") },
    ].filter(group => group.courses.length > 0), [catalog, copy.groups]);
    const selectedCourses = useMemo(() => catalog.filter(course => selectedIds.includes(course.id)), [catalog, selectedIds]);
    const courseSelections: CourseSelection[] = useMemo(() => selectedIds.map(courseId => ({
        courseId,
        ...(catalog.find(course => course.id === courseId)?.category === "private" ? { requestedUnits: requestedUnits[courseId] ?? 1 } : {}),
    })), [selectedIds, catalog, requestedUnits]);

    useEffect(() => {
        if (initialCourseId && catalog.some(course => course.id === initialCourseId)) {
            setSelectedIds(current => current.includes(initialCourseId) ? current : [initialCourseId]);
        }
    }, [initialCourseId, catalog]);

    // Only real lesson days (or, for lessons by arrangement, month starts) can be chosen.
    const startOptions: StartOption[] = useMemo(() => {
        if (selectedCourses.length === 0) return [];
        if (isTrial) return upcomingCourseDays(selectedCourses.slice(0, 1), exceptions, firstIso, { days: TRIAL_WINDOW_DAYS, limit: 8 });
        const scheduled = selectedCourses.filter(course => course.sessions.length > 0);
        if (scheduled.length > 0) return upcomingCourseDays(scheduled, exceptions, firstIso, { days: START_WINDOW_DAYS, limit: 60 });
        return monthStarts(firstIso, 3)
            .filter(iso => selectedCourses.every(course => {
                const [year, month, day] = iso.split("-").map(Number);
                return calculateMonthlyStats(course, lang, month - 1, year, exceptions, day, 1).totalUnits > 0;
            }))
            .map(iso => ({ iso, sessions: [], byArrangement: true }));
    }, [selectedCourses, isTrial, exceptions, firstIso, lang]);
    const byArrangement = startOptions.length > 0 && startOptions.every(option => option.byArrangement);

    useEffect(() => {
        if (startIso && !startOptions.some(option => option.iso === startIso)) setStartIso("");
    }, [startOptions, startIso]);

    const costStart = startIso || startOptions[0]?.iso || firstIso;
    const firstMonthTotal = useMemo(() => isTrial || selectedCourses.length === 0 ? 0
        : monthCost(selectedCourses, courseSelections, costStart, exceptions, lang).total, [isTrial, selectedCourses, courseSelections, costStart, exceptions, lang]);
    const needsVideo = selectedCourses.some(course => course.type === "online");
    const consentItems: ConsentItem[] = [
        { key: "privacy", short: copy.consents.privacy, full: t.legal.privacy, link: { href: `/${lang}/privacy`, label: copy.consents.privacy_link } },
        { key: "agb", short: copy.consents.agb, full: t.legal.agb, link: { href: `/${lang}/agb`, label: copy.consents.agb_link } },
        // A free trial lesson has nothing to withdraw from; the server never stored this consent for trials.
        ...(isTrial ? [] : [{ key: "revocation" as const, short: copy.consents.revocation, full: t.legal.revocation, link: { href: `/${lang}/agb`, label: copy.consents.agb_link } }]),
        ...(needsVideo ? [{ key: "videoRecording" as const, short: copy.consents.video_recording, full: t.legal.video_recording }] : []),
    ];
    const consentsValid = consentItems.every(item => consents[item.key]);

    const blocker = step === 1 && selectedIds.length === 0 ? (isTrial ? copy.nav.need_course_trial : copy.nav.need_course)
        : step === 2 && !startIso ? (isTrial ? copy.nav.need_start_trial : copy.nav.need_start)
            : step === 4 && !consentsValid ? copy.nav.need_consents
                : null;
    const navMessage = blocker ?? (step === 3 && detailsInvalid ? copy.nav.need_details : null);

    useEffect(() => {
        if (firstStepRender.current) { firstStepRender.current = false; return; }
        // A new question: start at the top (no long glide) and let screen readers read its title.
        window.scrollTo({ top: 0, behavior: "instant" });
        headingRef.current?.focus({ preventScroll: true });
    }, [step]);

    const goTo = (next: Step) => { setNudge(false); setSubmitFailed(false); setStep(next); };

    const toggleCourse = (id: string) => {
        setNudge(false);
        setSelectedIds(current => isTrial ? [id] : current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
    };

    async function next() {
        if (step === 1) {
            if (selectedIds.length === 0) { setNudge(true); focusFirst(".reg-course input"); return; }
            goTo(2);
        } else if (step === 2) {
            if (!startIso) { setNudge(true); focusFirst(".reg-day input"); return; }
            goTo(3);
        } else if (step === 3) {
            setChecking(true);
            try {
                const valid = await trigger("personal");
                if (!valid) {
                    setDetailsInvalid(true);
                    const first = PERSONAL_FIELDS.find(name => getFieldState(`personal.${name}`).invalid);
                    if (first) focusFirst(`#${FIELD_IDS[first]}`);
                    return;
                }
                setDetailsInvalid(false);
                if (isTrial) {
                    const personal = getValues("personal");
                    try {
                        const { eligible } = await trialEligibilityHint(personal.email, personal.firstName, personal.lastName);
                        if (!eligible) { setTrialUsed(true); return; }
                    } catch { /* The server checks again on submit. */ }
                }
                goTo(4);
            } finally {
                setChecking(false);
            }
        }
    }

    async function send(data: EnrollmentFormData) {
        if (submittingRef.current) return;
        submittingRef.current = true;
        setSubmitting(true);
        setSubmitFailed(false);
        try {
            if (isTrial) {
                const courseId = selectedIds[0];
                const result = await submitTrialLesson({
                    firstName: data.personal.firstName, lastName: data.personal.lastName, email: data.personal.email,
                    phone: data.personal.phone || undefined, birthDate: data.personal.birthDate || undefined,
                    street: data.personal.street || undefined, zip: data.personal.zip || undefined, city: data.personal.city || undefined,
                    courseId, trialDate: startIso, videoRecordingAccepted: needsVideo ? consents.videoRecording : undefined,
                    privacyAccepted: consents.privacy, agbAccepted: consents.agb, locale: lang,
                });
                if (result.success) {
                    trackMetaEvent("Lead", { content_name: "Kostenlose Probestunde", content_category: "Trial Lesson", content_ids: [courseId], currency: "EUR", value: 0.00 });
                    setDone(true);
                } else if (result.message === "trial_already_used") setTrialUsed(true);
                else setSubmitFailed(true);
            } else {
                const result = await submitEnrollment(data, courseSelections, isoToGerman(startIso), consents, lang);
                if (result.success) {
                    trackMetaEvent("Purchase", {
                        content_name: "Kurseinschreibung", content_category: "Course Enrollment", content_ids: selectedIds, currency: "EUR",
                        value: monthCost(selectedCourses, courseSelections, startIso, exceptions, lang).total,
                    });
                    setDone(true);
                } else setSubmitFailed(true);
            }
        } catch {
            setSubmitFailed(true);
        } finally {
            submittingRef.current = false;
            setSubmitting(false);
        }
    }

    function onFormSubmit(event: React.FormEvent) {
        event.preventDefault();
        if (step < 4) { void next(); return; }
        if (!consentsValid) { setNudge(true); focusFirst(".reg-consent input:not(:checked)"); return; }
        void handleSubmit(send, () => { setDetailsInvalid(true); goTo(3); })();
    }

    if (trialUsed) return <EnrollmentTrialUsed dictionary={dictionary} lang={lang} />;
    if (done) {
        const personal = getValues("personal");
        return <EnrollmentDone dictionary={dictionary} lang={lang} trial={isTrial} email={personal.email}
            name={`${personal.firstName} ${personal.lastName}`} trialDateLabel={startIso ? formatDay(startIso, lang, referenceYear) : undefined} />;
    }

    const stepKey = (["course", "start", "details", "review"] as const)[step - 1];
    const title = isTrial
        ? { course: copy.titles.course_trial, start: copy.titles.start_trial, details: copy.titles.details, review: copy.titles.review_trial }[stepKey]
        : copy.titles[stepKey];
    const intro = isTrial
        ? { course: copy.intros.course_trial, start: copy.intros.start_trial, details: copy.intros.details_trial, review: copy.intros.review_trial }[stepKey]
        : stepKey === "start" && byArrangement ? copy.intros.start_private : copy.intros[stepKey];
    const stepName = step === 2 && isTrial ? copy.steps.start_trial : copy.steps[stepKey];
    const personal = form.watch("personal");
    const startLabel = startIso ? formatDay(startIso, lang, referenceYear) : "";
    const firstMonthLabel = fill(copy.dock.first_month, { price: formatEuro(firstMonthTotal) });
    // What is chosen so far, right beside "Weiter" – the answer to "did my tap work?".
    const summary = navMessage ? null
        : step === 1 && selectedIds.length > 0 ? { icon: Check, label: countLabel(copy.dock.chosen, selectedIds.length, lang), value: isTrial ? copy.costs.trial_price : firstMonthLabel }
            : step === 2 && startIso ? { icon: CalendarDays, label: fill(isTrial ? copy.costs.trial_date : copy.review.start, { date: startLabel }) }
                : null;
    const SummaryIcon = summary?.icon;
    let cardIndex = 0;

    return (
        <div data-lenis-prevent className="registration-flow">
            <div className="reg-glow" aria-hidden="true" />
            <header className="reg-bar">
                <Link href={`/${lang}`} className="reg-home"><ArrowLeft size={20} aria-hidden="true" /><span>{copy.home}</span></Link>
                <div className="reg-brand"><BrandLogo name={dictionary.academy.brand_name} /></div>
            </header>
            <form className="reg-layout" data-step={step} noValidate onSubmit={onFormSubmit}>
                <div className="reg-head">
                    {isTrial && <p className="reg-badge"><Gift size={20} aria-hidden="true" />{t.trial.badge}</p>}
                    <div className="reg-progress">
                        <p className="reg-progress__label"><strong>{fill(copy.step_of, { step, total: TOTAL_STEPS })}</strong> · {stepName}</p>
                        <div className="reg-progress__bar" aria-hidden="true">
                            {[1, 2, 3, 4].map(value => <span key={value} data-done={value < step} data-current={value === step} />)}
                        </div>
                    </div>
                    <h1 key={`title-${step}`} id="reg-step-title" ref={headingRef} tabIndex={-1} className="reg-title reg-enter">{title}</h1>
                    <p key={`intro-${step}`} className="reg-intro reg-enter">{intro}</p>
                </div>

                <div key={step} className="reg-main">
                    {step === 1 && (groups.length === 0 ? <p className="reg-empty">{copy.no_courses}</p> : groups.map(group => {
                        const GroupIcon = GROUP_ICONS[group.key as keyof typeof GROUP_ICONS];
                        return (
                        <section key={group.key} className="reg-group" aria-labelledby={`reg-group-${group.key}`}>
                            <h2 id={`reg-group-${group.key}`} className="reg-group__title">
                                <span className="reg-group__icon" aria-hidden="true"><GroupIcon size={20} /></span>{group.title}
                            </h2>
                            <div className="reg-group__list">
                                {group.courses.map(course => {
                                    const selected = selectedIds.includes(course.id);
                                    return (
                                        <div key={course.id} className="reg-group__item reg-enter" style={{ "--i": cardIndex++ } as React.CSSProperties}>
                                            <EnrollmentCourseCard course={course} lang={lang} copy={copy} selected={selected} single={isTrial}
                                                trialPriceLabel={isTrial ? copy.costs.trial_price : undefined} onToggle={() => toggleCourse(course.id)} />
                                            {!isTrial && course.category === "private" && selected && (
                                                <CourseQuantityInput value={requestedUnits[course.id] ?? 1} unitMinutes={course.unitMinutes} unitPrice={course.unitPrice} lang={lang}
                                                    onChange={value => setRequestedUnits(current => ({ ...current, [course.id]: value }))} />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                        );
                    }))}

                    {step === 2 && (
                        <EnrollmentStartDates options={startOptions} value={startIso} onChange={iso => { setStartIso(iso); setNudge(false); }}
                            lang={lang} copy={copy} courses={selectedCourses} labelledBy="reg-step-title" referenceYear={referenceYear}
                            emptyText={isTrial ? copy.start.none_trial : copy.start.none} />
                    )}

                    {step === 3 && (
                        <div className="reg-form">
                            <div className="reg-form__row">
                                <TextField id="reg-first-name" label={copy.fields.first_name} autoComplete="given-name" error={errors?.firstName?.message} {...register("personal.firstName")} />
                                <TextField id="reg-last-name" label={copy.fields.last_name} autoComplete="family-name" error={errors?.lastName?.message} {...register("personal.lastName")} />
                            </div>
                            <TextField id="reg-email" type="email" inputMode="email" autoComplete="email" spellCheck={false} label={copy.fields.email}
                                hint={copy.fields.email_hint} error={errors?.email?.message} {...register("personal.email")} />
                            <Controller control={control} name="personal.phone" render={({ field, fieldState }) => (
                                <PhoneField id="reg-phone" label={copy.fields.phone} hint={copy.fields.phone_hint} countryCodeLabel={copy.fields.country_code}
                                    value={field.value} onChange={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} />
                            )} />
                            <Controller control={control} name="personal.birthDate" render={({ field, fieldState }) => (
                                <BirthDateField id="reg-birth-date" legend={copy.fields.birth_date} hint={copy.fields.birth_hint}
                                    labels={{ day: copy.fields.day, month: copy.fields.month, year: copy.fields.year }}
                                    value={field.value} onChange={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} />
                            )} />
                            <TextField id="reg-street" autoComplete="address-line1" label={copy.fields.street} hint={copy.fields.street_hint}
                                error={errors?.street?.message} {...register("personal.street")} />
                            <div className="reg-form__row reg-form__row--place">
                                <TextField id="reg-zip" inputMode="numeric" autoComplete="postal-code" maxLength={5} label={copy.fields.zip} hint={copy.fields.zip_hint}
                                    error={errors?.zip?.message} {...register("personal.zip")} />
                                <TextField id="reg-city" autoComplete="address-level2" label={copy.fields.city} hint={copy.fields.city_hint}
                                    error={errors?.city?.message} {...register("personal.city")} />
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="reg-review">
                            <section className="reg-panel" aria-labelledby="reg-review-courses">
                                <h2 id="reg-review-courses" className="reg-panel__title">{isTrial ? copy.review.trial_title : copy.review.courses_title}</h2>
                                <ul className="reg-review__courses">
                                    {selectedCourses.map(course => (
                                        <li key={course.id}>
                                            <strong>{courseText(course, lang).title}</strong>
                                            {course.category === "private" && <span>{formatCourseQuantity(requestedUnits[course.id] ?? 1, course.unitMinutes, lang)}</span>}
                                        </li>
                                    ))}
                                </ul>
                                <p className="reg-review__start"><CalendarDays size={22} aria-hidden="true" />
                                    {isTrial ? fill(copy.costs.trial_date, { date: startLabel }) : fill(copy.review.start, { date: startLabel })}</p>
                                <div className="reg-review__actions">
                                    <button type="button" className="reg-button reg-button--soft" onClick={() => goTo(1)}>{isTrial ? copy.review.change_course_trial : copy.review.change_courses}</button>
                                    <button type="button" className="reg-button reg-button--soft" onClick={() => goTo(2)}>{isTrial ? copy.review.change_date : copy.review.change_start}</button>
                                </div>
                            </section>

                            <section className="reg-panel" aria-labelledby="reg-review-details">
                                <h2 id="reg-review-details" className="reg-panel__title">{copy.review.details_title}</h2>
                                <dl className="reg-review__details">
                                    <div><dt>{copy.review.name}</dt><dd>{personal.firstName} {personal.lastName}</dd></div>
                                    <div><dt>{copy.review.email}</dt><dd>{personal.email}</dd></div>
                                    {personal.phone && <div><dt>{copy.review.phone}</dt><dd>{personal.phone}</dd></div>}
                                    <div><dt>{copy.review.birth_date}</dt><dd>{personal.birthDate}</dd></div>
                                    <div><dt>{copy.review.address}</dt><dd>{personal.street}<br />{personal.zip} {personal.city}</dd></div>
                                </dl>
                                <div className="reg-review__actions">
                                    <button type="button" className="reg-button reg-button--soft" onClick={() => goTo(3)}>{copy.review.change_details}</button>
                                </div>
                            </section>

                            <EnrollmentConsents items={consentItems} values={consents} copy={copy}
                                onChange={(key, value) => { setConsents(current => ({ ...current, [key]: value })); setNudge(false); }}
                                onAcceptAll={() => { setConsents(current => ({ ...current, ...Object.fromEntries(consentItems.map(item => [item.key, true])) })); setNudge(false); }} />

                            {submitFailed && <p role="alert" className="reg-alert"><AlertCircle size={24} aria-hidden="true" /><span>{copy.submit_failed}</span></p>}
                        </div>
                    )}
                </div>

                {/* Phone: costs, then the action bar at the bottom of the screen. Desktop: both side by side with the question, always in view. */}
                <div className="reg-side">
                    {selectedCourses.length > 0 && (
                        <aside className="reg-costs" aria-labelledby="reg-costs-title">
                            {isTrial
                                ? <EnrollmentTrialCosts copy={copy} dateLabel={startLabel || undefined} />
                                : <EnrollmentCosts courses={selectedCourses} selections={courseSelections} startIso={costStart} startChosen={Boolean(startIso)}
                                    exceptions={exceptions} lang={lang} copy={copy} agbHref={`/${lang}/agb`} referenceYear={referenceYear} />}
                        </aside>
                    )}

                    {/* Always in reach, so nobody has to guess that "Weiter" is further down. */}
                    <div className="reg-nav" data-ready={blocker ? undefined : "true"}>
                        <div aria-live="polite" className="reg-nav__live">
                            {navMessage && (
                                <p id="reg-nav-hint" className="reg-nav__hint" data-nudge={nudge || (step === 3 && detailsInvalid) ? "true" : undefined}>
                                    <Info size={22} aria-hidden="true" /><span>{navMessage}</span>
                                </p>
                            )}
                        </div>
                        {summary && (
                            <p key={`${step}-${summary.label}-${summary.value ?? ""}`} className="reg-nav__summary">
                                <span className="reg-nav__summary-icon" aria-hidden="true">{SummaryIcon && <SummaryIcon size={18} strokeWidth={2.5} />}</span>
                                <span className="reg-nav__summary-label">{summary.label}</span>
                                {summary.value && <span className="reg-nav__summary-value">{summary.value}</span>}
                            </p>
                        )}
                        <div className="reg-nav__buttons">
                            {step > 1 && (
                                <button type="button" className="reg-button reg-button--soft reg-nav__back" onClick={() => goTo((step - 1) as Step)} disabled={submitting}>
                                    <ArrowLeft size={22} aria-hidden="true" />{copy.nav.back}
                                </button>
                            )}
                            <button type="submit" className="reg-button reg-button--primary reg-nav__next" disabled={submitting || checking}
                                aria-disabled={blocker ? true : undefined} aria-describedby={navMessage ? "reg-nav-hint" : undefined}>
                                {step < 4
                                    ? <>{checking && <Loader2 size={22} className="animate-spin" aria-hidden="true" />}{checking ? copy.nav.checking : copy.nav.next}{!checking && <span className="reg-nav__arrow" aria-hidden="true"><ArrowRight size={22} /></span>}</>
                                    : submitting
                                        ? <><Loader2 size={22} className="animate-spin" aria-hidden="true" />{copy.nav.sending}</>
                                        : <>{isTrial ? copy.nav.submit_trial : copy.nav.submit}<span className="reg-nav__arrow" aria-hidden="true"><Send size={20} /></span></>}
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
}
