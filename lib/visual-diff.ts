export interface DiffChunk {
  value: string
  status: 'correct' | 'missing' | 'wrong'
}

/**
 * Align the learner's spelling with the solution, preserving the solution verbatim.
 * Only solution characters are returned: substitutions and missing characters can
 * be highlighted without inserting deleted input or changing the correct sentence.
 * Graphemes keep accented letters and emoji intact; comparisons remain case-sensitive.
 */
export function computeVisualDiff(actual: string, expected: string): DiffChunk[] {
  const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null
  const split = (text: string) => segmenter ? Array.from(segmenter.segment(text), part => part.segment) : Array.from(text)
  const input = split(actual)
  const solution = split(expected)
  const equal = (left: string, right: string) => left === right
  const distances = Array.from({ length: input.length + 1 }, () => new Uint32Array(solution.length + 1))
  for (let i = 0; i <= input.length; i++) distances[i][0] = i
  for (let j = 0; j <= solution.length; j++) distances[0][j] = j
  for (let i = 1; i <= input.length; i++) {
    for (let j = 1; j <= solution.length; j++) {
      distances[i][j] = Math.min(
        distances[i - 1][j] + 1,
        distances[i][j - 1] + 1,
        distances[i - 1][j - 1] + Number(!equal(input[i - 1], solution[j - 1])),
      )
    }
  }

  const reversed: DiffChunk[] = []
  let i = input.length
  let j = solution.length
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && equal(input[i - 1], solution[j - 1])) {
      reversed.push({ value: solution[--j], status: 'correct' })
      i--
    } else if (i > 0 && j > 0 && distances[i][j] === distances[i - 1][j - 1] + 1) {
      reversed.push({ value: solution[--j], status: 'wrong' })
      i--
    } else if (j > 0 && distances[i][j] === distances[i][j - 1] + 1) {
      reversed.push({ value: solution[--j], status: 'missing' })
    } else {
      // Extra input belongs in the separate, unmodified learner-answer paragraph.
      i--
    }
  }

  const chunks: DiffChunk[] = []
  for (const chunk of reversed.reverse()) {
    const previous = chunks.at(-1)
    if (previous?.status === chunk.status) previous.value += chunk.value
    else chunks.push({ ...chunk })
  }
  return chunks
}
