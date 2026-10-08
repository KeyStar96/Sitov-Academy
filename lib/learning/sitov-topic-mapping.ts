/** Content metadata only. No access grants, scores, unlocks or client-selected URLs. */
export type SitovMappedLevel = 'A1.1' | 'A1.2'
export type SitovPathSourceTarget = {
  kind: 'path_node_source'; level: SitovMappedLevel; pathSourceId: string;
  nodeSourceId: string; evidence: string;
}
export type SitovTopicTarget =
  | { kind: 'vocabulary_card'; id: string; level: SitovMappedLevel; unitId: string; evidence: string }
  | { kind: 'verb'; id: string; level: SitovMappedLevel; tense: 'present'; evidence: string }
  | { kind: 'reading_text'; id: string; level: SitovMappedLevel; evidence: string }
export type SitovTopicMapping = {
  topicId: string; competencyId: string; level: SitovMappedLevel;
  anchors: readonly SitovPathSourceTarget[]; targets: readonly SitovTopicTarget[];
}
export const SITOV_TOPIC_MAPPING_VERSION = 1 as const
// Seed source IDs are level-qualified; DB UUIDs must be resolved from stored rows.
// Samples only: missing topics do not imply missing learner rights or competence.
export const SITOV_TOPIC_MAPPING: readonly SitovTopicMapping[] = [
  {
    "topicId": "sitov.topic.kennenlernen",
    "competencyId": "sitov.competency.kennenlernen",
    "level": "A1.1",
    "anchors": [
      {
        "kind": "path_node_source",
        "level": "A1.1",
        "pathSourceId": "P1",
        "nodeSourceId": "P1-N3",
        "evidence": "Wie heißen Sie?"
      },
      {
        "kind": "path_node_source",
        "level": "A1.1",
        "pathSourceId": "P1",
        "nodeSourceId": "P1-N5",
        "evidence": "Woher kommen Sie?"
      }
    ],
    "targets": [
      {
        "kind": "vocabulary_card",
        "id": "8d77bdb5-5ef5-47cc-805d-549d3f8ae059",
        "level": "A1.1",
        "unitId": "8c0421f2-8842-4779-a4f3-7f56d09df791",
        "evidence": "heißen"
      },
      {
        "kind": "vocabulary_card",
        "id": "59ffe0cf-f9c7-455a-b086-54153690cbce",
        "level": "A1.1",
        "unitId": "8c0421f2-8842-4779-a4f3-7f56d09df791",
        "evidence": "kommen"
      },
      {
        "kind": "verb",
        "id": "sitov-verb-heissen",
        "level": "A1.1",
        "evidence": "heißen",
        "tense": "present"
      },
      {
        "kind": "verb",
        "id": "sitov-verb-kommen",
        "level": "A1.1",
        "evidence": "kommen",
        "tense": "present"
      },
      {
        "kind": "reading_text",
        "id": "6d2f8e95-6f87-510b-b244-0631733f8ff9",
        "level": "A1.1",
        "evidence": "Guten Tag, das bin ich"
      }
    ]
  },
  {
    "topicId": "sitov.topic.familie",
    "competencyId": "sitov.competency.familie",
    "level": "A1.1",
    "anchors": [
      {
        "kind": "path_node_source",
        "level": "A1.1",
        "pathSourceId": "P2",
        "nodeSourceId": "P2-N2",
        "evidence": "Das ist meine Familie"
      },
      {
        "kind": "path_node_source",
        "level": "A1.1",
        "pathSourceId": "P2",
        "nodeSourceId": "P2-N3",
        "evidence": "Familie vorstellen"
      }
    ],
    "targets": [
      {
        "kind": "vocabulary_card",
        "id": "783ae71e-625c-4e93-be93-dfce4c68a9ce",
        "level": "A1.1",
        "unitId": "0cd49e0d-4acb-4a30-aab2-2da45e8f280e",
        "evidence": "Vater"
      },
      {
        "kind": "vocabulary_card",
        "id": "e8bd8ae2-01bf-4061-bf77-3fec92e0c289",
        "level": "A1.1",
        "unitId": "0cd49e0d-4acb-4a30-aab2-2da45e8f280e",
        "evidence": "Bruder"
      },
      {
        "kind": "reading_text",
        "id": "610e3f81-2a6f-5794-bb78-ef06cb7ece17",
        "level": "A1.1",
        "evidence": "Meine Familie"
      }
    ]
  },
  {
    "topicId": "sitov.topic.nominativ",
    "competencyId": "sitov.competency.nominativ",
    "level": "A1.1",
    "anchors": [
      {
        "kind": "path_node_source",
        "level": "A1.1",
        "pathSourceId": "P4",
        "nodeSourceId": "P4-N1",
        "evidence": "Der, das, die"
      },
      {
        "kind": "path_node_source",
        "level": "A1.1",
        "pathSourceId": "P4",
        "nodeSourceId": "P4-N7",
        "evidence": "Hier, dort und Rückfragen"
      }
    ],
    "targets": [
      {
        "kind": "vocabulary_card",
        "id": "e3075a56-06c6-446c-8fcd-401de8791593",
        "level": "A1.1",
        "unitId": "b86f5303-a341-47cc-aeca-487c6eebcf59",
        "evidence": "Tisch"
      },
      {
        "kind": "vocabulary_card",
        "id": "2bf934c3-8cd0-441b-96cf-9f49811242e5",
        "level": "A1.1",
        "unitId": "b86f5303-a341-47cc-aeca-487c6eebcf59",
        "evidence": "Stuhl"
      },
      {
        "kind": "reading_text",
        "id": "a218b88e-9369-5472-b5fe-34c99d1ced76",
        "level": "A1.1",
        "evidence": "Mein Zimmer"
      }
    ]
  },
  {
    "topicId": "sitov.topic.trennbare-verben",
    "competencyId": "sitov.competency.trennbare-verben",
    "level": "A1.1",
    "anchors": [
      {
        "kind": "path_node_source",
        "level": "A1.1",
        "pathSourceId": "P5",
        "nodeSourceId": "P5-N3",
        "evidence": "Trennbare Verben"
      }
    ],
    "targets": [
      {
        "kind": "vocabulary_card",
        "id": "f0404659-e233-499e-b758-eca8a88668d6",
        "level": "A1.1",
        "unitId": "a1a71a1e-05b5-4f43-8ad8-3e2e343f4ca2",
        "evidence": "einkaufen"
      },
      {
        "kind": "verb",
        "id": "sitov-verb-einkaufen",
        "level": "A1.1",
        "evidence": "einkaufen",
        "tense": "present"
      },
      {
        "kind": "reading_text",
        "id": "c8055fa7-7bb0-5027-9f3e-13d001eb728b",
        "level": "A1.1",
        "evidence": "Der Weg zum Kurs"
      }
    ]
  },
  {
    "topicId": "sitov.topic.akkusativ",
    "competencyId": "sitov.competency.akkusativ",
    "level": "A1.1",
    "anchors": [
      {
        "kind": "path_node_source",
        "level": "A1.1",
        "pathSourceId": "P6",
        "nodeSourceId": "P6-N3",
        "evidence": "Akkusativ: den, das, die"
      },
      {
        "kind": "path_node_source",
        "level": "A1.1",
        "pathSourceId": "P6",
        "nodeSourceId": "P6-N4",
        "evidence": "Akkusativ: einen, ein, eine"
      },
      {
        "kind": "path_node_source",
        "level": "A1.1",
        "pathSourceId": "P6",
        "nodeSourceId": "P6-N5",
        "evidence": "Akkusativ: keinen, kein, keine"
      }
    ],
    "targets": [
      {
        "kind": "vocabulary_card",
        "id": "dfa3029b-0202-427f-93d9-1d756e470202",
        "level": "A1.1",
        "unitId": "a1a71a1e-05b5-4f43-8ad8-3e2e343f4ca2",
        "evidence": "Apfel"
      },
      {
        "kind": "vocabulary_card",
        "id": "e183c8a4-e15a-40ad-b97d-1dccd79f5cc5",
        "level": "A1.1",
        "unitId": "a1a71a1e-05b5-4f43-8ad8-3e2e343f4ca2",
        "evidence": "Brot"
      },
      {
        "kind": "reading_text",
        "id": "d7280df2-9f87-5729-bd8f-19c9b47c9488",
        "level": "A1.1",
        "evidence": "Mein Frühstück"
      }
    ]
  },
  {
    "topicId": "sitov.topic.zeit",
    "competencyId": "sitov.competency.zeit",
    "level": "A1.2",
    "anchors": [
      {
        "kind": "path_node_source",
        "level": "A1.2",
        "pathSourceId": "P1",
        "nodeSourceId": "P1-N6",
        "evidence": "vor und seit"
      },
      {
        "kind": "path_node_source",
        "level": "A1.2",
        "pathSourceId": "P1",
        "nodeSourceId": "P1-N7",
        "evidence": "Für wie lange?"
      }
    ],
    "targets": [
      {
        "kind": "vocabulary_card",
        "id": "40aacb5b-2074-591d-bb88-c2cc5fec6955",
        "level": "A1.2",
        "unitId": "dcbca5c7-2c18-52bb-9e3c-80900101262e",
        "evidence": "seit"
      },
      {
        "kind": "reading_text",
        "id": "1b5c02d4-7217-56e0-8abb-906c20784e30",
        "level": "A1.2",
        "evidence": "Ein Termin beim Arzt"
      }
    ]
  },
  {
    "topicId": "sitov.topic.modalverben",
    "competencyId": "sitov.competency.modalverben",
    "level": "A1.2",
    "anchors": [
      {
        "kind": "path_node_source",
        "level": "A1.2",
        "pathSourceId": "P2",
        "nodeSourceId": "P2-N2",
        "evidence": "müssen"
      },
      {
        "kind": "path_node_source",
        "level": "A1.2",
        "pathSourceId": "P2",
        "nodeSourceId": "P2-N3",
        "evidence": "dürfen"
      },
      {
        "kind": "path_node_source",
        "level": "A1.2",
        "pathSourceId": "P2",
        "nodeSourceId": "P2-N4",
        "evidence": "Modalverb und Infinitiv"
      }
    ],
    "targets": [
      {
        "kind": "vocabulary_card",
        "id": "3d190973-ada7-562e-9f9e-77a6be4a3331",
        "level": "A1.2",
        "unitId": "db2957ca-55e2-570b-aba6-c693d232b4b8",
        "evidence": "müssen"
      },
      {
        "kind": "verb",
        "id": "sitov-verb-muessen",
        "level": "A1.2",
        "evidence": "müssen",
        "tense": "present"
      },
      {
        "kind": "verb",
        "id": "sitov-verb-duerfen",
        "level": "A1.2",
        "evidence": "dürfen",
        "tense": "present"
      },
      {
        "kind": "reading_text",
        "id": "00cedd4e-cf66-50ae-a181-e687d85a8379",
        "level": "A1.2",
        "evidence": "Wir müssen früh aufstehen und die Taschen packen."
      },
      {
        "kind": "reading_text",
        "id": "0022c931-279a-5050-ac2d-459c1e978cd1",
        "level": "A1.2",
        "evidence": "Das Buch darf ich vier Wochen behalten."
      }
    ]
  }
]

export type SitovTopicCatalog = {
  nodes: readonly { level: SitovMappedLevel; pathSourceId: string; nodeSourceId: string }[];
  targets: readonly { kind: SitovTopicTarget['kind']; id: string; level: SitovMappedLevel; unitId?: string }[];
}
/** Validate against an authoritative catalog, never against learner-supplied IDs. */
export function validateSitovTopicMapping(mapping: readonly SitovTopicMapping[], catalog: SitovTopicCatalog): string[] {
  const errors: string[] = []
  const topicIds = new Set<string>()
  const competencies = new Set<string>()
  for (const topic of mapping) {
    if (!/^sitov\.topic\.[a-z0-9-]+$/.test(topic.topicId) || topicIds.has(topic.topicId)) errors.push(`topic:${topic.topicId}`)
    if (!/^sitov\.competency\.[a-z0-9-]+$/.test(topic.competencyId) || competencies.has(topic.competencyId)) errors.push(`competency:${topic.competencyId}`)
    topicIds.add(topic.topicId); competencies.add(topic.competencyId)
    if (!topic.anchors.length || !topic.targets.length) errors.push(`empty:${topic.topicId}`)
    const seen = new Set<string>()
    for (const anchor of topic.anchors) {
      const key = `${anchor.level}/${anchor.pathSourceId}/${anchor.nodeSourceId}`
      if (anchor.level !== topic.level || seen.has(key) || !catalog.nodes.some(n => n.level === anchor.level && n.pathSourceId === anchor.pathSourceId && n.nodeSourceId === anchor.nodeSourceId)) errors.push(`anchor:${key}`)
      seen.add(key)
    }
    for (const target of topic.targets) {
      const key = `${target.kind}/${target.id}`
      const matched = catalog.targets.find(t => t.kind === target.kind && t.id === target.id && t.level === target.level)
      if (seen.has(key) || target.level !== topic.level || !matched || (target.kind === 'vocabulary_card' && matched.unitId !== target.unitId)) errors.push(`target:${key}`)
      seen.add(key)
    }
  }
  return errors
}
