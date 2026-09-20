import fs from 'fs';
import path from 'path';

describe('Translation Integrity', () => {
    const dictionariesDir = path.join(process.cwd(), 'dictionaries');
    const locales = ['de', 'en', 'ru', 'uk', 'tr'];
    const dictionaries: Record<string, unknown> = {};

    beforeAll(() => {
        locales.forEach(locale => {
            dictionaries[locale] = JSON.parse(fs.readFileSync(path.join(dictionariesDir, `${locale}.json`), 'utf-8'));
        });
    });

    // Lists are translation values: their number of entries can vary by language.
    // Every named object key, including empty objects, remains part of the structure.
    const getStructure = (value: unknown): unknown => {
        if (Array.isArray(value)) return 'array';
        if (value === null) return 'null';
        if (typeof value === 'object') {
            return Object.fromEntries(
                Object.entries(value).map(([key, child]) => [key, getStructure(child)])
            );
        }
        return typeof value;
    };

    test.each(locales)('%s dictionary is a valid JSON object', locale => {
        expect(dictionaries[locale]).not.toBeNull();
        expect(typeof dictionaries[locale]).toBe('object');
        expect(Array.isArray(dictionaries[locale])).toBe(false);
    });

    test.each(['en', 'ru', 'uk', 'tr'])('%s has exactly the German keys and value types', locale => {
        expect(getStructure(dictionaries[locale])).toStrictEqual(getStructure(dictionaries.de));
    });
});
