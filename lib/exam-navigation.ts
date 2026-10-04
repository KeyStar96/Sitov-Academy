/** Exam instructions and the surrounding navigation stay in German, regardless of the saved UI language. */
export function isSitovExamPath(pathname: string): boolean {
  return /\/(?:dashboard|sitov-preview)\/exam-(?:preparation|simulation)(?:\/|$|\?)/.test(pathname)
}
