'use server'
import { performSitovSpecialOperation } from '@/lib/learning/sitov-learning-specials-server'
export async function runSitovLearningSpecial(input:unknown){return performSitovSpecialOperation(input)}
export async function getSitovLearningSpecialStaff(input:unknown){
 const {loadSitovSpecialStaffCatalog}=await import('@/lib/learning/sitov-learning-specials-staff-server')
 return loadSitovSpecialStaffCatalog(input)
}
export async function getSitovLearningSpecialAuthorContext(input:unknown){
 const {loadSitovSpecialAuthorContext}=await import('@/lib/learning/sitov-learning-specials-staff-server')
 return loadSitovSpecialAuthorContext(input)
}
export async function createSitovLearningSpecialDraft(input:unknown){
 const {createSitovSpecialAuthorDraft}=await import('@/lib/learning/sitov-learning-specials-staff-server')
 return createSitovSpecialAuthorDraft(input)
}
export async function getSitovLearningSpecialPublication(input:unknown){
 const {loadSitovSpecialPublicationState}=await import('@/lib/learning/sitov-learning-specials-staff-server')
 return loadSitovSpecialPublicationState(input)
}
export async function publishSitovLearningSpecial(input:unknown){
 const {publishSitovSpecial}=await import('@/lib/learning/sitov-learning-specials-staff-server')
 return publishSitovSpecial(input)
}
