import { signupSchema } from '@/lib/types/auth'
import { personalDetailsSchema } from '@/lib/types/profile'
import { localeFromNativeLanguage } from '@/lib/locale-routing'
import { createProfileTranslator, translateNativeLanguage } from '@/lib/profile-i18n'
import de from '@/dictionaries/de.json'

const signup = { display_name: 'Anna', email: 'anna@example.invalid', password: 'CorrectPass123' }
it.each(['de','en','ru','uk','tr'])('uses the same ISO language code for signup and locale %s', language => {
 expect(signupSchema.parse({ ...signup, native_language: language }).native_language).toBe(language)
 expect(localeFromNativeLanguage(language)).toBe(language)
})
it('rejects display labels and legacy aliases as persistent language values', () => {
 for (const value of ['Deutsch','Russisch','Andere','german']) expect(signupSchema.safeParse({ ...signup, native_language: value }).success).toBe(false)
 expect(signupSchema.safeParse({ ...signup, native_language: null }).success).toBe(false)
})
it('translates ISO language labels and keeps unknown values unspecified', () => {
 const t=createProfileTranslator(de.profile)
 expect(translateNativeLanguage(t,'ru')).toBe(de.profile.lang_russian)
 expect(translateNativeLanguage(t,null)).toBe(de.profile.not_specified)
})
it('accepts canonical person fields and rejects old flattened profile aliases', () => {
 const person={display_name:'Anna',email:'anna@example.invalid',phone:null,street:null,postal_code:'00123',city:null,lang:'de'}
 expect(personalDetailsSchema.parse(person).postal_code).toBe('00123')
 expect(personalDetailsSchema.safeParse({...person,name:'Wrong alias'}).success).toBe(false)
 expect(personalDetailsSchema.safeParse({...person,zip_code:'99999'}).success).toBe(false)
})
