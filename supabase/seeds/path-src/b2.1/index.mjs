import p1 from './p1.mjs'
import p1Check from './p1-check.mjs'

/** A path = its lessons (pN.mjs) followed by one review and one test (pN-check.mjs). */
const path = (lessons, check) => ({
  ...lessons,
  nodes: [...lessons.nodes, { kind: 'review', ex: check.review }, { kind: 'test', size: check.size, ex: check.test }],
})

/** Lernpfad B2.1: sechs Pfade nach den Grammatikzielen der Module 1–6. */
const paths = [
  path(p1, p1Check),
]

export default paths
