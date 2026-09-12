export type DiffChunk = {
  value: string
  status: 'correct' | 'missing' | 'wrong'
}

/**
 * Computes a word-level visual diff between the typed answer and the correct solution.
 * Uses a basic Longest Common Subsequence (LCS) approach on word tokens.
 */
export function computeVisualDiff(actual: string, expected: string): DiffChunk[] {
  // Tokenize by word boundaries, keeping spaces as part of the token or separating them.
  // We'll split by words and punctuation.
  const tokenize = (text: string) => text.match(/[\wäöüÄÖÜß]+|[^\wäöüÄÖÜß]+/g) || []
  const actualTokens = tokenize(actual)
  const expectedTokens = tokenize(expected)

  // LCS Matrix
  const m = actualTokens.length
  const n = expectedTokens.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (actualTokens[i - 1].toLowerCase() === expectedTokens[j - 1].toLowerCase()) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // Backtrack to find diff
  let i = m
  let j = n
  const result: DiffChunk[] = []

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && actualTokens[i - 1].toLowerCase() === expectedTokens[j - 1].toLowerCase()) {
      result.unshift({ value: expectedTokens[j - 1], status: 'correct' })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ value: expectedTokens[j - 1], status: 'missing' })
      j--
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      result.unshift({ value: actualTokens[i - 1], status: 'wrong' })
      i--
    }
  }

  // Merge consecutive chunks of the same status
  const merged: DiffChunk[] = []
  for (const chunk of result) {
    if (merged.length > 0 && merged[merged.length - 1].status === chunk.status) {
      merged[merged.length - 1].value += chunk.value
    } else {
      merged.push({ ...chunk })
    }
  }

  return merged
}
