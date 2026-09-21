"use client";

import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { JetBrains_Mono } from "next/font/google";

const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"] });

export const DateDropdowns = ({
    value,
    onChange,
    label,
    error,
    required,
}: any) => {
    const defaultId = React.useId();
    const id = defaultId;
    
    // Local state for the input text
    const [inputValue, setInputValue] = useState(value || "");

    useEffect(() => {
        if (value !== undefined && value !== inputValue) {
            setInputValue(value);
        }
    }, [value]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/\D/g, ''); // Remove all non-digits
        
        // Truncate to maximum 8 digits (DDMMYYYY)
        if (val.length > 8) {
            val = val.slice(0, 8);
        }
        
        // Auto-format as DD.MM.YYYY
        let formatted = val;
        if (val.length >= 3 && val.length <= 4) {
            formatted = `${val.slice(0, 2)}.${val.slice(2)}`;
        } else if (val.length >= 5) {
            formatted = `${val.slice(0, 2)}.${val.slice(2, 4)}.${val.slice(4)}`;
        }

        setInputValue(formatted);
        onChange(formatted);
    };

    return (
        <div className="relative group z-40 w-full">
            <input
                id={id}
                type="text"
                inputMode="numeric"
                value={inputValue}
                onChange={handleInputChange}
                placeholder="DD.MM.YYYY"
                maxLength={10}
                className={cn(
                    "block w-full bg-transparent border-b border-gray-400/30 dark:border-white/20 py-4 pt-6 text-lg font-sans text-gray-900 dark:text-[#E2D7CE] focus:outline-none focus:border-[var(--accent)] dark:focus:border-[var(--accent)] transition-colors peer placeholder-transparent focus:placeholder-gray-400 dark:focus:placeholder-gray-600 autofill:bg-transparent",
                    "[&:-webkit-autofill]:bg-transparent [&:-webkit-autofill]:shadow-[0_0_0_100px_#FCF4E6_inset] dark:[&:-webkit-autofill]:shadow-[0_0_0_100px_#1A1C1E_inset]",
                    "[&:-webkit-autofill]:[-webkit-text-fill-color:#111827] dark:[&:-webkit-autofill]:[-webkit-text-fill-color:#E2D7CE]",
                    error && "border-red-500 dark:border-red-400"
                )}
            />
            <label
                htmlFor={id}
                className={cn(
                    "absolute left-0 top-0 text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400 transition-all pointer-events-none",
                    jetbrainsMono.className,
                    "peer-placeholder-shown:top-5 peer-placeholder-shown:text-lg peer-placeholder-shown:normal-case peer-placeholder-shown:font-sans peer-placeholder-shown:text-gray-500 dark:peer-placeholder-shown:text-gray-500",
                    "peer-focus:top-0 peer-focus:text-xs peer-focus:uppercase peer-focus:tracking-widest peer-focus:text-[var(--accent-text)]"
                )}>
                {label} {required && <span className="text-[var(--accent-text)]">*</span>}
            </label>
            {error && <span className={cn("text-red-500 dark:text-red-400 text-[10px] absolute right-0 top-2", jetbrainsMono.className)}>{error}</span>}
        </div>
    );
};
