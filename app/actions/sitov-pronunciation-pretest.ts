'use server'
import {
  loadSitovPronunciationPretestPublicationServer, publishSitovPronunciationPretestServer, saveSitovPronunciationPretestDraftServer, loadSitovPronunciationPretestStaff, loadSitovPronunciationPretests, startSitovPronunciationPretestServer, loadSitovPronunciationPretestAttempt,
  saveSitovPronunciationPretestAnswersServer, submitSitovPronunciationPretestServer,
  createSitovPronunciationUploadTicketServer, createSitovPronunciationReplyUploadTicketServer,
} from '@/lib/sitov-pronunciation-pretest-server'
export async function getSitovPronunciationPretests(level: string) { return loadSitovPronunciationPretests(level) }
export async function startSitovPronunciationPretest(input: unknown) { return startSitovPronunciationPretestServer(input) }
export async function getSitovPronunciationPretestAttempt(attemptId: string) { return loadSitovPronunciationPretestAttempt(attemptId) }
export async function saveSitovPronunciationPretestAnswers(input: unknown) { return saveSitovPronunciationPretestAnswersServer(input) }
export async function submitSitovPronunciationPretest(input: unknown) { return submitSitovPronunciationPretestServer(input) }
export async function createSitovPronunciationUploadTicket(input: unknown) { return createSitovPronunciationUploadTicketServer(input) }
export async function createSitovPronunciationReplyUploadTicket(input: unknown) { return createSitovPronunciationReplyUploadTicketServer(input) }
export async function getSitovPronunciationPretestStaff(input: unknown) { return loadSitovPronunciationPretestStaff(input) }

export async function saveSitovPronunciationPretestDraft(input: unknown) { return saveSitovPronunciationPretestDraftServer(input) }

export async function getSitovPronunciationPretestPublication(input: unknown) { return loadSitovPronunciationPretestPublicationServer(input) }
export async function publishSitovPronunciationPretest(input: unknown) { return publishSitovPronunciationPretestServer(input) }
