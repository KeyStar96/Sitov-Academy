'use client'

import { createContext, useContext, type ReactNode } from 'react'
import germanDictionary from '@/dictionaries/de.json'

export interface RouteFeedbackCopy {
  loading: string
  error_title: string
  error_description: string
  error_retry: string
}
export type FeedbackFeature = 'auth' | 'vocabulary' | 'exercises' | 'videos' | 'pronunciation' | 'profile'
export type RouteFeedbackMessages = Record<FeedbackFeature, RouteFeedbackCopy>
const FeedbackContext = createContext<RouteFeedbackMessages | null>(null)
type AudioFeedbackCopy = typeof germanDictionary.neural_audio
const AudioFeedbackContext = createContext<AudioFeedbackCopy>(germanDictionary.neural_audio)

export function RouteFeedbackProvider({ messages, audio, children }: { messages: RouteFeedbackMessages; audio?: AudioFeedbackCopy; children: ReactNode }) {
  return <FeedbackContext.Provider value={messages}><AudioFeedbackContext.Provider value={audio ?? germanDictionary.neural_audio}>{children}</AudioFeedbackContext.Provider></FeedbackContext.Provider>
}

export function useAudioFeedback(): AudioFeedbackCopy {
  return useContext(AudioFeedbackContext)
}

export function useRouteFeedback(feature: FeedbackFeature): RouteFeedbackCopy {
  const messages = useContext(FeedbackContext)
  if (!messages) throw new Error('RouteFeedbackProvider is required by loading and error boundaries')
  return messages[feature]
}
