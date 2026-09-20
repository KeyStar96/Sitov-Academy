'use server'
/** Eligibility is checked atomically at submission; do not expose person records through a public lookup. This is only a hint for the UI. */
export async function trialEligibilityHint(_email:string,_firstName:string,_lastName:string):Promise<{eligible:boolean}> {return {eligible:true}}
