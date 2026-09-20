/** @jest-environment node */
jest.mock('next/headers', () => ({ headers: jest.fn() }))
import { headers } from 'next/headers'
import { getClientIp, parseTrustedClientIp } from '@/lib/client-ip'

it('skips the Traefik suffix and ignores attacker-controlled prefixes', () => {
  const client = '198.51.100.23', proxy = '10.0.2.5'
  for (const prefix of ['', '1.2.3.4, ', 'garbage, , 1.2.3.4, ']) {
    expect(parseTrustedClientIp(`${prefix}${client}, ${proxy}`, '1')).toBe(client)
  }
  expect(parseTrustedClientIp(`203.0.113.9, ${proxy}`, '1')).toBe('203.0.113.9')
})
it.each([undefined, '', '0', '-1', '2', '1x', '1.5', '01'])('rejects an unsupported hop configuration %s', hops => {
  expect(parseTrustedClientIp('198.51.100.23, 10.0.2.5', hops)).toBe('unknown')
})
it.each([null, '', '1.2.3.4', '1.2.3.4,', ',10.0.2.5', 'bad, 10.0.2.5', '1.2.3.4, bad', '198.51.100.23:1234, 10.0.2.5'])('fails closed for an invalid trusted suffix %s', value => {
  expect(parseTrustedClientIp(value, '1')).toBe('unknown')
})
it('normalizes IPv6 and IPv4-mapped IPv6 buckets', () => {
  expect(parseTrustedClientIp('2001:0DB8:0:0:0:0:0:1, 10.0.2.5', '1')).toBe('2001:db8::1')
  expect(parseTrustedClientIp('::ffff:192.0.2.1, 10.0.2.5', '1')).toBe('192.0.2.1')
  expect(parseTrustedClientIp('::ffff:c000:201, 10.0.2.5', '1')).toBe('192.0.2.1')
})
it('does not leak header lookup errors', async () => {
  jest.mocked(headers).mockRejectedValue(new Error('private@example.test'))
  const log = jest.spyOn(console, 'error').mockImplementation(() => {})
  try {
    expect(await getClientIp()).toBe('unknown')
    expect(log).toHaveBeenCalledWith('[client-ip] lookup_failed')
  } finally { log.mockRestore() }
})
