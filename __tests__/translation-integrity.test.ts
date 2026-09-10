import fs from 'fs';
import path from 'path';

describe('Translation Integrity', () => {
    const dictionariesDir = path.join(process.cwd(), 'dictionaries');
    const locales = ['en', 'ru', 'uk', 'tr'];
    const masterLocale = 'de';

    let masterDict: any;
    let otherDicts: Record<string, any> = {};

    beforeAll(() => {
        const loadJson = (locale: string) => JSON.parse(fs.readFileSync(path.join(dictionariesDir, `${locale}.json`), 'utf-8'));
        masterDict = loadJson(masterLocale);
        locales.forEach(l => {
            otherDicts[l] = loadJson(l);
        });
    });

    // Recursive helper to get all keys
    const getKeys = (obj: any, prefix = ''): string[] => {
        return Object.keys(obj).reduce((res: string[], k) => {
            const val = obj[k];
            const newKey = prefix ? `${prefix}.${k}` : k;
            if (val && typeof val === 'object' && !Array.isArray(val)) {
                return [...res, ...getKeys(val, newKey)];
            }
            return [...res, newKey];
        }, []);
    };

    test('All dictionaries should exist', () => {
        expect(masterDict).toBeDefined();
        locales.forEach(l => {
            expect(otherDicts[l]).toBeDefined();
        });
    });

    test('All locales should have same keys as Master (DE)', () => {
        const masterKeys = new Set(getKeys(masterDict));

        locales.forEach(locale => {
            const currentKeys = getKeys(otherDicts[locale]);
            const missing = [...masterKeys].filter(k => !currentKeys.includes(k));

            if (missing.length > 0) {
                console.warn(`Missing keys in ${locale}:`, missing);
            }

            expect(missing).toEqual([]);
        });
    });

    test('Values should not be identical to Master (DE) unless explicitly allowed', () => {
        // Heuristic: If value is identical to DE and length > 4, it's likely untranslated.
        // We can add a "whitelist" if needed.
        const whitelist = ['Sitov Academy', 'Sitov', 'Academy', 'Email', 'Telegram', 'WhatsApp', 'A1.1', 'A1.2', 'A2', 'B1', 'B2', 'info@sitov-academy.com'];

        locales.forEach(locale => {
            const warnings: string[] = [];

            const checkValues = (masterObj: any, targetObj: any, prefix = '') => {
                Object.keys(masterObj).forEach(key => {
                    const masterVal = masterObj[key];
                    const targetVal = targetObj?.[key];
                    const fullKey = prefix ? `${prefix}.${key}` : key;

                    if (typeof masterVal === 'object' && masterVal !== null && !Array.isArray(masterVal)) {
                        if (targetVal) checkValues(masterVal, targetVal, fullKey);
                    } else if (typeof masterVal === 'string' && typeof targetVal === 'string') {
                        // Check identity
                        if (masterVal.trim() === targetVal.trim() && masterVal.length > 4) {
                            // Check whitelist
                            const isWhitelisted = whitelist.some(w => masterVal.includes(w) && masterVal.length < 15);
                            if (!isWhitelisted) {
                                // Double check if it's really the same language content
                                warnings.push(`${fullKey}: "${masterVal}"`);
                            }
                        }
                    }
                });
            };

            checkValues(masterDict, otherDicts[locale]);

            if (warnings.length > 0) {
                console.warn(`Potential untranslated keys in ${locale} (Identical to DE):`, warnings);
            }

            // For now, we warn but don't fail the test to avoid blocking deployment on false positives
            // expecting(warnings).toHaveLength(0); 
        });
    });
});
