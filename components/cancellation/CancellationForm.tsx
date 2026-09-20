"use client";

import Link from "next/link";

import React, { useState, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { createCancellationSchema, CancellationFormData } from "@/lib/cancellation-schema";
import { submitCancellation } from "@/app/actions/submit-cancellation";
import { getEarliestCancellationDate } from "@/lib/cancellation-utils";
import { DateDropdowns } from "@/components/ui/DateDropdowns";

interface CancellationFormProps {
    dictionary: any;
    lang: string;
    courses: { id: string; title: string }[];
}

export default function CancellationForm({ dictionary, lang, courses }: CancellationFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);

    const t = dictionary.cancellation;

    const {
        register,
        handleSubmit,
        watch,
        control,
        formState: { errors, isValid, isValidating },
    } = useForm<CancellationFormData>({
        resolver: zodResolver(createCancellationSchema(dictionary)),
        defaultValues: {
            terminationDate: "asap"
        },
        mode: "onChange"
    });

    const terminationDateValue = watch("terminationDate");

    const minDate = useMemo(() => {
        return getEarliestCancellationDate();
    }, []);

    const [isAnimationComplete, setIsAnimationComplete] = useState(false);

    React.useEffect(() => {
        if (terminationDateValue !== "specific_date") {
            setIsAnimationComplete(false);
        }
    }, [terminationDateValue]);

    const onSubmit = async (data: CancellationFormData) => {
        setIsSubmitting(true);
        setServerError(null);
        try {
            const result = await submitCancellation(data, lang);
            if (result.success) {
                setIsSuccess(true);
            } else {
                setServerError(result.message || t.errors.generic_error);
            }
        } catch (error) {
            setServerError(t.errors.generic_error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSuccess) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-12 text-center"
            >
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    {t.success.title}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-md mb-8">
                    {t.success.message}
                </p>
                <Link href={`/${lang}`} className="bg-[#FF5C00] text-white px-8 py-4 rounded font-bold uppercase tracking-widest hover:bg-[#FF7A33] transition-colors">
                    {t.back_home}
                </Link>
            </motion.div>
        );
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            {/* Server Error */}
            {serverError && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md flex items-center gap-3 text-red-700 dark:text-red-300 text-sm">
                    <AlertCircle size={16} />
                    <span>{serverError}</span>
                </div>
            )}

            {/* Full Name */}
            <div className="space-y-2">
                <div className="relative group">
                    <input
                        {...register("fullName")}
                        id="fullName"
                        placeholder=" "
                        className={cn(
                            "block w-full bg-transparent border-b border-gray-500 dark:border-white/10 py-3 text-lg font-sans text-gray-900 dark:text-white focus:outline-none focus:border-[#FF5C00] dark:focus:border-[#FF5C00] transition-colors peer placeholder-transparent",
                            errors.fullName && "border-red-500 dark:border-red-400"
                        )}
                    />
                    <label
                        htmlFor="fullName"
                        className={cn(
                            "absolute left-0 top-0 text-xs font-mono uppercase tracking-widest text-gray-600 dark:text-gray-400 transition-all pointer-events-none",
                            "peer-placeholder-shown:top-3 peer-placeholder-shown:text-lg peer-placeholder-shown:normal-case peer-placeholder-shown:font-sans peer-placeholder-shown:text-gray-500",
                            "peer-focus:top-0 peer-focus:text-xs peer-focus:uppercase peer-focus:tracking-widest peer-focus:text-[#FF5C00]"
                        )}
                    >
                        {t.form.full_name} <span className="text-[#FF5C00]">*</span>
                    </label>
                    {errors.fullName && (
                        <span className="text-red-500 text-xs mt-1 block font-mono">{errors.fullName.message}</span>
                    )}
                </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
                <div className="relative group">
                    <input
                        {...register("email")}
                        id="email"
                        type="email"
                        placeholder=" "
                        className={cn(
                            "block w-full bg-transparent border-b border-gray-500 dark:border-white/10 py-3 text-lg font-sans text-gray-900 dark:text-white focus:outline-none focus:border-[#FF5C00] dark:focus:border-[#FF5C00] transition-colors peer placeholder-transparent",
                            errors.email && "border-red-500 dark:border-red-400"
                        )}
                    />
                    <label
                        htmlFor="email"
                        className={cn(
                            "absolute left-0 top-0 text-xs font-mono uppercase tracking-widest text-gray-600 dark:text-gray-400 transition-all pointer-events-none",
                            "peer-placeholder-shown:top-3 peer-placeholder-shown:text-lg peer-placeholder-shown:normal-case peer-placeholder-shown:font-sans peer-placeholder-shown:text-gray-500",
                            "peer-focus:top-0 peer-focus:text-xs peer-focus:uppercase peer-focus:tracking-widest peer-focus:text-[#FF5C00]"
                        )}
                    >
                        {t.form.email} <span className="text-[#FF5C00]">*</span>
                    </label>
                    {errors.email && (
                        <span className="text-red-500 text-xs mt-1 block font-mono">{errors.email.message}</span>
                    )}
                </div>
            </div>

            {/* Course reference (optional) */}
            <div className="space-y-2">
                <div className="space-y-1">
                    <label htmlFor="courseId" className="block text-xs font-mono uppercase tracking-widest text-gray-600 dark:text-gray-400">
                        {t.form.course_name}
                    </label>
                    <select {...register("courseId")} id="courseId" defaultValue=""
                        className="block w-full bg-transparent border-b border-gray-500 dark:border-white/10 py-3 text-lg text-gray-900 dark:text-white focus:outline-none focus:border-[#FF5C00]">
                        <option value="">—</option>
                        {courses.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}
                    </select>
                </div>
            </div>

            {/* Termination Date */}
            <div className="space-y-4 pt-4 relative z-20">
                <span className="block text-xs font-mono uppercase tracking-widest text-gray-600 dark:text-gray-400">
                    {t.form.termination_date_label}
                </span>
                <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer group">
                        <div className="relative flex items-center justify-center w-5 h-5 border border-gray-500 dark:border-white/20 rounded-full transition-colors group-hover:border-[#FF5C00]">
                            <input
                                {...register("terminationDate")}
                                type="radio"
                                value="asap"
                                className="peer appearance-none w-full h-full absolute inset-0 cursor-pointer"
                            />
                            <div className="w-2.5 h-2.5 bg-[#FF5C00] rounded-full scale-0 peer-checked:scale-100 transition-transform" />
                        </div>
                        <span className="text-gray-800 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                            {t.form.asap_option}
                        </span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer group">
                        <div className="relative flex items-center justify-center w-5 h-5 border border-gray-500 dark:border-white/20 rounded-full transition-colors group-hover:border-[#FF5C00]">
                            <input
                                {...register("terminationDate")}
                                type="radio"
                                value="specific_date"
                                className="peer appearance-none w-full h-full absolute inset-0 cursor-pointer"
                            />
                            <div className="w-2.5 h-2.5 bg-[#FF5C00] rounded-full scale-0 peer-checked:scale-100 transition-transform" />
                        </div>
                        <span className="text-gray-800 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                            {t.form.specific_date_option}
                        </span>
                    </label>
                </div>

                <AnimatePresence>
                    {terminationDateValue === "specific_date" && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="overflow-visible"
                        >
                            <div className="pt-2">
                                <Controller
                                    control={control}
                                    name="specificDate"
                                    render={({ field }) => (
                                        <div className="relative z-50">
                                            <DateDropdowns
                                                value={field.value}
                                                onChange={field.onChange}
                                                label={t.form.specific_date_label}
                                                futureYears={true}
                                                minDate={minDate}
                                                error={errors.specificDate?.message}
                                            />
                                        </div>
                                    )}
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Submit Button */}
            <div className="pt-6">
                <button
                    type="submit"
                    disabled={isSubmitting || !isValid || isValidating}
                    className="w-full bg-[#FF5C00] hover:bg-[#E05000] text-white font-bold py-4 rounded-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {isSubmitting || isValidating ? (
                        <>
                            <Loader2 className="animate-spin" size={20} />
                            <span>{isValidating ? "Überprüfe..." : t.form.processing}</span>
                        </>
                    ) : (
                        <span>{t.form.submit_button}</span>
                    )}
                </button>
                <div className="text-center mt-4 space-y-2">
                    <p className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                        {t.required_hint}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed max-w-sm mx-auto">
                        {t.form.disclaimer}
                    </p>
                </div>
            </div>
        </form >
    );
}
