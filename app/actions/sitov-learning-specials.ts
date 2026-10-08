'use server'
import { performSitovSpecialOperation } from '@/lib/learning/sitov-learning-specials-server'
export async function runSitovLearningSpecial(input:unknown){return performSitovSpecialOperation(input)}
