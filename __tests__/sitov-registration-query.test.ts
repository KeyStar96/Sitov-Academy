import { sitovRegistrationQuery } from '@/lib/sitov-registration-query'

describe('server-side registration selection', () => {
  it('keeps the regular form as the default', () => {
    expect(sitovRegistrationQuery({})).toEqual({ initialCourseId: undefined, isTrial: false })
  })

  it('preserves a linked course and the free-trial mode before hydration', () => {
    expect(sitovRegistrationQuery({ courseId: 'course-id', trial: '1', utm_source: 'google' }))
      .toEqual({ initialCourseId: 'course-id', isTrial: true })
  })

  it('rejects repeated values and bounded malformed input', () => {
    expect(sitovRegistrationQuery({ courseId: ['first', 'second'], trial: ['1', '0'] }))
      .toEqual({ initialCourseId: undefined, isTrial: false })
    expect(sitovRegistrationQuery({ courseId: 'x'.repeat(201), trial: 'true' }))
      .toEqual({ initialCourseId: undefined, isTrial: false })
  })
})
