'use server'
import { performSitovSpecialOperation } from '@/lib/learning/sitov-learning-specials-server'
export async function runSitovLearningSpecial(input:unknown){return performSitovSpecialOperation(input)}
export async function getSitovLearningSpecialStaff(input:unknown){
 const {loadSitovSpecialStaffCatalog}=await import('@/lib/learning/sitov-learning-specials-staff-server')
 return loadSitovSpecialStaffCatalog(input)
}
