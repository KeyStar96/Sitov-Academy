import { learningResourceUrl, videoInputSchema, youtubeWatchUrl } from '@/lib/video-links'

describe('YouTube learning links', () => {
  it.each(['https://youtu.be/abcdefghijk?si=tracking','https://www.youtube.com/watch?v=abcdefghijk&list=tracking','https://m.youtube.com/shorts/abcdefghijk','https://youtube.com/embed/abcdefghijk'])('canonicalizes %s without loading an embed', input => {
    expect(youtubeWatchUrl(input)).toBe('https://www.youtube.com/watch?v=abcdefghijk')
  })
  it.each(['javascript:alert(1)','http://youtube.com/watch?v=abcdefghijk','https://youtube.com.evil.invalid/watch?v=abcdefghijk','https://youtube.com@evil.invalid/watch?v=abcdefghijk','https://user:password@youtube.com/watch?v=abcdefghijk','https://youtube.com/redirect?q=https://evil.invalid','https://youtu.be/short','https://youtu.be/abcdefghijk/extra','https://youtube.com:8080/watch?v=abcdefghijk'])('rejects %s', input => {
    expect(youtubeWatchUrl(input)).toBeNull()
  })
  it('requires a supported course level and a real watch URL before teacher publication', () => {
    const input={level:'A1.1',title:'Begrüßung',description:'',source_url:'https://youtu.be/abcdefghijk',is_active:true}
    expect(videoInputSchema.safeParse(input).success).toBe(true)
    expect(videoInputSchema.safeParse({...input,level:'C9'}).success).toBe(false)
    expect(videoInputSchema.safeParse({...input,source_url:'javascript:alert(1)'}).success).toBe(false)
    expect(videoInputSchema.safeParse({...input,source_url:''}).success).toBe(false)
    expect(videoInputSchema.parse({...input,source_url:'',is_active:false}).source_url).toBeNull()
  })
})

it('preserves real non-YouTube learning resources while rejecting credentialed or executable links', () => {
  const dw = 'https://learngerman.dw.com/de/wie-heißt-du/l-37250532'
  expect(learningResourceUrl(dw)).toBe(dw)
  expect(learningResourceUrl('https://youtu.be/abcdefghijk?si=x')).toBe('https://www.youtube.com/watch?v=abcdefghijk')
  for (const url of ['javascript:alert(1)', 'data:text/html,Hi', 'https://user:pass@example.org/video', 'https://example.org/with space']) expect(learningResourceUrl(url)).toBeNull()
})
