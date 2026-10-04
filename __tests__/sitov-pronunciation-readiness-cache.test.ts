/** @jest-environment node */
jest.mock('server-only', () => ({}), { virtual: true })
// Exercise cache() in a real Server Component render, where React owns the
// request lifetime. Plain Jest calls intentionally do not memoize cache().
jest.mock('react', () => jest.requireActual('next/dist/compiled/react/react.react-server'))
jest.mock('next/dist/compiled/react', () => jest.requireActual('next/dist/compiled/react/react.react-server'))
jest.mock('react-dom', () => jest.requireActual('next/dist/compiled/react-dom/react-dom.react-server'))

import { createElement } from 'react'
import { loadSitovPronunciationReadiness } from '@/lib/sitov-pronunciation-readiness-server'
import { SITOV_PRONUNCIATION_REQUIREMENTS } from '@/lib/sitov-pronunciation-readiness'

const { renderToReadableStream } = jest.requireActual('next/dist/compiled/react-server-dom-webpack/server.node')
const readiness = {level:'A1.1',mode:'logical',tier:0,texts:[],requirements:SITOV_PRONUNCIATION_REQUIREMENTS,
 stats:{knownWords:0,grammarNodes:0,passedTests:0,legacyGrammarExercises:0,legacyGrammarTopics:0,confidentVerbForms:0,verbEvidenceRequired:false}}

async function serverRender(work: () => Promise<void>) {
 async function EvidenceReader() { await work(); return null }
 const stream=await renderToReadableStream(createElement(EvidenceReader as never),{})
 const reader=stream.getReader()
 while (!(await reader.read()).done) { /* Complete this server request. */ }
}

test('shares evidence between consumers in one render but refreshes it for the next request',async () => {
 const rpc=jest.fn().mockResolvedValue({data:readiness,error:null})
 const client={rpc} as never
 const read=async () => {await Promise.all([loadSitovPronunciationReadiness(client,'A1.1'),loadSitovPronunciationReadiness(client,'A1.1'),loadSitovPronunciationReadiness(client,'A1.1',undefined)])}
 await serverRender(read)
 expect(rpc).toHaveBeenCalledTimes(1)
 await serverRender(read)
 expect(rpc).toHaveBeenCalledTimes(2)
})

test('never shares one client, level or student evidence with another',async () => {
 const rpc=jest.fn().mockResolvedValue({data:readiness,error:null})
 const otherRpc=jest.fn().mockResolvedValue({data:readiness,error:null})
 const client={rpc} as never, otherClient={rpc:otherRpc} as never
 await serverRender(async () => {await Promise.all([
  loadSitovPronunciationReadiness(client,'A1.1'),loadSitovPronunciationReadiness(client,'A1.2'),
  loadSitovPronunciationReadiness(client,'A1.1','00000000-0000-4000-8000-000000000001'),
  loadSitovPronunciationReadiness(otherClient,'A1.1'),
 ])})
 expect(rpc).toHaveBeenCalledTimes(3)
 expect(otherRpc).toHaveBeenCalledTimes(1)
})
