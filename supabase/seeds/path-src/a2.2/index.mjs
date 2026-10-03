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
import p6 from './p6.mjs'
import p6Check from './p6-check.mjs'
import p7 from './p7.mjs'
import p7Check from './p7-check.mjs'

/** A path = its lessons (pN.mjs) followed by one review and one test (pN-check.mjs). */
const path = (lessons, check) => ({
  ...lessons,
  nodes: [...lessons.nodes, { kind: 'review', ex: check.review }, { kind: 'test', size: check.size, ex: check.test }],
})

/** Lernpfad A2.2: sieben Pfade nach den Lernzielen der Lektionen 8–14. */
const paths = [
  path(p1, p1Check),
  path(p2, p2Check),
  path(p3, p3Check),
  path(p4, p4Check),
  path(p5, p5Check),
  path(p6, p6Check),
  path(p7, p7Check),
]

export default paths
