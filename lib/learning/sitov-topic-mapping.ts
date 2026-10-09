import type { AccessLevel } from '@/lib/access/levels'

/** Content metadata only. No access grants, scores, unlocks or client-selected URLs. */
export type SitovMappedLevel = AccessLevel
export type SitovPathSourceTarget = {
  kind: 'path_node_source'; level: SitovMappedLevel; pathSourceId: string;
  nodeSourceId: string; evidence: string;
}
export type SitovSpecialSourceTarget = {
  kind: 'path_special_source'; level: SitovMappedLevel; pathSourceId: string;
  nodeSourceId: string; anchorSourceId: string; goalId: string; evidence: string;
}
export type SitovTopicTarget =
  | { kind: 'vocabulary_card'; id: string; level: SitovMappedLevel; unitId: string; evidence: string }
  | { kind: 'verb'; id: string; level: SitovMappedLevel; tense: 'present'; evidence: string }
  | { kind: 'reading_text'; id: string; level: SitovMappedLevel; evidence: string }
export type SitovTopicMapping = {
  topicId: string; competencyId: string; level: SitovMappedLevel;
  anchors: readonly SitovPathSourceTarget[]; targets: readonly SitovTopicTarget[];
  specialTargets?: readonly SitovSpecialSourceTarget[];
}
export const SITOV_TOPIC_MAPPING_VERSION = 1 as const
// Seed source IDs are level-qualified; DB UUIDs must be resolved from stored rows.
// Evidence-backed partial coverage: missing topics never imply missing rights or competence.
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
    "specialTargets": [
      {
        "kind": "path_special_source",
        "level": "A1.1",
        "pathSourceId": "P4",
        "nodeSourceId": "sitov-special-a11-artikel-nominativ-v1",
        "anchorSourceId": "P4-N1",
        "goalId": "P4-G1",
        "evidence": "Artikel im Nominativ · vorhandenes optionales Special"
      }
    ],
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
  },
  {
    "topicId": "sitov.topic.satzbau-a11",
    "competencyId": "sitov.competency.satzbau-a11",
    "level": "A1.1",
    "anchors": [
      {
        "kind": "path_node_source",
        "level": "A1.1",
        "pathSourceId": "P1",
        "nodeSourceId": "P1-N7",
        "evidence": "Satzbau und W-Fragen"
      },
      {
        "kind": "path_node_source",
        "level": "A1.1",
        "pathSourceId": "P5",
        "nodeSourceId": "P5-N6",
        "evidence": "Am Montag arbeite ich"
      }
    ],
    "targets": [
      {
        "kind": "reading_text",
        "id": "6d2f8e95-6f87-510b-b244-0631733f8ff9",
        "level": "A1.1",
        "evidence": "Guten Tag, das bin ich"
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
    "topicId": "sitov.topic.praesens-a11",
    "competencyId": "sitov.competency.praesens-a11",
    "level": "A1.1",
    "anchors": [
      {
        "kind": "path_node_source",
        "level": "A1.1",
        "pathSourceId": "P2",
        "nodeSourceId": "P2-N4",
        "evidence": "Verben: wir, ihr, sie"
      },
      {
        "kind": "path_node_source",
        "level": "A1.1",
        "pathSourceId": "P2",
        "nodeSourceId": "P2-N5",
        "evidence": "heißen, sein, haben"
      },
      {
        "kind": "path_node_source",
        "level": "A1.1",
        "pathSourceId": "P5",
        "nodeSourceId": "P5-N5",
        "evidence": "Verben mit Besonderheiten"
      },
      {
        "kind": "path_node_source",
        "level": "A1.1",
        "pathSourceId": "P6",
        "nodeSourceId": "P6-N7",
        "evidence": "lesen und treffen"
      },
      {
        "kind": "path_node_source",
        "level": "A1.1",
        "pathSourceId": "P6",
        "nodeSourceId": "P6-N8",
        "evidence": "nehmen und fahren"
      }
    ],
    "targets": [
      {
        "kind": "verb",
        "id": "sitov-verb-sein",
        "level": "A1.1",
        "tense": "present",
        "evidence": "sein"
      },
      {
        "kind": "verb",
        "id": "sitov-verb-haben",
        "level": "A1.1",
        "tense": "present",
        "evidence": "haben"
      },
      {
        "kind": "verb",
        "id": "sitov-verb-essen",
        "level": "A1.1",
        "tense": "present",
        "evidence": "essen"
      },
      {
        "kind": "verb",
        "id": "sitov-verb-lesen",
        "level": "A1.1",
        "tense": "present",
        "evidence": "lesen"
      },
      {
        "kind": "verb",
        "id": "sitov-verb-sprechen",
        "level": "A1.1",
        "tense": "present",
        "evidence": "sprechen"
      },
      {
        "kind": "verb",
        "id": "sitov-verb-nehmen",
        "level": "A1.1",
        "tense": "present",
        "evidence": "nehmen"
      },
      {
        "kind": "reading_text",
        "id": "6d2f8e95-6f87-510b-b244-0631733f8ff9",
        "level": "A1.1",
        "evidence": "Guten Tag, das bin ich"
      },
      {
        "kind": "reading_text",
        "id": "d7280df2-9f87-5729-bd8f-19c9b47c9488",
        "level": "A1.1",
        "evidence": "Mein Frühstück"
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
    "topicId": "sitov.topic.tageszeit-a11",
    "competencyId": "sitov.competency.tageszeit-a11",
    "level": "A1.1",
    "anchors": [
      {
        "kind": "path_node_source",
        "level": "A1.1",
        "pathSourceId": "P5",
        "nodeSourceId": "P5-N1",
        "evidence": "Wochentage und Tageszeiten"
      },
      {
        "kind": "path_node_source",
        "level": "A1.1",
        "pathSourceId": "P5",
        "nodeSourceId": "P5-N2",
        "evidence": "Wie spät ist es?"
      },
      {
        "kind": "path_node_source",
        "level": "A1.1",
        "pathSourceId": "P5",
        "nodeSourceId": "P5-N6",
        "evidence": "Am Montag arbeite ich"
      }
    ],
    "targets": [
      {
        "kind": "reading_text",
        "id": "fd1297a1-999f-5759-b0d9-1f77c381d114",
        "level": "A1.1",
        "evidence": "Am Samstag im Park"
      },
      {
        "kind": "reading_text",
        "id": "c8055fa7-7bb0-5027-9f3e-13d001eb728b",
        "level": "A1.1",
        "evidence": "Der Weg zum Kurs"
      },
      {
        "kind": "reading_text",
        "id": "4a6f7008-9439-5c6e-9d60-113e8945f800",
        "level": "A1.1",
        "evidence": "Ein ruhiger Abend"
      }
    ]
  },
  {
    "topicId": "sitov.topic.essen-a11",
    "competencyId": "sitov.competency.essen-a11",
    "level": "A1.1",
    "anchors": [
      {
        "kind": "path_node_source",
        "level": "A1.1",
        "pathSourceId": "P3",
        "nodeSourceId": "P3-N1",
        "evidence": "Obst und Gemüse"
      },
      {
        "kind": "path_node_source",
        "level": "A1.1",
        "pathSourceId": "P6",
        "nodeSourceId": "P6-N11",
        "evidence": "Am Imbiss"
      }
    ],
    "targets": [
      {
        "kind": "verb",
        "id": "sitov-verb-fruehstuecken",
        "level": "A1.1",
        "tense": "present",
        "evidence": "frühstücken"
      },
      {
        "kind": "verb",
        "id": "sitov-verb-essen",
        "level": "A1.1",
        "tense": "present",
        "evidence": "essen"
      },
      {
        "kind": "verb",
        "id": "sitov-verb-trinken",
        "level": "A1.1",
        "tense": "present",
        "evidence": "trinken"
      },
      {
        "kind": "verb",
        "id": "sitov-verb-kochen",
        "level": "A1.1",
        "tense": "present",
        "evidence": "kochen"
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
    "topicId": "sitov.topic.wohnen-a11",
    "competencyId": "sitov.competency.wohnen-a11",
    "level": "A1.1",
    "anchors": [
      {
        "kind": "path_node_source",
        "level": "A1.1",
        "pathSourceId": "P4",
        "nodeSourceId": "P4-N2",
        "evidence": "Zimmer und Möbel"
      },
      {
        "kind": "path_node_source",
        "level": "A1.1",
        "pathSourceId": "P4",
        "nodeSourceId": "P4-N6",
        "evidence": "Farben und Gegensätze"
      },
      {
        "kind": "path_node_source",
        "level": "A1.1",
        "pathSourceId": "P4",
        "nodeSourceId": "P4-N8",
        "evidence": "Möbel beschreiben"
      }
    ],
    "targets": [
      {
        "kind": "verb",
        "id": "sitov-verb-liegen",
        "level": "A1.1",
        "tense": "present",
        "evidence": "liegen"
      },
      {
        "kind": "reading_text",
        "id": "25bdcac1-9272-5294-893f-c2063b4838b9",
        "level": "A1.1",
        "evidence": "Unser Kursraum"
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
    "topicId": "sitov.topic.einkaufen-a11",
    "competencyId": "sitov.competency.einkaufen-a11",
    "level": "A1.1",
    "anchors": [
      {
        "kind": "path_node_source",
        "level": "A1.1",
        "pathSourceId": "P3",
        "nodeSourceId": "P3-N5",
        "evidence": "Im Geschäft"
      },
      {
        "kind": "path_node_source",
        "level": "A1.1",
        "pathSourceId": "P3",
        "nodeSourceId": "P3-N8",
        "evidence": "Preise"
      },
      {
        "kind": "path_node_source",
        "level": "A1.1",
        "pathSourceId": "P3",
        "nodeSourceId": "P3-N9",
        "evidence": "Einkaufszettel und Rezept"
      }
    ],
    "targets": [
      {
        "kind": "verb",
        "id": "sitov-verb-brauchen",
        "level": "A1.1",
        "tense": "present",
        "evidence": "brauchen"
      },
      {
        "kind": "verb",
        "id": "sitov-verb-kosten",
        "level": "A1.1",
        "tense": "present",
        "evidence": "kosten"
      },
      {
        "kind": "verb",
        "id": "sitov-verb-nehmen",
        "level": "A1.1",
        "tense": "present",
        "evidence": "nehmen"
      },
      {
        "kind": "verb",
        "id": "sitov-verb-bezahlen",
        "level": "A1.1",
        "tense": "present",
        "evidence": "bezahlen"
      },
      {
        "kind": "reading_text",
        "id": "15c29bec-e14e-5f27-8f12-ea9e45145e97",
        "level": "A1.1",
        "evidence": "Im kleinen Laden"
      }
    ]
  },
  {
    "topicId": "sitov.topic.gesundheit-a12",
    "competencyId": "sitov.competency.gesundheit-a12",
    "level": "A1.2",
    "anchors": [
      {
        "kind": "path_node_source",
        "level": "A1.2",
        "pathSourceId": "P3",
        "nodeSourceId": "P3-N1",
        "evidence": "Der Körper"
      },
      {
        "kind": "path_node_source",
        "level": "A1.2",
        "pathSourceId": "P3",
        "nodeSourceId": "P3-N2",
        "evidence": "Was tut weh?"
      },
      {
        "kind": "path_node_source",
        "level": "A1.2",
        "pathSourceId": "P3",
        "nodeSourceId": "P3-N9",
        "evidence": "Ein Termin beim Arzt"
      }
    ],
    "targets": [
      {
        "kind": "reading_text",
        "id": "1b5c02d4-7217-56e0-8abb-906c20784e30",
        "level": "A1.2",
        "evidence": "Ein Termin beim Arzt"
      }
    ]
  },
  {
    "topicId": "sitov.topic.ablauf-a12",
    "competencyId": "sitov.competency.ablauf-a12",
    "level": "A1.2",
    "anchors": [
      {
        "kind": "path_node_source",
        "level": "A1.2",
        "pathSourceId": "P2",
        "nodeSourceId": "P2-N10",
        "evidence": "Zuerst, dann, danach"
      },
      {
        "kind": "path_node_source",
        "level": "A1.2",
        "pathSourceId": "P5",
        "nodeSourceId": "P5-N3",
        "evidence": "Mein Tag"
      }
    ],
    "targets": [
      {
        "kind": "reading_text",
        "id": "add5b212-15af-55b5-b224-6282b5c39c13",
        "level": "A1.2",
        "evidence": "Wir kochen zusammen"
      }
    ]
  },
  {
    "topicId": "sitov.topic.akkusativ-a12",
    "competencyId": "sitov.competency.akkusativ-a12",
    "level": "A1.2",
    "anchors": [
      {
        "kind": "path_node_source",
        "level": "A1.2",
        "pathSourceId": "P6",
        "nodeSourceId": "P6-N2",
        "evidence": "Der ist schön! Den nehme ich."
      },
      {
        "kind": "path_node_source",
        "level": "A1.2",
        "pathSourceId": "P3",
        "nodeSourceId": "P3-N5",
        "evidence": "meinen, deinen, seinen"
      }
    ],
    "targets": [
      {
        "kind": "reading_text",
        "id": "1b5c02d4-7217-56e0-8abb-906c20784e30",
        "level": "A1.2",
        "evidence": "einen Termin machen"
      },
      {
        "kind": "reading_text",
        "id": "add5b212-15af-55b5-b224-6282b5c39c13",
        "level": "A1.2",
        "evidence": "Ich decke den Tisch."
      }
    ]
  },
  {
    "topicId": "sitov.topic.begruenden-a21",
    "competencyId": "sitov.competency.begruenden-a21",
    "level": "A2.1",
    "anchors": [
      {
        "kind": "path_node_source",
        "level": "A2.1",
        "pathSourceId": "P1",
        "nodeSourceId": "P1-N4",
        "evidence": "weil"
      },
      {
        "kind": "path_node_source",
        "level": "A2.1",
        "pathSourceId": "P1",
        "nodeSourceId": "P1-N5",
        "evidence": "Warum? – Weil ich arbeiten muss."
      }
    ],
    "targets": [
      {
        "kind": "vocabulary_card",
        "id": "7c843d2c-122c-59d8-be9b-872e6a633d5d",
        "level": "A2.1",
        "unitId": "b323bbf3-b8af-5972-91c1-cb60d513f4f6",
        "evidence": "weil ich …"
      },
      {
        "kind": "reading_text",
        "id": "b2ae5915-20dd-5018-8921-6afe5be0f1fd",
        "level": "A2.1",
        "evidence": "Mein erster Arbeitstag · weil die Kunden schnell gesprochen haben; Teilbeleg im Kontext, kein Kompetenznachweis"
      }
    ]
  },
  {
    "topicId": "sitov.topic.vorschlaege-a22",
    "competencyId": "sitov.competency.vorschlaege-a22",
    "level": "A2.2",
    "anchors": [
      {
        "kind": "path_node_source",
        "level": "A2.2",
        "pathSourceId": "P1",
        "nodeSourceId": "P1-N6",
        "evidence": "Du könntest …"
      },
      {
        "kind": "path_node_source",
        "level": "A2.2",
        "pathSourceId": "P1",
        "nodeSourceId": "P1-N7",
        "evidence": "Wie wäre es mit …?"
      },
      {
        "kind": "path_node_source",
        "level": "A2.2",
        "pathSourceId": "P1",
        "nodeSourceId": "P1-N8",
        "evidence": "Gute Idee!"
      }
    ],
    "targets": [
      {
        "kind": "vocabulary_card",
        "id": "769fbe06-623b-5208-9255-4bc3146b34d6",
        "level": "A2.2",
        "unitId": "81278222-33e1-5bcf-aeee-8b01a16606c1",
        "evidence": "einen Vorschlag machen"
      },
      {
        "kind": "verb",
        "id": "sitov-verb-vorschlagen",
        "level": "A2.2",
        "tense": "present",
        "evidence": "vorschlagen · Präsens des Lexems, keine Konjunktiv- oder Vergangenheitsabdeckung"
      },
      {
        "kind": "reading_text",
        "id": "3243b764-4bfc-5fc6-8c24-1a49962988ff",
        "level": "A2.2",
        "evidence": "Ein Gespräch über Arbeitszeiten · Dafür könnte ich morgens eine Stunde früher anfangen; Teilbeleg im Kontext, kein Kompetenznachweis"
      }
    ]
  },
  {
    "topicId": "sitov.topic.berufseinstieg-b11",
    "competencyId": "sitov.competency.berufseinstieg-b11",
    "level": "B1.1",
    "anchors": [
      {
        "kind": "path_node_source",
        "level": "B1.1",
        "pathSourceId": "P5",
        "nodeSourceId": "P5-N1",
        "evidence": "Bewerbung und Beruf"
      },
      {
        "kind": "path_node_source",
        "level": "B1.1",
        "pathSourceId": "P5",
        "nodeSourceId": "P5-N7",
        "evidence": "Berufliche Wünsche"
      },
      {
        "kind": "path_node_source",
        "level": "B1.1",
        "pathSourceId": "P5",
        "nodeSourceId": "P5-N8",
        "evidence": "Die Bewerbung"
      },
      {
        "kind": "path_node_source",
        "level": "B1.1",
        "pathSourceId": "P5",
        "nodeSourceId": "P5-N9",
        "evidence": "Über die Arbeit sprechen"
      }
    ],
    "targets": [
      {
        "kind": "vocabulary_card",
        "id": "09279424-00ac-5fbb-9776-fe430b731dbf",
        "level": "B1.1",
        "unitId": "2a531c0b-bd97-54b9-9913-4327386e5038",
        "evidence": "einen Lebenslauf schreiben"
      },
      {
        "kind": "vocabulary_card",
        "id": "7cdbce00-8fc5-5e41-8952-2624b7025daf",
        "level": "B1.1",
        "unitId": "2a531c0b-bd97-54b9-9913-4327386e5038",
        "evidence": "Unterlagen einreichen"
      },
      {
        "kind": "reading_text",
        "id": "19846618-a6c3-5001-84d5-06b21b99dff5",
        "level": "B1.1",
        "evidence": "Ein neuer Beruf als Chance · Praktikum, beruflicher Wechsel und Bewerbung; Teilbeleg im Kontext, kein Kompetenznachweis"
      }
    ]
  },
  {
    "topicId": "sitov.topic.zusammenarbeit-b12",
    "competencyId": "sitov.competency.zusammenarbeit-b12",
    "level": "B1.2",
    "anchors": [
      {
        "kind": "path_node_source",
        "level": "B1.2",
        "pathSourceId": "P1",
        "nodeSourceId": "P1-N1",
        "evidence": "Arbeitsalltag im Team"
      },
      {
        "kind": "path_node_source",
        "level": "B1.2",
        "pathSourceId": "P1",
        "nodeSourceId": "P1-N9",
        "evidence": "Alternativen vorschlagen"
      }
    ],
    "targets": [
      {
        "kind": "vocabulary_card",
        "id": "04b04190-54df-5325-931b-bf3ccdbde9b5",
        "level": "B1.2",
        "unitId": "d812aefe-f72d-5524-b2b9-08fbd59bdaf2",
        "evidence": "die Zusammenarbeit verbessern"
      },
      {
        "kind": "verb",
        "id": "sitov-verb-beschliessen",
        "level": "B1.2",
        "tense": "present",
        "evidence": "beschließen · Präsens des Lexems, keine Konjunktiv- oder Vergangenheitsabdeckung"
      },
      {
        "kind": "reading_text",
        "id": "cacb3a6d-e789-5abc-9e94-f6eecfb36bdb",
        "level": "B1.2",
        "evidence": "Ein Vorschlag im Betrieb · Vorschlag im Betrieb und Zusammenarbeit verbessern; Teilbeleg im Kontext, kein Kompetenznachweis"
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
