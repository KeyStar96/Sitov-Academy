'use server'
/** Eligibility is checked atomically at submission; do not expose person records through a public lookup. */
export async function checkTrialEligibility(_email:string,_firstName:string,_lastName:string):Promise<{eligible:boolean}> {return {eligible:true}}
