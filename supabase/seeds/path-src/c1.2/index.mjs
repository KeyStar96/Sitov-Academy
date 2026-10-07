import p1 from './p1.mjs'
import p1Check from './p1-check.mjs'
import p2 from './p2.mjs'
import p2Check from './p2-check.mjs'
import p3 from './p3.mjs'
import p3Check from './p3-check.mjs'
import p4 from './p4.mjs'
import p4Check from './p4-check.mjs'
import p5 from './p5.mjs'
import p5Check from './p5-check.mjs'

/** A path = its lessons (pN.mjs) followed by one review and one test (pN-check.mjs). */
const path = (lessons, check) => ({
  ...lessons,
  nodes: [...lessons.nodes, { kind: 'review', ex: check.review }, { kind: 'test', size: check.size, ex: check.test }],
})

/** Lernpfad C1.2: sechs Pfade nach den Grammatikzielen der Module 1–6. */
const paths = [
  path(p1, p1Check),
  path(p2, p2Check),
  path(p3, p3Check),
  path(p4, p4Check),
  path(p5, p5Check),
]

export default paths
