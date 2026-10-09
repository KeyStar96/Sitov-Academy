import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { sitovReadAuthoringSources,sitovValidatePretestDrafts,sitovHash,sitovPublicPretestAudioAliases,sitovValidatePretestAudioAliases } from './sitov-pronunciation-pretests-authoring.mjs'
const sitovQuality32CurrentManifest=JSON.parse(await readFile('supabase/seeds/sitov-pronunciation-pretests-2026-10-08.json','utf8')),sitovQuality32CurrentAudio=JSON.parse(await readFile('supabase/seeds/sitov-pronunciation-pretest-audio-2026-10-08.json','utf8'))
const sitovQuality32PatchRaw=await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S4/epoch24-quality-patch.json','utf8'),sitovQuality32Patch=JSON.parse(sitovQuality32PatchRaw),sitovQuality32ReviewRaw=await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/M/a11-quality32-editorial-review.json','utf8'),sitovQuality32Review=JSON.parse(sitovQuality32ReviewRaw),sitovQuality32Application=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/M/a11-quality32-application.json','utf8'))
// Restore exact current45 M-reviewed source BEFORE M45/author51/M42/quality21 and ALL historical proofs.
const sitovQuality32PreviousManifest=structuredClone(sitovQuality32CurrentManifest),sitovQuality32PreviousAudio=structuredClone(sitovQuality32CurrentAudio)
for(const r of sitovQuality32Patch.patches){const d=sitovQuality32PreviousManifest.drafts.find(d=>d.textId===r.textId);d.definition.tasks[d.definition.tasks.findIndex(q=>q.id===r.questionId)]=r.previousTask;for(const e of r.previousAudioAliasEntries)sitovQuality32PreviousAudio[e.alias]=e.text}
for(const r of sitovQuality32Patch.pools)sitovQuality32PreviousManifest.drafts.find(d=>d.textId===r.textId).review=r.priorReviewAsEvidenceOnly
const sitovLatestMReviewed45=structuredClone(sitovQuality32PreviousManifest)
const sitovMReview45Raw=await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/M/pools43-45-editorial-review.json','utf8'),sitovMReview45=JSON.parse(sitovMReview45Raw)
// Restore author51 reviews BEFORE freezing previous42 and every immutable historical proof.
const sitovBeforeMReviewed45=structuredClone(sitovLatestMReviewed45)
for(const r of sitovMReview45.approvedEditorialDrafts)sitovBeforeMReviewed45.drafts.find(d=>d.textId===r.textId).review=r.previousReview
const sitovActualManifest51=structuredClone(sitovBeforeMReviewed45)
const sitovEpoch51=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/epoch51-pools43-45-author-review.json','utf8'))
// Freeze exact current M-reviewed42 BEFORE M42, quality21 and every older111 proof.
const sitovLatestMReviewed42=structuredClone(sitovActualManifest51)
sitovLatestMReviewed42.drafts=sitovLatestMReviewed42.drafts.slice(0,42)
sitovLatestMReviewed42.coverage=structuredClone(sitovEpoch51.previousCoverage)
for(const row of sitovEpoch51.previousInventoryRows)sitovLatestMReviewed42.inventory[sitovLatestMReviewed42.inventory.findIndex(r=>r.textId===row.textId)]=row
const sitovActualAudio51=structuredClone(sitovQuality32PreviousAudio)
const sitovFrozenAudio42=Object.fromEntries(Object.entries(sitovActualAudio51).slice(0,4032))
const sitovMReview42Raw=await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/M/pools40-42-editorial-review.json','utf8'),sitovMReview42=JSON.parse(sitovMReview42Raw)
// Restore author42 reviews BEFORE quality21 application/hash replay and every historical proof.
const sitovBeforeMReviewed42=structuredClone(sitovLatestMReviewed42)
for(const r of sitovMReview42.approvedEditorialDrafts)sitovBeforeMReviewed42.drafts.find(d=>d.textId===r.textId).review=r.previousReview
const sitovQuality21CurrentManifest=structuredClone(sitovBeforeMReviewed42),sitovQuality21CurrentAudio=structuredClone(sitovFrozenAudio42)
const sitovQuality21PatchRaw=await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S4/epoch22-quality-patch.json','utf8'),sitovQuality21Patch=JSON.parse(sitovQuality21PatchRaw),sitovQuality21ReviewRaw=await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/M/a11-quality21-editorial-review.json','utf8'),sitovQuality21Review=JSON.parse(sitovQuality21ReviewRaw),sitovQuality21Application=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/M/a11-quality21-application.json','utf8'))
// Restore exact current42 source state BEFORE author50, M39, quality18 and ALL immutable proofs.
const sitovQuality21PreviousManifest=structuredClone(sitovQuality21CurrentManifest),sitovQuality21PreviousAudio=structuredClone(sitovQuality21CurrentAudio)
for(const r of sitovQuality21Patch.patches){const d=sitovQuality21PreviousManifest.drafts.find(d=>d.textId===r.textId);d.definition.tasks[d.definition.tasks.findIndex(q=>q.id===r.questionId)]=r.previousTask;for(const e of r.previousAudioAliasEntries)sitovQuality21PreviousAudio[e.alias]=e.text}
for(const r of sitovQuality21Patch.pools)sitovQuality21PreviousManifest.drafts.find(d=>d.textId===r.textId).review=r.priorReviewAsEvidenceOnly
const sources=await sitovReadAuthoringSources(),sitovActualManifest50=structuredClone(sitovQuality21PreviousManifest)
const sitovEpoch50=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/epoch50-pools40-42-author-review.json','utf8'))
// Freeze exact M-reviewed39 BEFORE M39, epoch49, quality18 and every older immutable proof.
const sitovLatestMReviewed39=structuredClone(sitovActualManifest50)
sitovLatestMReviewed39.drafts=sitovLatestMReviewed39.drafts.slice(0,39)
sitovLatestMReviewed39.coverage=structuredClone(sitovEpoch50.previousCoverage)
for(const row of sitovEpoch50.previousInventoryRows)sitovLatestMReviewed39.inventory[sitovLatestMReviewed39.inventory.findIndex(r=>r.textId===row.textId)]=row
const sitovMReview39Raw=await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/M/pools37-39-editorial-review.json','utf8'),sitovMReview39=JSON.parse(sitovMReview39Raw)
const sitovActualManifest49=structuredClone(sitovLatestMReviewed39)
for(const r of sitovMReview39.approvedEditorialDrafts)sitovActualManifest49.drafts.find(d=>d.textId===r.textId).review=r.previousReview
const sitovDelta49=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/epoch49-three-core-repairs-delta.json','utf8'))
// Freeze exact M-reviewed quality18/39 state BEFORE quality18 and all97 older immutable proofs.
const sitovQualityCurrent=structuredClone(sitovActualManifest49)
for(const r of sitovDelta49.questions){const d=sitovQualityCurrent.drafts.find(d=>d.textId===r.textId);d.definition.tasks[d.definition.tasks.findIndex(q=>q.id===r.questionId)]=r.previousTask}
for(const r of sitovDelta49.cores){const d=sitovQualityCurrent.drafts.find(d=>d.textId===r.textId);d.definition.competencies[d.definition.competencies.findIndex(c=>c.id===r.coreId)]=r.previousCore}
for(const r of sitovDelta49.pools)sitovQualityCurrent.drafts.find(d=>d.textId===r.textId).review=r.previousReview
const sitovQualityPatchRaw=await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S4/epoch21-quality-patch.json','utf8'),sitovQualityPatch=JSON.parse(sitovQualityPatchRaw),sitovQualityReviewRaw=await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/M/a11-quality18-editorial-review.json','utf8'),sitovQualityReview=JSON.parse(sitovQualityReviewRaw)
// Reconstruct exact previous39 tasks and reviews BEFORE every immutable author/M proof.
const sitovActualManifest48=structuredClone(sitovQualityCurrent)
for(const r of sitovQualityPatch.patches){const d=sitovActualManifest48.drafts.find(d=>d.textId===r.textId);d.definition.tasks[d.definition.tasks.findIndex(q=>q.id===r.questionId)]=r.previousTask}
for(const r of sitovQualityPatch.pools)sitovActualManifest48.drafts.find(d=>d.textId===r.textId).review=r.priorReviewAsEvidenceOnly
const sitovEpoch48=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/epoch48-pools37-39-author-review.json','utf8'))
// Freeze exact M-reviewed36 before every historical normalization.
const sitovLatestMReviewed36=structuredClone(sitovActualManifest48)
sitovLatestMReviewed36.drafts=sitovLatestMReviewed36.drafts.slice(0,36)
sitovLatestMReviewed36.coverage=structuredClone(sitovEpoch48.previousCoverage)
for(const row of sitovEpoch48.previousInventoryRows)sitovLatestMReviewed36.inventory[sitovLatestMReviewed36.inventory.findIndex(r=>r.textId===row.textId)]=row
const sitovMReview36Raw=await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/M/pools34-36-editorial-review.json','utf8'),sitovMReview36=JSON.parse(sitovMReview36Raw)
const sitovActualManifest47=structuredClone(sitovLatestMReviewed36)
for(const r of sitovMReview36.approvedEditorialDrafts)sitovActualManifest47.drafts.find(d=>d.textId===r.textId).review=r.previousReview
const sitovEpoch47=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/epoch47-pools34-36-author-review.json','utf8'))
// Freeze exact latest M-reviewed33 BEFORE M33 reviews, epoch46/45 and every older proof.
const sitovLatestMReviewed33=structuredClone(sitovActualManifest47)
sitovLatestMReviewed33.drafts=sitovLatestMReviewed33.drafts.slice(0,33)
sitovLatestMReviewed33.coverage=structuredClone(sitovEpoch47.previousCoverage)
for(const row of sitovEpoch47.previousInventoryRows)sitovLatestMReviewed33.inventory[sitovLatestMReviewed33.inventory.findIndex(r=>r.textId===row.textId)]=row
const sitovMReview33Raw=await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/M/pools31-33-editorial-review.json','utf8'),sitovMReview33=JSON.parse(sitovMReview33Raw)
// Restore exact author reviews before epoch46 full-task reconstruction, epoch45 and all older proofs.
const sitovActualManifest46=structuredClone(sitovLatestMReviewed33)
for(const r of sitovMReview33.approvedEditorialDrafts)sitovActualManifest46.drafts.find(d=>d.textId===r.textId).review=r.previousReview
const sitovDelta46=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/epoch46-a22-distractor-quality-delta.json','utf8'))
// Restore every full prior task/review BEFORE immutable epoch45 and all older proofs.
const sitovActualManifest45=structuredClone(sitovActualManifest46)
for(const r of sitovDelta46.questions){const d=sitovActualManifest45.drafts.find(d=>d.textId===r.textId);d.definition.tasks[d.definition.tasks.findIndex(q=>q.id===r.questionId)]=r.previousTask}
for(const r of sitovDelta46.pools)sitovActualManifest45.drafts.find(d=>d.textId===r.textId).review=r.previousReview
const sitovEpoch45=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/epoch45-pools31-33-author-review.json','utf8'))
// Freeze exact latest M-reviewed30 BEFORE M30 normalization and all epoch44/43/older proofs.
const sitovLatestMReviewed30=structuredClone(sitovActualManifest45)
sitovLatestMReviewed30.drafts=sitovLatestMReviewed30.drafts.slice(0,30)
sitovLatestMReviewed30.coverage=structuredClone(sitovEpoch45.previousCoverage)
for(const row of sitovEpoch45.previousInventoryRows)sitovLatestMReviewed30.inventory[sitovLatestMReviewed30.inventory.findIndex(r=>r.textId===row.textId)]=row
const sitovMReview30Raw=await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/M/pools25-30-editorial-review.json','utf8'),sitovMReview30=JSON.parse(sitovMReview30Raw)
// Restore only the six preceding S3 reviews before exact epoch44/43 and all established historical proofs.
const sitovActualManifest44=structuredClone(sitovLatestMReviewed30)
for(const r of sitovMReview30.approvedEditorialDrafts)sitovActualManifest44.drafts.find(d=>d.textId===r.textId).review=r.previousReview
const sitovEpoch44=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/epoch44-pools28-30-author-review.json','utf8'))
// Freeze exact prior27 BEFORE epoch43 metadata restoration, epoch42 and all older proofs.
const sitovActualManifest43=structuredClone(sitovActualManifest44)
sitovActualManifest43.drafts=sitovActualManifest43.drafts.slice(0,27)
sitovActualManifest43.coverage=structuredClone(sitovEpoch44.previousCoverage)
for(const row of sitovEpoch44.previousInventoryRows)sitovActualManifest43.inventory[sitovActualManifest43.inventory.findIndex(r=>r.textId===row.textId)]=row
const sitovDelta43=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/epoch43-club-mapping-reason-delta.json','utf8'))
// Restore exact prior27 metadata/review BEFORE epoch42 and every older source/hash proof.
const sitovActualManifest42=structuredClone(sitovActualManifest43)
const sitovOldClub43=sitovActualManifest42.drafts.find(d=>d.textId===sitovDelta43.textId)
sitovOldClub43.definition.competencies.find(c=>c.id===sitovDelta43.coreId).mapping.pendingReasonDe=sitovDelta43.previousReason
sitovOldClub43.review=sitovDelta43.previousReview
const sitovEpoch42=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/epoch42-pools25-27-author-review.json','utf8'))
// Freeze exact M-reviewed24 BEFORE all M review/source-repair/historical projections.
const sitovLatestMReviewed24=structuredClone(sitovActualManifest42)
sitovLatestMReviewed24.drafts=sitovLatestMReviewed24.drafts.slice(0,24)
sitovLatestMReviewed24.coverage=structuredClone(sitovEpoch42.previousCoverage)
for(const row of sitovEpoch42.previousInventoryRows)sitovLatestMReviewed24.inventory[sitovLatestMReviewed24.inventory.findIndex(r=>r.textId===row.textId)]=row
const sitovMReview24Raw=await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/M/pools22-24-editorial-review.json','utf8'),sitovMReview24=JSON.parse(sitovMReview24Raw)
// Normalize only the three newly reviewed records before exact epoch41 and all earlier source proofs.
const sitovCurrentRepository24=structuredClone(sitovLatestMReviewed24)
for(const r of sitovMReview24.approvedEditorialDrafts)sitovCurrentRepository24.drafts.find(d=>d.textId===r.textId).review=r.previousReview
const sitovSpan41=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/epoch41-package-source-span-delta.json','utf8'))
// Restore the exact pre-epoch41 spans/review BEFORE M-review normalization and all history.
const sitovBeforeSpan41=structuredClone(sitovCurrentRepository24)
const sitovOldPackage41=sitovBeforeSpan41.drafts.find(d=>d.textId===sitovSpan41.textId)
sitovOldPackage41.definition.tasks.find(q=>q.id===sitovSpan41.questionId).sourceSpans[0]=sitovSpan41.previousQuestionSpan
sitovOldPackage41.definition.competencies.find(c=>c.id===sitovSpan41.coreId).sourceSpans[0]=sitovSpan41.previousCoreSpan
sitovOldPackage41.review=sitovSpan41.previousReview
const sitovReviewed21Proofs=await Promise.all(["pools19-21-editorial-review.json","age-wordorder-repair-editorial-review.json"].map(async name=>{const raw=await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/M/'+name,'utf8');return {raw,proof:JSON.parse(raw)}}))
// Restore exact S3 pre-M-review records before every established historical projection.
const sitovActualManifest39=structuredClone(sitovBeforeSpan41)
for(const {proof}of sitovReviewed21Proofs)for(const r of proof.approvedEditorialDrafts)sitovActualManifest39.drafts.find(d=>d.textId===r.textId).review=r.previousReview
const sitovEpoch39=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/epoch39-pools22-24-author-review.json','utf8'))
// Freeze the exact21-pool state INCLUDING the age repair before restoring epoch38/history.
const sitovActualManifest38=structuredClone(sitovActualManifest39)
sitovActualManifest38.drafts=sitovActualManifest38.drafts.slice(0,21)
sitovActualManifest38.coverage=structuredClone(sitovEpoch39.previousCoverage)
for(const row of sitovEpoch39.previousInventoryRows)sitovActualManifest38.inventory[sitovActualManifest38.inventory.findIndex(r=>r.textId===row.textId)]=row
const sitovDelta38=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/epoch38-age-question-delta.json','utf8'))
// Restore the exact old first question/review BEFORE every21→18→15→12 historical projection.
const sitovActualManifest37=structuredClone(sitovActualManifest38)
const sitovOldFirst38=sitovActualManifest37.drafts.find(d=>d.textId===sitovDelta38.textId)
sitovOldFirst38.definition.tasks[sitovOldFirst38.definition.tasks.findIndex(q=>q.id===sitovDelta38.questionId)]=sitovDelta38.previousTask
sitovOldFirst38.review=sitovDelta38.previousReview
const sitovEpoch37=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/epoch37-pools19-21-author-review.json','utf8'))
// Exact frozen18 state with current M reviews, before the established18→15→12 historical projections.
const sitovActualManifest36=structuredClone(sitovActualManifest37)
sitovActualManifest36.drafts=sitovActualManifest36.drafts.slice(0,18);sitovActualManifest36.coverage=sitovEpoch37.previousCoverage
for(const row of sitovEpoch37.previousInventoryRows)sitovActualManifest36.inventory[sitovActualManifest36.inventory.findIndex(r=>r.textId===row.textId)]=row
const sitovReview36=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/M/pools16-18-editorial-review.json','utf8'))
const sitovAuthor36=structuredClone(sitovActualManifest36)
for(const r of sitovReview36.approvedEditorialDrafts)sitovAuthor36.drafts.find(d=>d.textId===r.textId).review=r.previousReview
const sitovEpoch36=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/epoch36-pools16-18-author-review.json','utf8'))
// Preserve the exact frozen15 current-M-review state before historical epoch35/34/33 projections.
const currentManifest=structuredClone(sitovActualManifest36)
currentManifest.drafts=currentManifest.drafts.slice(0,15);currentManifest.coverage=sitovEpoch36.previousCoverage
for(const row of sitovEpoch36.previousInventoryRows)currentManifest.inventory[currentManifest.inventory.findIndex(r=>r.textId===row.textId)]=row
const sitovEpoch34=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/epoch34-pools13-15-author-review.json','utf8'))
const sitovActualAudio50=structuredClone(sitovQuality21PreviousAudio)
const sitovActualAudio49=Object.fromEntries(Object.entries(sitovActualAudio50).slice(0,3744)),sitovQualityCurrentAudio=structuredClone(sitovActualAudio49)
for(const r of sitovDelta49.changedAliases)sitovQualityCurrentAudio[r.key]=r.previousTextDe
const sitovActualAudio48=structuredClone(sitovQualityCurrentAudio)
for(const r of sitovQualityPatch.patches)for(const e of r.previousAudioAliasEntries)sitovActualAudio48[e.alias]=e.text
const sitovActualAudio47=Object.fromEntries(Object.entries(sitovActualAudio48).slice(0,3456))
const sitovActualAudio46=Object.fromEntries(Object.entries(sitovActualAudio47).slice(0,3168))
const sitovActualAudio45={...sitovActualAudio46}
for(const r of sitovDelta46.changedAliases)sitovActualAudio45[r.key]=r.previousTextDe
const sitovActualAudio44=Object.fromEntries(Object.entries(sitovActualAudio45).slice(0,2880))
const sitovActualAudio42=Object.fromEntries(Object.entries(sitovActualAudio44).slice(0,2592))
const sitovActualAudio39=Object.fromEntries(Object.entries(sitovActualAudio42).slice(0,2304))
const sitovActualAudio38=Object.fromEntries(Object.entries(sitovActualAudio39).slice(0,2016))
const sitovActualAudio37={...sitovActualAudio38}
for(const row of sitovDelta38.changedAliases)sitovActualAudio37[row.key]=row.previousTextDe
const sitovActualAudio36=Object.fromEntries(Object.entries(sitovActualAudio37).slice(0,1728))
const sitovAllAudio=Object.fromEntries(Object.entries(sitovActualAudio36).slice(0,1440))
const sitovFrozenAudio12=Object.fromEntries(Object.entries(sitovAllAudio).slice(0,1152))
const sitovDelta35=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/epoch35-option-diversity-delta.json','utf8'))
const sitovAuthor35=structuredClone(currentManifest)
for(const row of sitovDelta35.pools)sitovAuthor35.drafts.find(d=>d.textId===row.textId).review=row.currentReview
const sitovBefore35=structuredClone(sitovAuthor35)
for(const row of sitovDelta35.questions){
 const q=sitovBefore35.drafts.find(d=>d.textId===row.textId).definition.tasks.find(q=>q.id===row.questionId)
 q.options=row.previousOptions;q.correctOptionId=row.previousCorrectOptionId
}
for(const row of sitovDelta35.pools)sitovBefore35.drafts.find(d=>d.textId===row.textId).review=row.previousReview
const sitovBeforeAudio35={...sitovFrozenAudio12}
for(const row of sitovDelta35.questions)for(const alias of row.previousAliasEntries)sitovBeforeAudio35[alias.key]=alias.textDe

// Explicit frozen12 projection preserves every previous record/review/hash; only next3 inventory statuses/counts revert.
const originalManifest=structuredClone(currentManifest)
originalManifest.drafts=originalManifest.drafts.slice(0,12);originalManifest.coverage.authored=12;originalManifest.coverage.pending=48
for(const row of originalManifest.inventory)if(!originalManifest.drafts.some(d=>d.textId===row.textId))row.coverageStatus='pending'
const manifest=structuredClone(originalManifest)
// Reconstruct the exact frozen pre-mapping record before applying historical task repairs.
const sitovMapping33=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/epoch33-same-level-mapping-delta.json','utf8'))
// Reconstruct S3's exact pending-review state; current M provenance is checked separately below.
for(const row of sitovMapping33.changedPools)manifest.drafts.find(d=>d.textId===row.textId).review=row.currentReview
const sitovBeforeMapping=structuredClone(manifest)
for(const row of sitovMapping33.changedPools){
 const draft=sitovBeforeMapping.drafts.find(d=>d.textId===row.textId)
 draft.review=row.previousReview
 for(const core of row.cores)draft.definition.competencies.find(c=>c.id===core.coreId).mapping=core.previousMapping
}
// Historical review/hash assertions below use this explicit reconstruction, never a new baseline.
const sitovRepair24=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/first9-visible-context-repair-delta-epoch24.json','utf8'))
const sitovFinal25=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/adjective-direction-final-delta-epoch25.json','utf8'))
const sitovBeforeRepair=structuredClone(sitovBeforeMapping)
for(const row of sitovRepair24.changedQuestions){const draft=sitovBeforeRepair.drafts.find(d=>d.textId===row.textId),i=draft.definition.tasks.findIndex(q=>q.id===row.questionId);draft.definition.tasks[i]=row.previousTask}
for(const pool of sitovRepair24.changedPools)sitovBeforeRepair.drafts.find(d=>d.textId===pool.textId).review=pool.previousReview
const sitovPreviousAliases=new Map(sitovRepair24.changedAliases.map(row=>[row.key,row.previousTextDe]))
const sitovBeforeRepairAliases=audio=>Object.fromEntries(Object.entries(audio).map(([key,value])=>[key,sitovPreviousAliases.get(key)??value]))
const validate=mutate=>{const copy=structuredClone(manifest);mutate(copy);return sitovValidatePretestDrafts(copy,sources)}
test('exact current repository inventory: 60 active plus 89 retained inactive; twelve actual source bodies/hashes',()=>{
 assert.equal(sources.rows.length,149);assert.equal(manifest.inventory.length,60);assert.equal(manifest.inactiveLegacy.length,89)
 for(const level of ['A1.1','A1.2','A2.1','A2.2','B1.1','B1.2'])assert.equal(manifest.inventory.filter(r=>r.level===level).length,10)
 assert.deepEqual(manifest.drafts.map(d=>d.textId),['6d2f8e95-6f87-510b-b244-0631733f8ff9','d7280df2-9f87-5729-bd8f-19c9b47c9488','25bdcac1-9272-5294-893f-c2063b4838b9','b73f6228-c6c7-591b-ac83-2bae82a3b163','fd1297a1-999f-5759-b0d9-1f77c381d114','a218b88e-9369-5472-b5fe-34c99d1ced76','15c29bec-e14e-5f27-8f12-ea9e45145e97','610e3f81-2a6f-5794-bb78-ef06cb7ece17','c8055fa7-7bb0-5027-9f3e-13d001eb728b','4a6f7008-9439-5c6e-9d60-113e8945f800','1b5c02d4-7217-56e0-8abb-906c20784e30','add5b212-15af-55b5-b224-6282b5c39c13'])
 for(const draft of manifest.drafts){const source=sources.rows.find(r=>r.id===draft.textId);assert.equal(draft.textVersion,sitovHash(source.text));assert.equal(draft.active,false);assert.equal(draft.definition.tasks.length,24);assert.equal(draft.definition.reviewForms[0].questionIds.length,12);assert.equal(draft.definition.reviewForms[1].questionIds.length,12)}
 assert.deepEqual(sitovValidatePretestDrafts(manifest,sources),[])
})
const negatives=[
 ['published/global/private mismatch',m=>{m.active=true;m.private=false}],
 ['foreign draft source',m=>{m.drafts[0].textId=m.inactiveLegacy[0].textId}],
 ['changed raw text fingerprint',m=>{m.drafts[0].textVersion='0'.repeat(64)}],
 ['cross-text source span',m=>{m.drafts[0].definition.tasks[0].sourceSpans=m.drafts[1].definition.tasks[0].sourceSpans}],
 ['offset mutation',m=>{m.drafts[0].definition.tasks[0].sourceSpans[0].start++}],
 ['missing essential matrix',m=>{m.drafts[0].definition.competencies.pop()}],
 ['unassessed invented matrix unit',m=>{m.drafts[3].definition.competencies[0].languageUnits.push('invented generic skill')}],
 ['foreign assessment unit',m=>{m.drafts[4].definition.tasks[0].assessmentUnit='foreign lexical skill'}],
 ['missing form IDs',m=>{delete m.drafts[5].definition.reviewForms[1].questionIds}],
 ['false human review of independent agent-reviewed draft',m=>{m.drafts[3].review.humanReview=true}],
 ['short one-form-only pool',m=>{m.drafts[0].definition.tasks=m.drafts[0].definition.tasks.filter(q=>!q.id.endsWith('words.q6'))}],
 ['invented optional mapping',m=>{m.drafts[0].definition.competencies[0].mapping.topicIds=['sitov.topic.invented']}],
 ['no mapping and no explicit gap',m=>{m.drafts[0].definition.competencies[0].mapping={topicIds:[]}}],
 ['no item rationale',m=>{m.drafts[0].definition.tasks[0].rationaleDe=''}],
 ['missing correct option',m=>{m.drafts[0].definition.tasks[0].correctOptionId='sitov.foreign'}],
 ['duplicate option meaning/text',m=>{m.drafts[0].definition.tasks[0].options[1].textDe=m.drafts[0].definition.tasks[0].options[0].textDe}],
 ['generic repeated item with new IDs',m=>{const a=m.drafts[0].definition.tasks[0],b=m.drafts[0].definition.tasks[1];b.promptDe=a.promptDe;b.equivalenceKey='changed-id';b.assessmentUnit='changed-unit'}],
 ['equivalent paraphrase keeps assessed unit',m=>{const a=m.drafts[0].definition.tasks[0],b=m.drafts[0].definition.tasks[1];b.assessmentUnit=a.assessmentUnit;b.equivalenceKey=a.equivalenceKey;b.promptDe='Wähle dieselbe Bedeutung.'}],
 ['retake shares question',m=>{m.drafts[0].definition.reviewForms[1].questionIds[0]=m.drafts[0].definition.reviewForms[0].questionIds[0]}],
 ['unbalanced form with foreign task',m=>{m.drafts[0].definition.reviewForms[0].questionIds[0]=m.drafts[1].definition.tasks[0].id}],
 ['missing omitted-category justification',m=>{m.drafts[0].definition.omittedCategories[0].reasonDe=''}],
 ['inventory duplicates/missing source',m=>{m.inventory[1]=m.inventory[0]}],
 ['false coverage or completed review',m=>{m.coverage.authored=60;m.drafts[0].review.status='teacher_approved'}],
]
for(const [name,mutate] of negatives)test('reject '+name,()=>assert.ok(validate(mutate).length>0))
test('no public task field contains private keys, rationale, evidence, or complete stored source',()=>{
 for(const draft of manifest.drafts)for(const task of draft.definition.tasks){const publicTask={id:task.id,competencyId:task.competencyId,kind:task.kind,promptDe:task.promptDe,fragmentDe:task.fragmentDe,options:task.options};assert.equal(Object.hasOwn(publicTask,'correctOptionId'),false);assert.equal(Object.hasOwn(publicTask,'sourceSpans'),false);assert.equal(Object.hasOwn(publicTask,'rationaleDe'),false);assert.ok(!JSON.stringify(publicTask).includes(sources.rows.find(r=>r.id===draft.textId).text))}
})

test('new sources require their actual distinct pronoun, direction/local case and separable-verb evidence',()=>{
 const manifest=sitovBeforeMapping

 const [neighbor,park,room]=manifest.drafts.slice(3,6)
 assert.equal(manifest.coverage.authored,12);assert.equal(manifest.coverage.pending,48)
 for(const draft of [neighbor,park,room]){assert.equal(draft.review.status,'independent_editorial_checked_draft_only');assert.equal(draft.review.humanReview,false);assert.equal(draft.review.calibrationStatus,'pending');assert.equal(draft.definition.competencies.length,4);assert.equal(new Set(draft.definition.tasks.map(q=>q.assessmentUnit)).size,24)}
 const key=(draft,suffix)=>{const q=draft.definition.tasks.find(q=>q.id.endsWith(suffix));return q.options.find(o=>o.id===q.correctOptionId).textDe}
 assert.equal(key(neighbor,'nominal.q5'),'Die höflich angesprochene Person.')
 assert.equal(key(neighbor,'nominal.q6'),'Den zuvor genannten Leon.')
 assert.ok(!neighbor.definition.omittedCategories.some(c=>c.category==='indirect_objects'))
 assert.equal(key(park,'nominal.q1'),'den');assert.equal(key(park,'nominal.q2'),'einer')
 assert.equal(key(room,'verbs.q5'),'anmachen');assert.equal(key(room,'syntax.q5'),'die Lampe an')
 assert.ok(!room.definition.omittedCategories.some(c=>c.category==='separable_verbs'))
 assert.ok(room.definition.competencies.find(c=>c.category==='verb_forms').mapping.topicIds.includes('sitov.topic.trennbare-verben'))
 for(const draft of [neighbor,park,room])for(const q of draft.definition.tasks)assert.ok(!q.options.some(o=>/\b(Frau|Nachbarin|Freundin|Lehrerin|Schülerin)\b/u.test(o.textDe)))
})

test('audio alias validation rejects missing, changed, extra and private spoken fields',()=>{
 const expected=sitovPublicPretestAudioAliases(manifest),first=Object.keys(expected)[0]
 assert.deepEqual(sitovValidatePretestAudioAliases(manifest,expected),[])
 const missing={...expected};delete missing[first];assert.ok(sitovValidatePretestAudioAliases(manifest,missing).length)
 assert.ok(sitovValidatePretestAudioAliases(manifest,{...expected,[first]:'changed'}).length)
 assert.ok(sitovValidatePretestAudioAliases(manifest,{...expected,'sitov.private.rationale':manifest.drafts[3].definition.tasks[0].rationaleDe}).length)
 const publicCopy=structuredClone(manifest);publicCopy.drafts[3].definition.tasks[0].rationaleDe='Private changed rationale';publicCopy.drafts[3].definition.tasks[0].correctOptionId='sitov.private.key';assert.deepEqual(sitovPublicPretestAudioAliases(publicCopy),expected)
})

test('actually absent nominal category accepted only with explicit reason and matching balanced forms',()=>{
 const errors=validate(m=>{m.drafts[0].review={status:'author_checked_teacher_review_pending',reviewer:'sitov.fixture.author',notesDe:'Synthetic category absence shape, pending independent review.'};const d=m.drafts[0].definition,core=d.competencies.find(c=>c.category==='nominal_forms'),ids=new Set(d.tasks.filter(q=>q.competencyId===core.id).map(q=>q.id));d.competencies=d.competencies.filter(c=>c.id!==core.id);d.tasks=d.tasks.filter(q=>!ids.has(q.id));for(const f of d.reviewForms)f.questionIds=f.questionIds.filter(id=>!ids.has(id));d.omittedCategories.push({category:'nominal_forms',reasonDe:'Synthetic validator case: source category absence must be checked by an independent editor.'})})
 assert.deepEqual(errors,[])
})
test('version-qualified independent review shape allowed; self-review or stale definition evidence rejected',()=>{
 const setReview=m=>{const draft=m.drafts[0];draft.review={status:'independent_approved',reviewer:'sitov.fixture.independent.editor',authorIdentity:'sitov.fixture.author',notesDe:'Synthetic provenance shape only, not an actual teaching approval.',textVersion:draft.textVersion,definitionContentHash:sitovHash(JSON.stringify(draft.definition)),documentRef:'sitov.editorial.review.fixture',documentSha256:'a'.repeat(64),reviewedAt:'2026-10-08T00:00:00Z'}}
 assert.deepEqual(validate(setReview),[])
 assert.ok(validate(m=>{setReview(m);m.drafts[0].review.authorIdentity=m.drafts[0].review.reviewer}).length)
 assert.ok(validate(m=>{setReview(m);m.drafts[0].review.definitionContentHash='0'.repeat(64)}).length)
})

test('all 1152 German audio aliases match public fields; original first288 and review remain frozen',async()=>{
 const manifest=sitovBeforeMapping

 const frozen=sitovFrozenAudio12,extracted={}
 for(const draft of manifest.drafts)for(const q of draft.definition.tasks){const prefix=`sitov-pretest:${draft.textId}:${q.id}`;extracted[prefix+':prompt']=q.promptDe;if(q.fragmentDe?.trim())extracted[prefix+':fragment']=q.fragmentDe;for(const option of q.options)extracted[prefix+':'+option.id]=option.textDe}
 assert.equal(Object.keys(extracted).length,1152);assert.deepEqual(extracted,frozen);assert.equal(new Set(Object.values(Object.fromEntries(Object.entries(sitovBeforeRepairAliases(frozen)).slice(0,576)))).size,486)
 const first=Object.fromEntries(Object.entries(frozen).slice(0,288));assert.equal(Object.keys(first).length,288);assert.equal(new Set(Object.values(first)).size,253)
 assert.equal(sitovHash(JSON.stringify(first)),'9dbf9e8b9c3ec4b6858cfe41d7626ad145d8f57c5fef5f405fe95c6a3fa3caff')
 assert.equal(sitovHash(JSON.stringify(manifest.drafts.slice(0,3))),'64ef9ff63db660b92316c30d41b47eced8d84855e9ae3b68d071759169f75f45')
 for(const draft of manifest.drafts)for(const q of draft.definition.tasks){assert.ok(!Object.values(frozen).includes(q.rationaleDe));assert.ok(!Object.values(frozen).includes(q.id));assert.ok(!Object.values(frozen).includes(q.correctOptionId))}
 const record=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/first3-editorial-review-epoch10.json','utf8'));assert.equal(record.humanReview,false)
 for(const draft of manifest.drafts.slice(0,3)){assert.equal(draft.review.reviewerKind,'independent_agent_editorial_review');assert.equal(draft.review.humanReview,false);assert.equal(draft.review.status,'independent_editorial_checked_draft_only');assert.equal(draft.review.calibrationStatus,'pending');assert.equal(draft.review.definitionContentHash,record.approvedEditorialDrafts.find(r=>r.textId===draft.textId).definitionContentHash)}
 assert.ok(validate(m=>{m.drafts[0].review.humanReview=true}).length)
 assert.ok(validate(m=>{m.drafts[0].review=structuredClone(sitovBeforeMapping.drafts[0].review)}).some(error=>error.endsWith('independent exact-version review provenance required')))
})


test('original first6 records/576aliases reconstruct exactly after authorized repairs; actual raw references retained',async()=>{
 assert.equal(sitovHash(JSON.stringify(sitovBeforeRepair.drafts.slice(0,6))),'52af41c01a3b588ddbcc38e7ff43d4f0b6c9b12d1debe12335e2f293f387054d')
 const audio=sitovFrozenAudio12
 assert.equal(sitovHash(JSON.stringify(Object.fromEntries(Object.entries(sitovBeforeRepairAliases(audio)).slice(0,576)))),'69fa19b3b1851f749b16f80e85f1d32aa87399095b8b79155fe42b4480519d4e')
 const references=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/batch7-9-reference-audio-input.json','utf8'));assert.equal(Object.keys(references).length,3)
 for(const d of manifest.drafts.slice(6,9)){assert.equal(references['sitov-pretest-reference:'+d.textId],sources.rows.find(r=>r.id===d.textId).text);assert.equal(sitovHash(references['sitov-pretest-reference:'+d.textId]),d.textVersion)}
})
test('new source-specific seller/family/route keys and evidence reflect actual revised passages',()=>{
 const manifest=sitovBeforeMapping

 const [shop,family,route]=manifest.drafts.slice(6,9),key=(d,suffix)=>{const q=d.definition.tasks.find(q=>q.id.endsWith(suffix));return q.options.find(o=>o.id===q.correctOptionId).textDe}
 for(const d of [shop,family,route]){assert.equal(d.definition.competencies.length,4);assert.equal(new Set(d.definition.tasks.map(q=>q.assessmentUnit)).size,24);assert.equal(d.review.status,'independent_editorial_checked_draft_only');assert.notEqual(d.review.authorIdentity,d.review.reviewer);assert.equal(d.review.humanReview,false);assert.equal(d.review.calibrationStatus,'pending');assert.equal(d.active,false);assert.ok(!Object.hasOwn(d,'approval'));assert.ok(!Object.hasOwn(d,'preparedAudioProof'))}
 assert.equal(key(shop,'nominal.q5'),'Den Sprecher, dem das Brot gezeigt wird.');assert.equal(key(shop,'syntax.q3'),'Der Preis des Brotes beträgt zwei Euro.');assert.equal(key(shop,'nominal.q6'),'Meine')
 assert.equal(key(family,'nominal.q2'),'meiner');assert.equal(key(family,'nominal.q4'),'Den Onkel Mark.');assert.equal(key(family,'syntax.q4'),'Der Vater Oleg.');assert.equal(key(family,'words.q4'),'20 Jahre.')
 assert.equal(key(route,'verbs.q5'),'aussteigen');assert.equal(key(route,'nominal.q2'),'dem');assert.equal(key(route,'nominal.q5'),'der');assert.equal(key(route,'syntax.q1'),'Der Sprecher geht um acht weg; der Kurs beginnt um neun.')
 assert.ok(route.definition.competencies.find(c=>c.category==='verb_forms').mapping.topicIds.includes('sitov.topic.trennbare-verben'))
 for(const d of [shop,family,route])for(const q of d.definition.tasks)assert.ok(!q.options.some(o=>/\b(Frau|Nachbarin|Freundin|Lehrerin|Schülerin|Mutter|Schwester)\b/u.test(o.textDe)))
})

test('only M-confirmed33 repairs change first9; original baseline and final10–12 proof remain exact',async()=>{
 const manifest=sitovBeforeMapping

 const finalReviewRaw=await readFile('docs/releases/evidence/sitov-night-2026-10-08/pretest-first9-final-context-review.json','utf8'),finalReview=JSON.parse(finalReviewRaw)
 assert.equal(sitovHash(finalReviewRaw),'f8b0b262b11aeaf47ead7f591cafd166d7cc60979ee21abe1d1f4a1b299ebf12');assert.equal(finalReview.rows.length,6);assert.equal(finalReview.publicationAuthorized,false)
 for(const d of manifest.drafts.slice(3,9)){const row=finalReview.rows.find(r=>r.textId===d.textId);assert.equal(d.review.status,'independent_editorial_checked_draft_only');assert.equal(d.review.textVersion,row.textVersion);assert.equal(d.review.definitionContentHash,row.definitionContentHash);assert.equal(d.review.definitionContentHash,sitovHash(JSON.stringify(d.definition)));assert.equal(d.review.documentRef,finalReview.documentRef);assert.equal(d.review.documentSha256,sitovHash(finalReviewRaw));assert.equal(d.review.reviewedAt,finalReview.reviewedAt);assert.equal(d.review.reviewer,finalReview.reviewer);assert.equal(d.review.reviewerKind,finalReview.reviewerKind);assert.equal(d.review.authorIdentity,finalReview.authorIdentity);assert.equal(d.review.humanReview,false);assert.equal(d.review.calibrationStatus,'pending')}
 const master=JSON.parse(await readFile(sitovRepair24.masterConfirmedFindingsRef,'utf8'))
 assert.equal(sitovHash(await readFile(sitovRepair24.masterConfirmedFindingsRef,'utf8')),sitovRepair24.masterConfirmedFindingsSha256)
 assert.deepEqual([...sitovRepair24.changedQuestions.map(r=>r.questionId)].sort(),master.rows.filter(r=>r.result!=='M_context_only_no_additional_blocker_found').map(r=>r.questionId).sort())
 assert.equal(sitovFinal25.questionId,'sitov.pretest.a11-05.syntax.q5');assert.equal(sitovFinal25.currentTask.promptDe,'Übung: »Im Gras spielt ein kleiner Hund.« Welches Wort wird durch »kleiner« genauer beschrieben?')
 assert.deepEqual(sitovFinal25.previousTask,sitovRepair24.changedQuestions.find(r=>r.questionId===sitovFinal25.questionId).currentTask)
 assert.deepEqual({...sitovFinal25.currentTask,promptDe:sitovFinal25.previousTask.promptDe},sitovFinal25.previousTask)
 assert.equal(sitovHash(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/first9-visible-context-repair-delta-epoch24.json','utf8')),sitovFinal25.historicalEpoch24DeltaSha256)
 assert.equal(sitovRepair24.changedQuestions.length,33);assert.equal(sitovRepair24.changedAliases.length,39);assert.equal(sitovRepair24.correctOptionIdsChanged,0);assert.equal(sitovRepair24.correctOptionTextsChanged,2)
 for(const row of sitovRepair24.changedQuestions){const q=manifest.drafts.flatMap(d=>d.definition.tasks).find(q=>q.id===row.questionId);assert.deepEqual(q,q.id===sitovFinal25.questionId?sitovFinal25.currentTask:row.currentTask);assert.equal(q.correctOptionId,row.previousTask.correctOptionId);assert.deepEqual({...q,promptDe:row.previousTask.promptDe,rationaleDe:row.previousTask.rationaleDe,options:row.previousTask.options},row.previousTask)}
 for(const pool of sitovRepair24.changedPools){const d=manifest.drafts.find(d=>d.textId===pool.textId);assert.equal(sitovHash(JSON.stringify(d.definition)),d.textId===sitovFinal25.textId?sitovFinal25.newDefinitionHash:pool.newDefinitionHash);assert.equal(d.review.status,'independent_editorial_checked_draft_only');assert.equal(d.review.reviewer,'sitov.agent.M');assert.equal(d.review.humanReview,false);assert.equal(d.review.calibrationStatus,'pending');assert.equal(d.active,false)}
 assert.equal(sitovHash(JSON.stringify(manifest.drafts.slice(9))),'5d1b19f3ead1bf62163e537dfd3b18d4bdaea534ded879789924d01c80acc156')
 assert.equal(manifest.drafts[6].definition.tasks.find(q=>q.id.endsWith('verbs.q6')).promptDe,'Welche Person gehört zur Form »bezahle« im Präsens Indikativ?')
 assert.equal(sitovHash(JSON.stringify(sitovBeforeRepair.drafts.slice(0,9))),'6587cc7b0e0da041b3056a4636f2d40863dbf97991e830f60402286a0a1bdfd8')
 const aliases=sitovFrozenAudio12;assert.equal(sitovHash(JSON.stringify(Object.fromEntries(Object.entries(sitovBeforeRepairAliases(aliases)).slice(0,864)))),'cd43a267a98050a19e6092ba622ef0bdc14e6398c459e92bff1c0481c4828be4')
 const refs=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/batch10-12-reference-audio-input.json','utf8'));assert.equal(Object.keys(refs).length,3)
 for(const d of manifest.drafts.slice(9)){assert.equal(refs['sitov-pretest-reference:'+d.textId],sources.rows.find(r=>r.id===d.textId).text);assert.equal(sitovHash(refs['sitov-pretest-reference:'+d.textId]),d.textVersion);assert.equal(d.review.humanReview,false);assert.equal(d.review.calibrationStatus,'pending');assert.equal(d.review.status,'independent_editorial_checked_draft_only');assert.equal(d.review.reviewer,'sitov.agent.M');assert.equal(d.review.reviewerKind,'independent_agent_editorial_review');assert.equal(d.review.authorIdentity,'sitov.agent.S3');assert.equal(d.review.definitionContentHash,sitovHash(JSON.stringify(d.definition)));assert.equal(d.review.documentSha256,'4d07d5c28c675f46bdf827adc8887ef3de0e2190180922f66d1775f7129c3945');assert.equal(d.definition.competencies.length,4)}
 const proofRaw=await readFile('docs/releases/evidence/sitov-night-2026-10-08/pretest10-12-final-editorial-review.json','utf8'),proof=JSON.parse(proofRaw);assert.equal(sitovHash(proofRaw),'4d07d5c28c675f46bdf827adc8887ef3de0e2190180922f66d1775f7129c3945')
 for(const d of manifest.drafts.slice(9)){const row=proof.rows.find(r=>r.textId===d.textId);assert.equal(d.review.textVersion,row.textVersion);assert.equal(d.review.definitionContentHash,row.definitionContentHash);assert.equal(d.review.documentRef,proof.documentRef);assert.equal(d.review.reviewedAt,proof.reviewedAt);assert.equal(d.review.reviewer,proof.reviewer)}
 assert.deepEqual(manifest.drafts.slice(9).map(d=>[d.level,sources.rows.find(r=>r.id===d.textId).sortOrder]),[['A1.1',10],['A1.2',1],['A1.2',2]])
})
test('actual evening/doctor/cooking clauses determine keys, pronoun reference, cases and split verbs',()=>{
 const manifest=sitovBeforeMapping

 const [evening,doctor,cooking]=manifest.drafts.slice(9),key=(d,suffix)=>{const q=d.definition.tasks.find(q=>q.id.endsWith(suffix));return q.options.find(o=>o.id===q.correctOptionId).textDe}
 assert.equal(key(evening,'nominal.q3'),'kleines');assert.equal(key(evening,'nominal.q5'),'in das Bett');assert.equal(key(evening,'words.q6'),'Um 10 Uhr.')
 assert.equal(key(doctor,'verbs.q1'),'wehtun');assert.equal(key(doctor,'verbs.q5'),'mitnehmen');assert.equal(key(doctor,'nominal.q5'),'Auf den Namen des Sprechers.');assert.equal(key(doctor,'nominal.q6'),'warmen')
 assert.equal(key(cooking,'verbs.q6'),'aufräumen');assert.equal(key(cooking,'nominal.q6'),'den');assert.equal(key(cooking,'syntax.q4'),'Karotten werden gewaschen und Kartoffeln geschnitten.')
 for(const d of [evening,doctor,cooking]){assert.equal(new Set(d.definition.tasks.map(q=>q.assessmentUnit)).size,24);for(const q of d.definition.tasks)assert.ok(!q.options.some(o=>/\b(Frau|Mitarbeiterin|Freundin|Lehrerin|Schülerin)\b/u.test(o.textDe)))}
 assert.ok(doctor.definition.competencies.find(c=>c.category==='verb_forms').mapping.topicIds.includes('sitov.topic.modalverben'));assert.ok(cooking.definition.competencies.find(c=>c.category==='verb_forms').mapping.topicIds.includes('sitov.topic.trennbare-verben'))
})

test('batch10–12 public-premise regression: formerly hidden facts have explicit practice contexts; author audit covers all72',async()=>{
 const audit=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/batch10-12-visible-context-epoch21.json','utf8'))
 const tasks=manifest.drafts.slice(9).flatMap(d=>d.definition.tasks)
 const delta=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/batch10-12-final-wording-delta-epoch22.json','utf8'))
 assert.equal(delta.changedQuestions.length,5);assert.equal(delta.aliasesChanged,4);assert.equal(delta.humanReview,false);assert.equal(delta.calibrationStatus,'pending')
 const current=new Map(delta.changedQuestions.map(row=>[row.questionId,row.currentTask]))
 for(const row of delta.changedQuestions){assert.equal(row.keyIdUnchanged,true);assert.deepEqual(tasks.find(q=>q.id===row.questionId),row.currentTask)}
 assert.equal(audit.questions.length,72);assert.equal(audit.changedQuestionCount,30)
 assert.deepEqual(audit.questions.map(q=>q.questionId),tasks.map(q=>q.id))
 assert.equal(audit.status,'author_checked_independent_review_pending');assert.equal(audit.humanReview,false);assert.equal(audit.calibrationStatus,'pending')
 const required={
  'a11-10.words.q6':'um zehn Uhr','a11-10.syntax.q1':'Auf dem Tisch liegt ein Handy','a11-10.syntax.q2':'Heute / ich / lese / ein Buch','a11-10.syntax.q3':'Eine Katze schläft auf dem Sofa','a11-10.syntax.q4':'Paul trinkt Wasser und hört Musik',
  'a12-01.syntax.q1':'Seit gestern habe ich Durst','a12-01.syntax.q2':'möchte einen Termin beim Arzt vereinbaren','a12-01.syntax.q3':'Nach meinem Namen fragt der Mitarbeiter','a12-01.syntax.q4':'Ein Termin ist am Nachmittag frei','a12-01.syntax.q6':'bleibe ich zu Hause und trinke warmen Tee','a12-01.nominal.q5':'Ich nenne meinen Namen. Dann buchstabiere ich ihn',
  'a12-02.syntax.q1':'Paul sagt: Zwei Freunde kommen zu mir','a12-02.syntax.q2':'Wir möchten gemeinsam eine Suppe kochen','a12-02.syntax.q3':'Zuerst kaufen wir Gemüse. Dann waschen wir die Karotten','a12-02.syntax.q4':'Die Kartoffeln schneiden wir. Die Karotten waschen wir','a12-02.syntax.q5':'Wasser kocht mein Freund; den Tisch decke ich','a12-02.syntax.q6':'Wir essen Brot. Später räumen wir die Küche auf'
 }
 for(const [suffix,premise] of Object.entries(required)){const q=tasks.find(q=>q.id==='sitov.pretest.'+suffix);assert.ok(q.promptDe.includes(premise));assert.equal(q.fragmentDe,null)}
 for(const [i,q] of tasks.entries()){assert.equal(audit.questions[i].publicPromptDe,q.promptDe);assert.deepEqual(current.get(q.id)?.options ?? audit.questions[i].publicOptions,q.options);assert.equal(audit.questions[i].keyIdUnchanged,true);assert.equal(audit.questions[i].independentReview,'pending_M')}
 // These assertions prevent loss of reviewed public context; they do not certify pedagogy.
})

test('complete essential-category matrix accepts an empty omission list without inventing content',()=>{
 const errors=validate(m=>{const draft=m.drafts[0];draft.review={status:'author_checked_teacher_review_pending',reviewer:'sitov.fixture.author',notesDe:'Synthetic omission-contract fixture; no editorial or publication approval.'};draft.definition.omittedCategories=[]})
 assert.deepEqual(errors,[])
})
test('omission reasons remain substantive and missing categories cannot disappear silently',()=>{
 const pending=draft=>{draft.review={status:'author_checked_teacher_review_pending',reviewer:'sitov.fixture.author',notesDe:'Synthetic omission-contract fixture; no editorial or publication approval.'}}
 for(const reasonDe of ['Kurz.','                  Kurz.                  ','🙂'.repeat(10)]){
  const errors=validate(m=>{const draft=m.drafts[0];pending(draft);draft.definition.omittedCategories[0].reasonDe=reasonDe})
  assert.ok(errors.some(error=>error.endsWith('absent categories need reasons')))
 }
 const errors=validate(m=>{const draft=m.drafts[0];pending(draft);const d=draft.definition,core=d.competencies.find(c=>c.category==='nominal_forms'),removed=new Set(d.tasks.filter(q=>q.competencyId===core.id).map(q=>q.id));d.competencies=d.competencies.filter(c=>c.id!==core.id);d.tasks=d.tasks.filter(q=>!removed.has(q.id));for(const form of d.reviewForms)form.questionIds=form.questionIds.filter(q=>!removed.has(q));d.omittedCategories=[]})
 assert.ok(errors.some(error=>error.endsWith('missing matrix or justified absence nominal_forms')))
})


test('known cross-level topics are rejected in both directions despite existing canonical IDs',()=>{
 const originalErrors=sitovValidatePretestDrafts(sitovBeforeMapping,sources)
 assert.equal(originalErrors.filter(error=>error.endsWith('same-level topic mapping required')).length,4)

 for(const [index,category,topic] of [[4,'vocabulary','sitov.topic.zeit'],[10,'verb_forms','sitov.topic.trennbare-verben'],[11,'verb_forms','sitov.topic.trennbare-verben'],[11,'nominal_forms','sitov.topic.akkusativ']]){
  assert.ok(sources.topicIds.has(topic))
  assert.ok(validate(m=>{m.drafts[index].definition.competencies.find(c=>c.category===category).mapping.topicIds=[topic]}).some(error=>error.endsWith('same-level topic mapping required')))
 }
})
test('current partial mappings use canonical same-level evidence and retain exact uncovered gaps',()=>{
 assert.equal(sources.topicLevels.size,20)
 assert.deepEqual([...sources.topicLevels.values()].slice(16),['A2.1','A2.2','B1.1','B1.2'])
 assert.deepEqual(sitovValidatePretestDrafts(manifest,sources),[])
 for(const draft of manifest.drafts)for(const core of draft.definition.competencies){
  for(const topic of core.mapping.topicIds)assert.equal(sources.topicLevels.get(topic),draft.level)
  assert.ok(core.mapping.pendingReasonDe.length>40)
 }
 assert.deepEqual(manifest.drafts[8].definition.competencies.find(c=>c.category==='nominal_forms').mapping.topicIds,[])
 for(const draft of manifest.drafts.slice(10))assert.deepEqual(draft.definition.competencies.find(c=>c.category==='verb_forms').mapping.topicIds,[])
 assert.deepEqual(manifest.drafts[11].definition.competencies.find(c=>c.category==='vocabulary').mapping.topicIds,[])
 assert.deepEqual(manifest.drafts[8].definition.competencies.find(c=>c.category==='vocabulary').mapping.topicIds,['sitov.topic.tageszeit-a11'])
 assert.deepEqual(manifest.drafts[6].definition.competencies.find(c=>c.category==='nominal_forms').mapping.topicIds,['sitov.topic.nominativ'])
 assert.deepEqual(manifest.drafts[10].definition.competencies.find(c=>c.category==='vocabulary').mapping.topicIds,['sitov.topic.gesundheit-a12'])
})
test('explicit epoch33 delta exactly reconstructs frozen history while only mapping and honest pending review change',async()=>{
 assert.equal(sitovHash(JSON.stringify(sitovBeforeMapping)),sitovMapping33.previousManifestContentHash)
 assert.equal(sitovHash(JSON.stringify(sitovBeforeMapping,null,2)+'\n'),sitovMapping33.previousManifestByteSha256)
 assert.equal(sitovHash(JSON.stringify(manifest,null,2)+'\n'),sitovMapping33.currentManifestByteSha256)
 assert.equal(sitovHash(JSON.stringify(manifest)),sitovMapping33.currentManifestContentHash)
 const mappingRaw=await readFile('lib/learning/sitov-topic-mapping.ts','utf8'),array=mappingRaw.match(/export const SITOV_TOPIC_MAPPING[^=]*=\s*(\[[\s\S]*?\n\])/u)[1]
 const priorMapping=mappingRaw.replace("import type { AccessLevel } from '@/lib/access/levels'\n\n",'').replace('export type SitovMappedLevel = AccessLevel',"export type SitovMappedLevel = 'A1.1' | 'A1.2'").replace(array,JSON.stringify(JSON.parse(array).slice(0,16),null,2))
 assert.equal(sitovHash(priorMapping),sitovMapping33.sourceMappingSha256)
 assert.equal(sitovMapping33.changedPools.length,12)
 assert.equal(sitovMapping33.spokenFieldsChanged,0);assert.equal(sitovMapping33.keysChanged,0)
 for(const row of sitovMapping33.changedPools){
  const current=manifest.drafts.find(d=>d.textId===row.textId),previous=sitovBeforeMapping.drafts.find(d=>d.textId===row.textId)
  assert.equal(sitovHash(JSON.stringify(previous.definition)),row.previousDefinitionContentHash)
  assert.equal(sitovHash(JSON.stringify(current.definition)),row.currentDefinitionContentHash)
  assert.notEqual(row.previousDefinitionContentHash,row.currentDefinitionContentHash)
  assert.deepEqual(current.review,row.currentReview)
  assert.equal(current.review.status,'author_checked_independent_review_pending')
  assert.equal(current.review.reviewer,'sitov.agent.S3');assert.equal(current.review.authorIdentity,'sitov.agent.S3')
  assert.equal(current.review.humanReview,false);assert.equal(current.review.calibrationStatus,'pending')
  assert.equal(current.review.definitionContentHash,row.currentDefinitionContentHash)
  assert.equal(Object.hasOwn(current.review,'documentRef'),false)
  const restored=structuredClone(current);restored.review=row.previousReview
  for(const core of row.cores){const actual=restored.definition.competencies.find(c=>c.id===core.coreId);assert.deepEqual(actual.mapping,core.currentMapping);actual.mapping=core.previousMapping}
  assert.deepEqual(restored,previous)
 }
 const audioRaw=JSON.stringify(sitovFrozenAudio12,null,2)+'\n'
 assert.equal(sitovHash(audioRaw),sitovMapping33.audioAliasByteSha256)
 assert.equal(sitovHash(JSON.stringify(JSON.parse(audioRaw))),sitovMapping33.audioAliasContentHash)
 assert.deepEqual(sitovPublicPretestAudioAliases(manifest),sitovPublicPretestAudioAliases(sitovBeforeMapping))
})


test('current exact M review composes unchanged prior independently reviewed tasks and checked metadata without publication',async()=>{
 const path='docs/handoffs/SITOV-NIGHT-2026-10-08/M/core-mapping-editorial-review.json',raw=await readFile(path,'utf8'),proof=JSON.parse(raw)
 assert.equal(proof.humanReview,false);assert.equal(proof.calibrationStatus,'pending');assert.equal(proof.publicationAuthorized,false);assert.equal(proof.coresChecked,48)
 assert.deepEqual(sitovValidatePretestDrafts(currentManifest,sources),[])
 for(const d of originalManifest.drafts){
  const record=proof.approvedEditorialDrafts.find(r=>r.textId===d.textId),pending=manifest.drafts.find(r=>r.textId===d.textId)
  assert.deepEqual(d.definition,pending.definition);assert.equal(record.definitionContentHash,sitovHash(JSON.stringify(d.definition)))
  assert.equal(d.review.documentSha256,sitovHash(raw));assert.equal(d.review.documentRef,proof.documentRef);assert.equal(d.review.reviewer,proof.reviewer);assert.equal(d.review.authorIdentity,proof.authorIdentity)
  assert.notEqual(d.review.reviewer,d.review.authorIdentity);assert.equal(d.review.textVersion,d.textVersion);assert.equal(d.review.definitionContentHash,record.definitionContentHash)
  assert.equal(d.review.humanReview,false);assert.equal(d.review.calibrationStatus,'pending');assert.equal(d.active,false)
  for(const file of record.priorReviewDocuments)assert.equal(sitovHash(await readFile(file,'utf8')),record.priorReview.documentSha256)
  assert.equal(record.previousDefinitionContentHash,record.priorReview.definitionContentHash);assert.equal(record.nonMappingFieldsExactlyUnchanged,true)
 }
 const stale=structuredClone(currentManifest);stale.drafts[0].definition.tasks[0].correctOptionId='sitov.changed.key'
 assert.ok(sitovValidatePretestDrafts(stale,sources).some(e=>e.endsWith('independent exact-version review provenance required')))
 assert.deepEqual(sitovPublicPretestAudioAliases(originalManifest),sitovPublicPretestAudioAliases(manifest))
})


test('source reader accepts central levels and rejects forged level, mixed-level and duplicate topic metadata',async()=>{
 const fs=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join,resolve}=await import('node:path')
 const dir=await fs.mkdtemp(join(tmpdir(),'sitov-topic-source-'))
 try{
  await fs.mkdir(join(dir,'supabase'),{recursive:true});await fs.symlink(resolve('supabase/seeds'),join(dir,'supabase/seeds'))
  await fs.mkdir(join(dir,'lib/access'),{recursive:true});await fs.mkdir(join(dir,'lib/learning'),{recursive:true})
  const access=await readFile('lib/access/levels.ts','utf8'),mapping=await readFile('lib/learning/sitov-topic-mapping.ts','utf8')
  await fs.writeFile(join(dir,'lib/access/levels.ts'),access);await fs.writeFile(join(dir,'lib/learning/sitov-topic-mapping.ts'),mapping)
  const valid=await sitovReadAuthoringSources(dir);assert.equal(valid.rows.filter(r=>r.active).length,60);assert.equal(valid.topicLevels.size,20)
  for(const invalid of [mapping.replace('"level": "A2.1"','"level": "Z9.9"'),mapping.replace('"level": "A2.1"','"level": "B1.2"'),mapping.replace('sitov.topic.begruenden-a21','sitov.topic.nominativ')]){
   await fs.writeFile(join(dir,'lib/learning/sitov-topic-mapping.ts'),invalid);await assert.rejects(sitovReadAuthoringSources(dir),/Invalid canonical topic-level evidence/)
  }
  await fs.writeFile(join(dir,'lib/access/levels.ts'),access.replace("  'A1.1',","  'INVALID',"));await assert.rejects(sitovReadAuthoringSources(dir),/Invalid canonical access-level evidence/)
 }finally{await fs.rm(dir,{recursive:true,force:true})}
})


test('next three actual A1.2 sources append15/60 inactive pools with frozen12 Mreviews and1152aliases intact',()=>{
 assert.equal(sitovAuthor35.drafts.length,15);assert.deepEqual(sitovAuthor35.coverage,{total:60,authored:15,pending:45})
 assert.equal(sitovHash(JSON.stringify(originalManifest.drafts)),sitovEpoch34.original12ContentHash)
 assert.equal(sitovHash(JSON.stringify(originalManifest)),sitovEpoch34.originalManifestContentHash)
 assert.equal(sitovHash(JSON.stringify(sitovFrozenAudio12)),sitovEpoch34.original1152AliasContentHash)
 assert.equal(sitovHash(JSON.stringify(sitovFrozenAudio12,null,2)+'\n'),sitovEpoch34.original1152AliasByteSha256)
 assert.deepEqual(sitovValidatePretestDrafts(sitovAuthor35,sources),[])
 assert.equal(Object.keys(sitovAllAudio).length,1440);assert.deepEqual(sitovValidatePretestAudioAliases(sitovAuthor35,sitovAllAudio),[])
 for(const [index,draft] of sitovAuthor35.drafts.slice(12).entries()){
  assert.equal(sources.rows.find(s=>s.id===draft.textId).sortOrder,index+3);assert.equal(draft.level,'A1.2');assert.equal(draft.active,false)
  assert.equal(draft.definition.tasks.length,24);assert.equal(draft.definition.competencies.length,4)
  assert.equal(draft.review.status,'author_checked_independent_review_pending');assert.equal(draft.review.authorIdentity,draft.review.reviewer)
  assert.equal(draft.review.humanReview,false);assert.equal(draft.review.calibrationStatus,'pending')
  assert.equal(sitovHash(JSON.stringify(sitovBefore35.drafts.find(d=>d.textId===draft.textId).definition)),sitovEpoch34.pools[index].definitionContentHash)
  assert.equal(new Set(draft.definition.tasks.map(q=>q.assessmentUnit)).size,24)
 }
})
test('new source-specific answers and public premises distinguish swim ability, invitations and market roles',()=>{
 const added=sitovBefore35.drafts.slice(12),key=(index,suffix)=>{const q=added[index].definition.tasks.find(q=>q.id.endsWith(suffix));return q.options.find(o=>o.id===q.correctOptionId).textDe}
 assert.equal(key(0,'verbs.q1'),'Der Sohn hat die Fähigkeit dazu.');assert.equal(key(0,'verbs.q3'),'einpacken');assert.equal(key(0,'nominal.q5'),'Auf den Sohn.')
 assert.equal(key(1,'syntax.q2'),'Am Samstag um vier Uhr.');assert.equal(key(1,'nominal.q4'),'Auf die Einladung.');assert.equal(key(1,'nominal.q1'),'meinen')
 assert.equal(key(2,'syntax.q4'),'Der Sprecher, bezeichnet durch mich.');assert.equal(key(2,'nominal.q5'),'Auf den Apfel.');assert.equal(key(2,'nominal.q6'),'meine')
 for(const [index,draft] of added.entries())for(const [j,q] of draft.definition.tasks.entries()){
  const audit=sitovEpoch34.pools[index].questions[j];assert.equal(audit.publicPromptDe,q.promptDe);assert.deepEqual(audit.publicOptions,q.options);assert.equal(audit.correctOptionId,q.correctOptionId);assert.equal(audit.rationaleDe,q.rationaleDe)
  assert.equal(q.fragmentDe,null);assert.ok(!q.promptDe.includes(sources.rows.find(s=>s.id===draft.textId).text))
 }
 assert.ok(added[1].definition.tasks.find(q=>q.id.endsWith('syntax.q2')).promptDe.includes('Die Feier beginnt am Samstag um vier Uhr'))
 assert.ok(added[0].definition.tasks.find(q=>q.id.endsWith('syntax.q6')).promptDe.includes('Nach einer Stunde machen wir eine Pause'))
 const sourceQuestion=added[2].definition.tasks.find(q=>q.id.endsWith('nominal.q5'));assert.ok(sourceQuestion.promptDe.includes('Ich probiere einen Apfel. Er schmeckt süß'))
})
test('new pools reject duplicated assessed units, shared retake questions and false source spans',()=>{
 for(const mutate of [m=>{m.drafts[12].definition.tasks[1].assessmentUnit=m.drafts[12].definition.tasks[0].assessmentUnit},m=>{m.drafts[13].definition.reviewForms[1].questionIds[0]=m.drafts[13].definition.reviewForms[0].questionIds[0]},m=>{m.drafts[14].definition.tasks[0].sourceSpans[0].start++}]){
  const copy=structuredClone(sitovAuthor35);mutate(copy);assert.ok(sitovValidatePretestDrafts(copy,sources).length)
 }
})


const sitovDiversityErrors=drafts=>{
 const errors=[],labelPatterns=[],positionPatterns=[]
 for(const draft of drafts)for(const core of draft.definition.competencies){
  const qs=draft.definition.tasks.filter(q=>q.competencyId===core.id)
  const labels=qs.map(q=>q.correctOptionId.split('.').at(-1)),positions=qs.map(q=>q.options.findIndex(o=>o.id===q.correctOptionId))
  if(qs.length!==6||['a','b','c'].some(label=>labels.filter(l=>l===label).length!==2))errors.push('unbalanced_labels')
  if([0,1,2].some(position=>positions.filter(p=>p===position).length!==2))errors.push('unbalanced_positions')
  labelPatterns.push(labels.join(''));positionPatterns.push(positions.join(''))
 }
 if(new Set(labelPatterns).size!==labelPatterns.length)errors.push('repeated_label_schedule')
 if(new Set(positionPatterns).size!==positionPatterns.length)errors.push('repeated_position_schedule')
 for(let index=0;index<6;index++){
  if(new Set(labelPatterns.map(pattern=>pattern[index])).size!==3)errors.push('question_index_label_pattern')
  if(new Set(positionPatterns.map(pattern=>pattern[index])).size!==3)errors.push('question_index_position_pattern')
 }
 return errors
}
test('current new72 have independently varied balanced labels and positions; prior predictable state fails',()=>{
 assert.deepEqual(sitovDiversityErrors(sitovAuthor35.drafts.slice(12)),[])
 const previous=sitovDiversityErrors(sitovBefore35.drafts.slice(12))
 assert.ok(previous.includes('unbalanced_labels'));assert.ok(previous.includes('repeated_position_schedule'))
 const allFirst=structuredClone(sitovAuthor35.drafts.slice(12))
 for(const d of allFirst)for(const q of d.definition.tasks){const correct=q.options.find(o=>o.id===q.correctOptionId);q.options=[correct,...q.options.filter(o=>o!==correct)]}
 assert.ok(sitovDiversityErrors(allFirst).includes('unbalanced_positions'))
 const allA=structuredClone(sitovAuthor35.drafts.slice(12))
 for(const d of allA)for(const q of d.definition.tasks)q.correctOptionId=q.options.find(o=>o.id.endsWith('.a')).id
 assert.ok(sitovDiversityErrors(allA).includes('unbalanced_labels'))
})
test('epoch35 exact bijections preserve each correct answer and every other task/core/source/form field',async()=>{
 assert.equal(sitovDelta35.questions.length,72);assert.equal(sitovDelta35.pools.length,3)
 assert.equal(sitovDelta35.questionRecordCount,72)
 assert.equal(sitovDelta35.changedQuestionCount,sitovDelta35.questions.filter(row=>JSON.stringify(row.previousOptions)!==JSON.stringify(row.currentOptions)||row.previousCorrectOptionId!==row.currentCorrectOptionId).length)
 assert.equal(sitovHash(JSON.stringify(sitovBefore35)),sitovDelta35.previousManifestContentHash)
 assert.equal(sitovHash(JSON.stringify(sitovBefore35,null,2)+'\n'),sitovDelta35.previousManifestByteSha256)
 assert.equal(sitovHash(JSON.stringify(sitovAuthor35)),sitovDelta35.currentManifestContentHash)
 assert.equal(sitovHash(JSON.stringify(sitovAuthor35,null,2)+'\n'),sitovDelta35.currentManifestByteSha256)
 assert.equal(sitovHash(JSON.stringify(sitovAuthor35.drafts.slice(0,12))),sitovDelta35.original12ContentHash)
 for(const row of sitovDelta35.questions){
  const actual=sitovAuthor35.drafts.find(d=>d.textId===row.textId).definition.tasks.find(q=>q.id===row.questionId)
  const previous=sitovBefore35.drafts.find(d=>d.textId===row.textId).definition.tasks.find(q=>q.id===row.questionId)
  assert.deepEqual(actual.options,row.currentOptions);assert.equal(actual.correctOptionId,row.currentCorrectOptionId)
  assert.equal(actual.options.find(o=>o.id===actual.correctOptionId).textDe,row.correctAnswerTextDe)
  assert.equal(previous.options.find(o=>o.id===previous.correctOptionId).textDe,row.correctAnswerTextDe)
  assert.equal(new Set(Object.values(row.optionIdBijection)).size,3)
  for(const option of previous.options)assert.equal(actual.options.find(o=>o.id===row.optionIdBijection[option.id]).textDe,option.textDe)
  assert.deepEqual({...actual,options:previous.options,correctOptionId:previous.correctOptionId},previous)
 }
 for(const row of sitovDelta35.pools){
  const current=sitovAuthor35.drafts.find(d=>d.textId===row.textId),previous=sitovBefore35.drafts.find(d=>d.textId===row.textId)
  assert.equal(sitovHash(JSON.stringify(current.definition)),row.currentDefinitionContentHash)
  assert.equal(sitovHash(JSON.stringify(previous.definition)),row.previousDefinitionContentHash)
  assert.equal(current.review.status,'author_checked_independent_review_pending')
  assert.deepEqual({...current.review,definitionContentHash:previous.review.definitionContentHash},previous.review)
  const restored=structuredClone(current);restored.definition.tasks=previous.definition.tasks;restored.review=previous.review;assert.deepEqual(restored,previous)
 }
 assert.deepEqual(sitovValidatePretestDrafts(sitovAuthor35,sources),[])
})
test('new option aliases follow exact bijections/order while old1152 and all German spoken values stay unchanged',async()=>{
 assert.equal(sitovHash(JSON.stringify(sitovBeforeAudio35)),sitovDelta35.previousAudioContentHash)
 assert.equal(sitovHash(JSON.stringify(sitovBeforeAudio35,null,2)+'\n'),sitovDelta35.previousAudioByteSha256)
 assert.equal(sitovHash(JSON.stringify(sitovAllAudio)),sitovDelta35.currentAudioContentHash)
 assert.equal(sitovHash(JSON.stringify(sitovAllAudio,null,2)+'\n'),sitovDelta35.currentAudioByteSha256)
 assert.deepEqual(Object.values(sitovAllAudio).sort(),Object.values(sitovBeforeAudio35).sort())
 assert.equal(sitovHash(JSON.stringify(Object.values(sitovAllAudio).sort())),sitovDelta35.spokenMultisetContentHash)
 const expected={...sitovFrozenAudio12}
 for(const row of sitovDelta35.questions)for(const alias of row.currentAliasEntries)expected[alias.key]=alias.textDe
 assert.deepEqual(Object.entries(sitovAllAudio),Object.entries(expected))
 assert.deepEqual(sitovValidatePretestAudioAliases(sitovAuthor35,sitovAllAudio),[])
 assert.equal(sitovHash(JSON.stringify(sitovFrozenAudio12)),sitovDelta35.original1152AliasContentHash)
 assert.ok(sitovValidatePretestAudioAliases(sitovAuthor35,sitovBeforeAudio35).length>0)
})

test('M exact independent review binds current new3 definitions without rewriting author history or claiming publication',async()=>{
 const raw=await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/M/pools13-15-editorial-review.json','utf8'),proof=JSON.parse(raw)
 assert.equal(proof.questionsChecked,72);assert.equal(proof.coresChecked,12);assert.equal(proof.humanReview,false);assert.equal(proof.calibrationStatus,'pending');assert.equal(proof.publicationAuthorized,false)
 assert.equal(proof.optionDeltaSha256,sitovHash(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/epoch35-option-diversity-delta.json','utf8')))
 for(const d of currentManifest.drafts.slice(12)){const r=proof.approvedEditorialDrafts.find(r=>r.textId===d.textId);assert.equal(d.active,false);assert.equal(d.review.status,'independent_editorial_checked_draft_only');assert.equal(d.review.reviewer,'sitov.agent.M');assert.equal(d.review.authorIdentity,'sitov.agent.S3');assert.equal(d.review.documentSha256,sitovHash(raw));assert.equal(d.review.textVersion,r.textVersion);assert.equal(d.review.definitionContentHash,r.definitionContentHash);assert.equal(r.definitionContentHash,sitovHash(JSON.stringify(d.definition)));assert.equal(d.review.humanReview,false);assert.equal(d.review.calibrationStatus,'pending');for(const q of d.definition.tasks)assert.equal(r.correctAnswerTexts.find(r=>r.questionId===q.id).correctTextDe,q.options.find(o=>o.id===q.correctOptionId).textDe)}
 assert.deepEqual(sitovValidatePretestDrafts(currentManifest,sources),[]);assert.deepEqual(sitovValidatePretestAudioAliases(currentManifest,sitovAllAudio),[])
})


test('current18 validate directly while exact frozen15 Mreviews and1440alias bytes reconstruct unchanged',async()=>{
 assert.equal(sitovAuthor36.drafts.length,18);assert.deepEqual(sitovAuthor36.coverage,{total:60,authored:18,pending:42})
 assert.equal(sitovHash(JSON.stringify(currentManifest.drafts)),sitovEpoch36.original15ContentHash)
 assert.equal(sitovHash(JSON.stringify(currentManifest)),sitovEpoch36.originalManifestContentHash)
 assert.equal(sitovHash(JSON.stringify(currentManifest,null,2)+'\n'),sitovEpoch36.originalManifestByteSha256)
 assert.equal(sitovHash(JSON.stringify(sitovAllAudio)),sitovEpoch36.original1440AliasContentHash)
 assert.equal(sitovHash(JSON.stringify(sitovAllAudio,null,2)+'\n'),sitovEpoch36.original1440AliasByteSha256)
 assert.deepEqual(sitovValidatePretestDrafts(sitovAuthor36,sources),[])
 assert.equal(Object.keys(sitovActualAudio36).length,1728);assert.deepEqual(sitovValidatePretestAudioAliases(sitovAuthor36,sitovActualAudio36),[])
 assert.equal(sitovHash(JSON.stringify(sitovAuthor36,null,2)+'\n'),sitovEpoch36.currentManifestByteSha256)
 assert.equal(sitovHash(JSON.stringify(sitovActualAudio36,null,2)+'\n'),sitovEpoch36.currentAliasByteSha256)
})
test('next3 actual sources use exact body/hash, four distinct matrices, balanced disjoint forms and independently varied keys',async()=>{
 const added=sitovAuthor36.drafts.slice(15)
 assert.deepEqual(sitovDiversityErrors(added),[])
 const refs=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/epoch36-reference-audio-candidates.json','utf8'))
 for(const [index,draft] of added.entries()){
  const source=sources.rows.find(r=>r.id===draft.textId),audit=sitovEpoch36.pools[index]
  assert.equal(source.level,'A1.2');assert.equal(source.sortOrder,index+6);assert.equal(draft.textVersion,sitovHash(source.text))
  assert.equal(audit.sourceBodyDe,source.text);assert.equal(refs['sitov-pretest-reference:'+draft.textId],source.text)
  assert.equal(draft.active,false);assert.equal(draft.review.status,'author_checked_independent_review_pending');assert.equal(draft.review.authorIdentity,draft.review.reviewer)
  assert.equal(draft.review.humanReview,false);assert.equal(draft.review.calibrationStatus,'pending');assert.equal(draft.review.definitionContentHash,sitovHash(JSON.stringify(draft.definition)))
  assert.equal(audit.definitionContentHash,draft.review.definitionContentHash);assert.equal(draft.definition.tasks.length,24)
  assert.equal(draft.definition.competencies.length,4);assert.equal(new Set(draft.definition.tasks.map(q=>q.assessmentUnit)).size,24)
  const [a,b]=draft.definition.reviewForms;assert.equal(a.questionIds.length,12);assert.equal(b.questionIds.length,12);assert.equal(a.questionIds.some(id=>b.questionIds.includes(id)),false)
  for(const [j,q] of draft.definition.tasks.entries()){
   const record=audit.questions[j];assert.equal(record.questionId,q.id);assert.equal(record.publicPromptDe,q.promptDe);assert.deepEqual(record.publicOptions,q.options)
   assert.equal(record.correctOptionId,q.correctOptionId);assert.equal(record.correctAnswerTextDe,q.options.find(o=>o.id===q.correctOptionId).textDe);assert.equal(record.rationaleDe,q.rationaleDe);assert.deepEqual(record.sourceSpans,q.sourceSpans)
   assert.equal(q.fragmentDe,null);assert.ok(!q.promptDe.includes(source.text));assert.ok(!/\b(Frau|Mitarbeiterin|Freundin|Lehrerin|Schülerin|Nachbarin)\b/u.test(q.promptDe+' '+q.options.map(o=>o.textDe).join(' ')))
  }
 }
})
test('housing/train/library source-specific keys and public time/reference/permission contexts remain explicit',()=>{
 const added=sitovAuthor36.drafts.slice(15),task=(i,suffix)=>added[i].definition.tasks.find(q=>q.id.endsWith(suffix)),key=(i,suffix)=>{const q=task(i,suffix);return q.options.find(o=>o.id===q.correctOptionId).textDe}
 assert.equal(key(0,'verbs.q3'),'ansehen');assert.equal(key(0,'nominal.q3'),'Auf die Wohnung.');assert.equal(key(0,'nominal.q5'),'dem')
 assert.equal(key(1,'verbs.q3'),'Frühes Aufstehen ist notwendig.');assert.equal(key(1,'syntax.q2'),'Eine halbe Stunde vor zehn Uhr.');assert.equal(key(1,'nominal.q6'),'Auf den Bruder.')
 assert.equal(key(2,'verbs.q6'),'Es ist für vier Wochen erlaubt.');assert.equal(key(2,'nominal.q5'),'Bildern');assert.equal(key(2,'nominal.q6'),'Das Buch')
 assert.ok(task(0,'syntax.q2').promptDe.includes('Die Wohnung hat drei Zimmer und einen Balkon'))
 assert.ok(task(1,'syntax.q4').promptDe.includes('Auf der Anzeige steht Gleis sieben'))
 assert.ok(task(2,'syntax.q6').promptDe.includes('Das Buch darf ich vier Wochen behalten'))
})
test('new18 regressions reject invalid spans, repeated assessment units, shared forms, crosslevel mappings and stale audio',()=>{
 for(const mutate of [m=>{m.drafts[15].definition.tasks[0].sourceSpans[0].start++},m=>{m.drafts[16].definition.tasks[1].assessmentUnit=m.drafts[16].definition.tasks[0].assessmentUnit},m=>{const f=m.drafts[17].definition.reviewForms;f[1].questionIds[0]=f[0].questionIds[0]},m=>{m.drafts[15].definition.competencies[0].mapping.topicIds=['sitov.topic.wohnen-a11']}]){
  const copy=structuredClone(sitovAuthor36);mutate(copy);assert.ok(sitovValidatePretestDrafts(copy,sources).length)
 }
 const missing={...sitovActualAudio36};delete missing[Object.keys(missing).at(-1)];assert.ok(sitovValidatePretestAudioAliases(sitovAuthor36,missing).length)
 const unbalanced=structuredClone(sitovAuthor36.drafts.slice(15));for(const d of unbalanced)for(const q of d.definition.tasks)q.correctOptionId=q.options.find(o=>o.id.endsWith('.a')).id
 assert.ok(sitovDiversityErrors(unbalanced).includes('unbalanced_labels'))
})

test('M independent exact18 provenance preserves author history, correct texts and honest publication state',async()=>{
 const raw=await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/M/pools16-18-editorial-review.json','utf8'),proof=JSON.parse(raw)
 assert.equal(proof.questionsChecked,72);assert.equal(proof.coresChecked,12);assert.equal(proof.humanReview,false);assert.equal(proof.calibrationStatus,'pending');assert.equal(proof.publicationAuthorized,false)
 assert.equal(proof.authorAuditSha256,sitovHash(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/epoch36-pools16-18-author-review.json','utf8')))
 for(const d of sitovActualManifest36.drafts.slice(15)){const r=proof.approvedEditorialDrafts.find(r=>r.textId===d.textId);assert.equal(d.active,false);assert.equal(d.review.status,'independent_editorial_checked_draft_only');assert.equal(d.review.reviewer,'sitov.agent.M');assert.equal(d.review.authorIdentity,'sitov.agent.S3');assert.equal(d.review.documentSha256,sitovHash(raw));assert.equal(d.review.humanReview,false);assert.equal(d.review.calibrationStatus,'pending');assert.equal(d.review.definitionContentHash,r.definitionContentHash);assert.equal(sitovHash(JSON.stringify(d.definition)),r.definitionContentHash);for(const q of d.definition.tasks)assert.equal(q.options.find(o=>o.id===q.correctOptionId).textDe,r.correctAnswerTexts.find(r=>r.questionId===q.id).correctTextDe)}
 assert.deepEqual(sitovValidatePretestDrafts(sitovActualManifest36,sources),[]);assert.deepEqual(sitovValidatePretestAudioAliases(sitovActualManifest36,sitovActualAudio36),[])
})


test('current21 validate directly and frozen18 Mreviews/1728alias bytes reconstruct exactly',async()=>{
 assert.equal(sitovActualManifest37.drafts.length,21);assert.deepEqual(sitovActualManifest37.coverage,{total:60,authored:21,pending:39})
 assert.equal(sitovHash(JSON.stringify(sitovActualManifest36.drafts)),sitovEpoch37.original18ContentHash)
 assert.equal(sitovHash(JSON.stringify(sitovActualManifest36)),sitovEpoch37.originalManifestContentHash)
 assert.equal(sitovHash(JSON.stringify(sitovActualManifest36,null,2)+'\n'),sitovEpoch37.originalManifestByteSha256)
 assert.equal(sitovHash(JSON.stringify(sitovActualAudio36)),sitovEpoch37.original1728AliasContentHash)
 assert.equal(sitovHash(JSON.stringify(sitovActualAudio36,null,2)+'\n'),sitovEpoch37.original1728AliasByteSha256)
 assert.deepEqual(sitovValidatePretestDrafts(sitovActualManifest37,sources),[])
 assert.equal(Object.keys(sitovActualAudio37).length,2016);assert.deepEqual(sitovValidatePretestAudioAliases(sitovActualManifest37,sitovActualAudio37),[])
 assert.equal(sitovHash(JSON.stringify(sitovActualManifest37,null,2)+'\n'),sitovEpoch37.currentManifestByteSha256)
 assert.equal(sitovHash(JSON.stringify(sitovActualAudio37,null,2)+'\n'),sitovEpoch37.currentAliasByteSha256)
})
test('complete next3 pools retain actual level/source/refs and six distinct units percore with independent balanced keys',async()=>{
 const added=sitovActualManifest37.drafts.slice(18),refs=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/epoch37-reference-audio-candidates.json','utf8'))
 assert.deepEqual(sitovDiversityErrors(added),[])
 assert.deepEqual(added.map(d=>[d.level,sources.rows.find(s=>s.id===d.textId).sortOrder]),[['A1.2',9],['A1.2',10],['A2.1',1]])
 for(const [index,d] of added.entries()){
  const source=sources.rows.find(s=>s.id===d.textId),audit=sitovEpoch37.pools[index]
  assert.equal(d.textVersion,sitovHash(source.text));assert.equal(audit.sourceBodyDe,source.text);assert.equal(refs['sitov-pretest-reference:'+d.textId],source.text)
  assert.equal(d.active,false);assert.equal(d.review.status,'author_checked_independent_review_pending');assert.equal(d.review.authorIdentity,d.review.reviewer);assert.equal(d.review.humanReview,false);assert.equal(d.review.calibrationStatus,'pending')
  assert.equal(d.definition.competencies.length,4);assert.equal(d.definition.tasks.length,24);assert.equal(new Set(d.definition.tasks.map(q=>q.assessmentUnit)).size,24)
  assert.equal(d.review.definitionContentHash,sitovHash(JSON.stringify(d.definition)));assert.equal(audit.definitionContentHash,d.review.definitionContentHash)
  const [a,b]=d.definition.reviewForms;assert.equal(a.questionIds.length,12);assert.equal(b.questionIds.length,12);assert.ok(!a.questionIds.some(id=>b.questionIds.includes(id)))
  for(const [j,q] of d.definition.tasks.entries()){
   const r=audit.questions[j];assert.equal(r.questionId,q.id);assert.equal(r.publicPromptDe,q.promptDe);assert.deepEqual(r.publicOptions,q.options);assert.equal(r.correctOptionId,q.correctOptionId);assert.equal(r.correctAnswerTextDe,q.options.find(o=>o.id===q.correctOptionId).textDe);assert.equal(r.rationaleDe,q.rationaleDe);assert.deepEqual(r.sourceSpans,q.sourceSpans)
   assert.equal(q.fragmentDe,null);assert.ok(!q.promptDe.includes(source.text));assert.ok(!/\b(Frau|Mitarbeiterin|Freundin|Lehrerin|Schülerin|Nachbarin)\b/u.test(q.promptDe+' '+q.options.map(o=>o.textDe).join(' ')))
  }
 }
})
test('key/stundenplan/workday questions test actual references, boundaries, past morphology and causal syntax',()=>{
 const added=sitovActualManifest37.drafts.slice(18),task=(i,s)=>added[i].definition.tasks.find(q=>q.id.endsWith(s)),key=(i,s)=>{const q=task(i,s);return q.options.find(o=>o.id===q.correctOptionId).textDe}
 assert.equal(key(0,'verbs.q4'),'anrufen');assert.equal(key(0,'nominal.q4'),'Auf den Mann des Sprechers.');assert.ok(task(0,'syntax.q6').promptDe.includes('Mein Schlüssel liegt auf dem Küchentisch'))
 assert.equal(key(1,'syntax.q1'),'Von Montag an.');assert.equal(key(1,'syntax.q2'),'Beginn neun Uhr, Ende zwölf Uhr.');assert.equal(key(1,'verbs.q6'),'abholen')
 assert.equal(key(2,'verbs.q1'),'haben');assert.equal(key(2,'verbs.q3'),'bin');assert.equal(key(2,'verbs.q4'),'gezeigt');assert.equal(key(2,'syntax.q4'),'die Kunden schnell gesprochen haben.')
 assert.ok(!added[2].definition.omittedCategories.some(o=>o.category==='past_tenses'))
 assert.deepEqual(added[2].definition.competencies.find(c=>c.category==='syntax').mapping.topicIds,['sitov.topic.begruenden-a21'])
})
test('new21 regressions reject crosslevel A2 targets, false spans, repeated units/forms, missing audio and all.a keys',()=>{
 for(const mutate of [m=>{m.drafts[20].definition.competencies[2].mapping.topicIds=['sitov.topic.ablauf-a12']},m=>{m.drafts[18].definition.tasks[0].sourceSpans[0].end++},m=>{m.drafts[19].definition.tasks[1].assessmentUnit=m.drafts[19].definition.tasks[0].assessmentUnit},m=>{const f=m.drafts[20].definition.reviewForms;f[1].questionIds[0]=f[0].questionIds[0]}]){const copy=structuredClone(sitovActualManifest37);mutate(copy);assert.ok(sitovValidatePretestDrafts(copy,sources).length)}
 const missing={...sitovActualAudio37};delete missing[Object.keys(missing).at(-1)];assert.ok(sitovValidatePretestAudioAliases(sitovActualManifest37,missing).length)
 const allA=structuredClone(sitovActualManifest37.drafts.slice(18));for(const d of allA)for(const q of d.definition.tasks)q.correctOptionId=q.options.find(o=>o.id.endsWith('.a')).id
 assert.ok(sitovDiversityErrors(allA).includes('unbalanced_labels'))
})


test('current age candidate makes grammar and age explicit while correct answer/id and all other20 pools remain exact',()=>{
 const current=sitovActualManifest38.drafts.find(d=>d.textId===sitovDelta38.textId),previous=sitovActualManifest37.drafts.find(d=>d.textId===sitovDelta38.textId)
 const q=current.definition.tasks.find(q=>q.id===sitovDelta38.questionId),old=sitovDelta38.previousTask
 assert.equal(q.promptDe,'Welcher Satz nennt ein Alter in korrekter deutscher Wortstellung?')
 assert.equal(q.options.find(o=>o.id==='sitov.option.1').textDe,'Ich lerne Deutsch.')
 assert.equal(q.correctOptionId,'sitov.option.2');assert.equal(q.correctOptionId,old.correctOptionId)
 assert.equal(q.options.find(o=>o.id===q.correctOptionId).textDe,'Ich bin dreißig Jahre alt.')
 assert.deepEqual(q.options.map(o=>o.id),old.options.map(o=>o.id));assert.deepEqual(q.sourceSpans,old.sourceSpans)
 const restored=structuredClone(current);restored.review=previous.review;restored.definition.tasks[restored.definition.tasks.findIndex(t=>t.id===q.id)]=old
 assert.deepEqual(restored,previous);assert.deepEqual(sitovActualManifest38.drafts.slice(1),sitovActualManifest37.drafts.slice(1))
 assert.equal(sitovHash(JSON.stringify(sitovActualManifest38.drafts.slice(1))),sitovDelta38.other20PoolsContentHash)
 assert.equal(current.active,false);assert.equal(current.review.status,'author_checked_independent_review_pending')
 assert.equal(current.review.authorIdentity,'sitov.agent.S3');assert.equal(current.review.reviewer,'sitov.agent.S3');assert.equal(current.review.humanReview,false);assert.equal(current.review.calibrationStatus,'pending')
 assert.equal(current.review.definitionContentHash,sitovHash(JSON.stringify(current.definition)));assert.equal(Object.hasOwn(current.review,'documentRef'),false)
})
test('exact question/review and2alias overlay reconstruct old bytes before historical proofs; actual21 and2016aliases validate',async()=>{
 assert.equal(sitovHash(JSON.stringify(sitovActualManifest37)),sitovDelta38.previousManifestContentHash)
 assert.equal(sitovHash(JSON.stringify(sitovActualManifest37,null,2)+'\n'),sitovDelta38.previousManifestByteSha256)
 assert.equal(sitovHash(JSON.stringify(sitovActualAudio37)),sitovDelta38.previousAudioContentHash)
 assert.equal(sitovHash(JSON.stringify(sitovActualAudio37,null,2)+'\n'),sitovDelta38.previousAudioByteSha256)
 assert.equal(sitovHash(JSON.stringify(sitovActualManifest38)),sitovDelta38.currentManifestContentHash)
 assert.equal(sitovHash(JSON.stringify(sitovActualManifest38,null,2)+'\n'),sitovDelta38.currentManifestByteSha256)
 assert.equal(sitovHash(JSON.stringify(sitovActualAudio38,null,2)+'\n'),sitovDelta38.currentAudioByteSha256)
 assert.deepEqual(Object.keys(sitovActualAudio38),Object.keys(sitovActualAudio37))
 const changed=Object.keys(sitovActualAudio38).filter(key=>sitovActualAudio38[key]!==sitovActualAudio37[key])
 assert.deepEqual(changed,sitovDelta38.changedAliases.map(r=>r.key));assert.equal(changed.length,2)
 for(const r of sitovDelta38.changedAliases){assert.equal(sitovActualAudio38[r.key],r.currentTextDe);assert.equal(sitovActualAudio37[r.key],r.previousTextDe)}
 assert.equal(sitovActualManifest38.drafts.length,21);assert.equal(Object.keys(sitovActualAudio38).length,2016)
 assert.deepEqual(sitovValidatePretestDrafts(sitovActualManifest38,sources),[])
 assert.deepEqual(sitovValidatePretestAudioAliases(sitovActualManifest38,sitovActualAudio38),[])
})
test('old independent definition review and old question audio cannot approve the repaired candidate',()=>{
 const staleReview=structuredClone(sitovActualManifest38);staleReview.drafts[0].review=sitovDelta38.previousReview
 assert.ok(sitovValidatePretestDrafts(staleReview,sources).some(e=>e.endsWith('independent exact-version review provenance required')))
 const staleAudio=sitovValidatePretestAudioAliases(sitovActualManifest38,sitovActualAudio37)
 assert.equal(staleAudio.length,2)
 for(const row of sitovDelta38.changedAliases)assert.ok(staleAudio.some(e=>e.includes(row.key)))
 const q=sitovActualManifest38.drafts[0].definition.tasks.find(q=>q.id===sitovDelta38.questionId)
 assert.ok(q.rationaleDe.includes('Ich lerne Deutsch.'));assert.ok(q.rationaleDe.includes('Tätigkeit'))
 assert.equal(sitovHash(JSON.stringify(sitovActualManifest37.drafts[0].definition)),sitovDelta38.previousDefinitionContentHash)
 assert.notEqual(sitovDelta38.previousDefinitionContentHash,sitovDelta38.currentDefinitionContentHash)
})

test('actual current independent M definitions bind exact independent M provenance including immutable age repair',()=>{
 assert.equal(sitovCurrentRepository24.drafts.length,24);assert.deepEqual(sitovValidatePretestDrafts(sitovCurrentRepository24,sources),[])
 for(const {raw,proof}of sitovReviewed21Proofs)for(const r of proof.approvedEditorialDrafts){const d=sitovCurrentRepository24.drafts.find(d=>d.textId===r.textId);assert.equal(d.review.documentRef,proof.documentRef);assert.equal(d.review.documentSha256,sitovHash(raw));assert.equal(d.review.definitionContentHash,sitovHash(JSON.stringify(d.definition)));assert.equal(d.review.textVersion,r.textVersion);assert.equal(d.review.status,'independent_editorial_checked_draft_only');assert.equal(d.review.humanReview,false);assert.equal(d.review.calibrationStatus,'pending');assert.equal(d.active,false);assert.equal(d.review.reviewer,'sitov.agent.M');assert.deepEqual(d.definition.tasks.map(q=>({questionId:q.id,correctTextDe:q.options.find(o=>o.id===q.correctOptionId).textDe})),r.correctAnswerTexts)}
})

// Epoch40 validates the actual24 candidates independently of the frozen historical projections.
const sitovA2KeyEvidence=[
 [0,'verbs.q1','ist'],[0,'verbs.q2','sein'],[0,'verbs.q3','geschoben'],[0,'verbs.q4','gefunden'],[0,'verbs.q6','abgeholt'],
 [0,'syntax.q5','Der Sprecher, bezeichnet durch ich.'],[0,'nominal.q6','Auf den Mechaniker.'],
 [1,'verbs.q1','kommen'],[1,'verbs.q2','Der Paketbote klingelt.'],[1,'verbs.q3','angenommen'],[1,'verbs.q4','gehängt'],[1,'verbs.q5','stehen'],[1,'verbs.q6','eingeladen'],
 [1,'syntax.q1','ich gestern nach Hause kam'],[1,'syntax.q2','klingelte der Paketbote.'],[1,'syntax.q4','er bei mir klingeln kann.'],
 [2,'verbs.q1','erklärt'],[2,'verbs.q3','haben'],[2,'verbs.q4','aufgeschrieben'],[2,'verbs.q5','vorbereitet'],[2,'verbs.q6','riechen'],
 [2,'syntax.q2','der Kuchen im Ofen war'],[2,'syntax.q3','Das Aufräumen geschieht in der Zeit, in der der Kuchen im Ofen ist.'],[2,'syntax.q5','Dunkle Farbe und guten Geschmack.'],[2,'nominal.q4','wenig'],
]
const sitovA2PublicPremises=[
 [0,'verbs.q1','Mein Fahrrad ___ kaputtgegangen'],[0,'verbs.q3','Ich habe das Rad ___'],[0,'syntax.q5','Meinem Lehrer habe ich eine Nachricht geschickt'],[0,'nominal.q6','Der Mechaniker hat ein Loch gefunden. Er konnte den Reifen reparieren'],
 [1,'verbs.q4','Ich habe einen Zettel an die Tür ___'],[1,'syntax.q1','Als …, klingelte der Paketbote'],[1,'syntax.q2','Als ich nach Hause kam, …'],[1,'syntax.q4','Auf dem Zettel stand, dass …'],[1,'syntax.q6','In dem Paket waren Bücher für seinen Sohn'],
 [2,'syntax.q1','Zuerst schreibe ich die Zutaten auf. Dann bereite ich den Teig vor'],[2,'syntax.q2','Während …, räumte ich die Küche auf'],[2,'syntax.q3','Während der Kuchen im Ofen war, habe ich die Küche aufgeräumt'],[2,'syntax.q5','Der Kuchen war etwas dunkel, hat aber gut geschmeckt'],[2,'syntax.q6','Meinem Vater habe ich ein Foto geschickt'],
]
const sitovAssertA2Evidence=drafts=>{
 for(const [index,suffix,expected] of sitovA2KeyEvidence){const q=drafts[index].definition.tasks.find(q=>q.id.endsWith(suffix));assert.equal(q.options.find(o=>o.id===q.correctOptionId).textDe,expected,q.id)}
 for(const [index,suffix,premise] of sitovA2PublicPremises){const q=drafts[index].definition.tasks.find(q=>q.id.endsWith(suffix));assert.ok(q.promptDe.includes(premise),q.id+' needs public premise')}
}
test('actual24/2304 validate directly; exact frozen21 with repaired age question and2016alias bytes precedes history',async()=>{
 assert.equal(sitovActualManifest39.drafts.length,24);assert.deepEqual(sitovActualManifest39.coverage,{total:60,authored:24,pending:36})
 assert.equal(Object.keys(sitovActualAudio39).length,2304)
 assert.deepEqual(sitovValidatePretestDrafts(sitovActualManifest39,sources),[])
 assert.deepEqual(sitovValidatePretestAudioAliases(sitovActualManifest39,sitovActualAudio39),[])
 assert.equal(sitovHash(JSON.stringify(sitovActualManifest38.drafts)),sitovEpoch39.original21ContentHash)
 for(const [value,content,bytes] of [[sitovActualManifest38,sitovEpoch39.originalManifestContentHash,sitovEpoch39.originalManifestByteSha256],[sitovActualAudio38,sitovEpoch39.original2016AliasContentHash,sitovEpoch39.original2016AliasByteSha256],[sitovActualManifest39,sitovEpoch39.currentManifestContentHash,sitovEpoch39.currentManifestByteSha256],[sitovActualAudio39,sitovEpoch39.currentAliasContentHash,sitovEpoch39.currentAliasByteSha256]]){
  assert.equal(sitovHash(JSON.stringify(value)),content);assert.equal(sitovHash(JSON.stringify(value,null,2)+'\n'),bytes)
 }
 assert.equal(sitovHash(JSON.stringify(sitovActualManifest39,null,2)+'\n'),sitovEpoch39.currentManifestByteSha256)
 assert.equal(sitovHash(JSON.stringify(sitovActualAudio39,null,2)+'\n'),sitovEpoch39.currentAliasByteSha256)
 assert.deepEqual(Object.entries(sitovActualAudio39).slice(0,2016),Object.entries(sitovActualAudio38))
 for(const d of sitovActualManifest39.drafts){assert.equal(d.active,false);assert.equal(d.definition.tasks.length,24);assert.equal(new Set(d.definition.tasks.map(q=>q.assessmentUnit)).size,24);assert.equal(d.definition.competencies.length,4);const [a,b]=d.definition.reviewForms;assert.equal(a.questionIds.length,12);assert.equal(b.questionIds.length,12);assert.ok(!a.questionIds.some(id=>b.questionIds.includes(id)))}
})
test('three A2.1 actual sources and all72 audited items bind exact public/private evidence and independently balanced forms',async()=>{
 const added=sitovActualManifest39.drafts.slice(21),refs=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/epoch39-reference-audio-candidates.json','utf8'))
 assert.equal(sitovEpoch39.completedPools,3);assert.equal(sitovEpoch39.newQuestionCount,72);assert.equal(sitovEpoch39.newAliasCount,288)
 assert.equal(sitovEpoch39.humanReview,false);assert.equal(sitovEpoch39.publicationAuthorized,false);assert.equal(sitovEpoch39.calibrationStatus,'pending')
 assert.deepEqual(sitovDiversityErrors(added),[]);assert.equal(Object.keys(refs).length,3)
 assert.deepEqual(added.map(d=>d.textId),['acb54d47-e197-56ca-9eb7-a890abce63f6','2c6b8ac4-28e2-556d-950e-9937d7da0da9','5ec73679-e979-5ef6-bbac-8d14af8d2651'])
 for(const [i,d]of added.entries()){
  const source=sources.rows.find(s=>s.id===d.textId),audit=sitovEpoch39.pools[i]
  assert.equal(d.level,'A2.1');assert.equal(source.level,'A2.1');assert.equal(source.sortOrder,i+2);assert.equal(d.textVersion,sitovHash(source.text));assert.equal(audit.sourceBodyDe,source.text);assert.equal(refs['sitov-pretest-reference:'+d.textId],source.text)
  assert.equal(d.review.status,'author_checked_independent_review_pending');assert.equal(d.review.authorIdentity,'sitov.agent.S3');assert.equal(d.review.reviewer,d.review.authorIdentity);assert.equal(d.review.humanReview,false);assert.equal(d.review.calibrationStatus,'pending');assert.equal(Object.hasOwn(d.review,'documentRef'),false)
  assert.equal(d.review.definitionContentHash,sitovHash(JSON.stringify(d.definition)));assert.equal(audit.definitionContentHash,d.review.definitionContentHash);assert.equal(audit.questions.length,24)
  for(const core of d.definition.competencies){const qs=d.definition.tasks.filter(q=>q.competencyId===core.id);assert.equal(qs.length,6);assert.equal(core.languageUnits.length,6);assert.equal(new Set(qs.map(q=>q.assessmentUnit)).size,6);for(const form of d.definition.reviewForms)assert.equal(form.questionIds.filter(id=>qs.some(q=>q.id===id)).length,3)}
  for(const [j,q]of d.definition.tasks.entries()){
   const r=audit.questions[j];assert.equal(r.questionId,q.id);assert.equal(r.publicPromptDe,q.promptDe);assert.deepEqual(r.publicOptions,q.options);assert.equal(r.correctOptionId,q.correctOptionId);assert.equal(r.correctAnswerTextDe,q.options.find(o=>o.id===q.correctOptionId).textDe);assert.equal(r.rationaleDe,q.rationaleDe);assert.equal(r.assessmentUnit,q.assessmentUnit);assert.deepEqual(r.sourceSpans,q.sourceSpans)
   assert.ok(q.rationaleDe.trim().length>20);assert.equal(q.fragmentDe,null);assert.ok(!q.promptDe.includes(source.text));assert.ok(!/\b(Frau|Mitarbeiterin|Freundin|Lehrerin|Schülerin|Nachbarin|Mutter|Schwester)\b/u.test(q.promptDe+' '+q.options.map(o=>o.textDe).join(' ')))
  }
 }
})
test('A2 actual past morphology and als/dass/während word order have visible premises and precise samelevel gaps',()=>{
 const added=sitovActualManifest39.drafts.slice(21);sitovAssertA2Evidence(added)
 for(const d of added){assert.ok(!d.definition.omittedCategories.some(c=>c.category==='past_tenses'));for(const c of d.definition.competencies){assert.deepEqual(c.mapping.topicIds,[]);for(const unit of c.languageUnits)assert.ok(c.mapping.pendingReasonDe.includes(unit),c.id+' explicit unit gap');if(c.category==='syntax')assert.ok(c.mapping.pendingReasonDe.includes('weil'))}}
 const parcel=added[1].definition.tasks.find(q=>q.id.endsWith('verbs.q4'));assert.ok(parcel.rationaleDe.includes('gehängt'))
 for(const suffix of ['verbs.q1','verbs.q4','verbs.q5']){const q=added[2].definition.tasks.find(q=>q.id.endsWith(suffix));assert.ok(q.rationaleDe.includes(q.options.find(o=>o.id===q.correctOptionId).textDe),q.id+' rationale explains actual form')}
})
test('actual24 regressions reject source/unit/form/crosslevel/audio defects and wrong A2 keys or hidden premises',()=>{
 for(const mutate of [m=>{m.drafts[21].definition.tasks[0].sourceSpans[0].start++},m=>{m.drafts[22].definition.tasks[1].assessmentUnit=m.drafts[22].definition.tasks[0].assessmentUnit},m=>{const f=m.drafts[23].definition.reviewForms;f[1].questionIds[0]=f[0].questionIds[0]},m=>{m.drafts[21].definition.competencies[2].mapping.topicIds=['sitov.topic.ablauf-a12']},m=>{m.drafts[22].definition.tasks[0].rationaleDe=''}]){const copy=structuredClone(sitovActualManifest39);mutate(copy);assert.ok(sitovValidatePretestDrafts(copy,sources).length)}
 const missing={...sitovActualAudio39};delete missing[Object.keys(missing).at(-1)];assert.ok(sitovValidatePretestAudioAliases(sitovActualManifest39,missing).length)
 const stale={...sitovActualAudio39},last=Object.keys(stale).at(-1);stale[last]='changed';assert.ok(sitovValidatePretestAudioAliases(sitovActualManifest39,stale).length)
 const added=sitovActualManifest39.drafts.slice(21),allA=structuredClone(added);for(const d of allA)for(const q of d.definition.tasks)q.correctOptionId=q.options.find(o=>o.id.endsWith('.a')).id;assert.ok(sitovDiversityErrors(allA).includes('unbalanced_labels'))
 const allFirst=structuredClone(added);for(const d of allFirst)for(const q of d.definition.tasks)q.options.sort((a,b)=>Number(b.id===q.correctOptionId)-Number(a.id===q.correctOptionId));assert.ok(sitovDiversityErrors(allFirst).includes('unbalanced_positions'))
 for(const [i,suffix]of [[1,'syntax.q1'],[1,'syntax.q4'],[2,'syntax.q2'],[1,'verbs.q4'],[2,'verbs.q5']]){const wrong=structuredClone(added),q=wrong[i].definition.tasks.find(q=>q.id.endsWith(suffix));q.correctOptionId=q.options.find(o=>o.id!==q.correctOptionId).id;assert.throws(()=>sitovAssertA2Evidence(wrong))}
 for(const [i,suffix]of [[0,'syntax.q5'],[1,'syntax.q6'],[2,'syntax.q3']]){const hidden=structuredClone(added);hidden[i].definition.tasks.find(q=>q.id.endsWith(suffix)).promptDe='Welche Antwort stimmt?';assert.throws(()=>sitovAssertA2Evidence(hidden))}
})


test('epoch41 actual24 source repair preserves all other23 definitions/public fields/aliases and exact pre-repair bytes',async()=>{
 assert.equal(sitovHash(JSON.stringify(sitovBeforeSpan41)),sitovSpan41.previousManifestContentHash)
 assert.equal(sitovHash(JSON.stringify(sitovBeforeSpan41,null,2)+'\n'),sitovSpan41.previousManifestByteSha256)
 assert.equal(sitovHash(JSON.stringify(sitovCurrentRepository24)),sitovSpan41.currentManifestContentHash)
 assert.equal(sitovHash(JSON.stringify(sitovCurrentRepository24,null,2)+'\n'),sitovSpan41.currentManifestByteSha256)
 assert.equal(sitovHash(JSON.stringify(sitovActualAudio39,null,2)+'\n'),sitovSpan41.unchangedAudioByteSha256)
 const d=sitovCurrentRepository24.drafts.find(d=>d.textId===sitovSpan41.textId),restored=structuredClone(sitovCurrentRepository24)
 assert.equal(d.review.status,'author_checked_independent_review_pending');assert.equal(d.review.reviewer,'sitov.agent.S3');assert.equal(d.review.authorIdentity,d.review.reviewer);assert.equal(d.review.humanReview,false);assert.equal(d.review.calibrationStatus,'pending');assert.equal(Object.hasOwn(d.review,'documentRef'),false)
 assert.equal(d.review.definitionContentHash,sitovHash(JSON.stringify(d.definition)));assert.notEqual(d.review.definitionContentHash,sitovSpan41.previousDefinitionContentHash)
 assert.equal(sitovHash(JSON.stringify(sitovCurrentRepository24.drafts.filter(d=>d.textId!==sitovSpan41.textId))),sitovSpan41.other23ContentHash)
 const r=restored.drafts.find(d=>d.textId===sitovSpan41.textId);r.definition.tasks.find(q=>q.id===sitovSpan41.questionId).sourceSpans[0]=sitovSpan41.previousQuestionSpan;r.definition.competencies.find(c=>c.id===sitovSpan41.coreId).sourceSpans[0]=sitovSpan41.previousCoreSpan;r.review=sitovSpan41.previousReview
 assert.deepEqual(restored,sitovBeforeSpan41)
 assert.deepEqual(sitovPublicPretestAudioAliases(sitovCurrentRepository24),sitovPublicPretestAudioAliases(sitovBeforeSpan41))
 assert.deepEqual(sitovValidatePretestDrafts(sitovCurrentRepository24,sources),[])
 assert.deepEqual(sitovValidatePretestAudioAliases(sitovCurrentRepository24,sitovActualAudio39),[])
})
test('Paket question and vocabulary matrix require the standalone source lexeme; embedded Paketbote prefix is rejected',()=>{
 const d=sitovCurrentRepository24.drafts.find(d=>d.textId===sitovSpan41.textId),body=sources.rows.find(s=>s.id===d.textId).text
 const standalone=span=>body.slice(span.start,span.end)===span.quote&&!/[\p{L}\p{N}_]/u.test(body[span.start-1]??'')&&!/[\p{L}\p{N}_]/u.test(body[span.end]??'')
 const q=d.definition.tasks.find(q=>q.id===sitovSpan41.questionId),core=d.definition.competencies.find(c=>c.id===sitovSpan41.coreId)
 assert.equal(sitovHash(body),sitovSpan41.sourceTextVersion);assert.equal(body,sitovSpan41.sourceBodyDe);assert.equal(body.slice(97,107),'sein Paket')
 for(const span of [q.sourceSpans[0],core.sourceSpans[0]]){assert.deepEqual(span,{start:102,end:107,quote:'Paket'});assert.ok(standalone(span))}
 assert.equal(body.slice(46,51),'Paket');assert.equal(body.slice(46,55),'Paketbote');assert.equal(standalone(sitovSpan41.previousQuestionSpan),false);assert.equal(standalone(sitovSpan41.previousCoreSpan),false)
 assert.equal(standalone({start:103,end:107,quote:'aket'}),false)
 assert.equal(standalone({start:102,end:108,quote:'Paket'}),false)
 assert.equal(standalone(core.sourceSpans[1]),true)
})

test('actual all24 independently M-reviewed definitions bind the precise repaired source and current answer texts',()=>{
 assert.equal(sitovLatestMReviewed24.drafts.length,24);assert.deepEqual(sitovValidatePretestDrafts(sitovLatestMReviewed24,sources),[]);assert.deepEqual(sitovValidatePretestAudioAliases(sitovLatestMReviewed24,sitovActualAudio39),[])
 for(const d of sitovLatestMReviewed24.drafts){assert.equal(d.review.status,'independent_editorial_checked_draft_only');assert.equal(d.review.reviewer,'sitov.agent.M');assert.equal(d.review.authorIdentity,'sitov.agent.S3');assert.equal(d.review.humanReview,false);assert.equal(d.review.calibrationStatus,'pending');assert.equal(d.active,false)}
 for(const r of sitovMReview24.approvedEditorialDrafts){const d=sitovLatestMReviewed24.drafts.find(d=>d.textId===r.textId);assert.equal(d.review.documentSha256,sitovHash(sitovMReview24Raw));assert.equal(d.review.documentRef,sitovMReview24.documentRef);assert.equal(d.review.definitionContentHash,sitovHash(JSON.stringify(d.definition)));assert.equal(d.review.textVersion,r.textVersion);assert.deepEqual(d.definition.tasks.map(q=>({questionId:q.id,correctTextDe:q.options.find(o=>o.id===q.correctOptionId).textDe})),r.correctAnswerTexts)}
})


test('epoch42 actual27/2592 validate directly with exact frozen M-reviewed24/2304 content and bytes',async()=>{
 assert.equal(sitovActualManifest42.drafts.length,27);assert.deepEqual(sitovActualManifest42.coverage,{total:60,authored:27,pending:33});assert.equal(Object.keys(sitovActualAudio42).length,2592)
 assert.deepEqual(sitovValidatePretestDrafts(sitovActualManifest42,sources),[]);assert.deepEqual(sitovValidatePretestAudioAliases(sitovActualManifest42,sitovActualAudio42),[])
 assert.equal(sitovHash(JSON.stringify(sitovLatestMReviewed24.drafts)),sitovEpoch42.original24ContentHash)
 for(const [value,content,bytes]of [[sitovLatestMReviewed24,sitovEpoch42.originalManifestContentHash,sitovEpoch42.originalManifestByteSha256],[sitovActualAudio39,sitovEpoch42.original2304AliasContentHash,sitovEpoch42.original2304AliasByteSha256],[sitovActualManifest42,sitovEpoch42.currentManifestContentHash,sitovEpoch42.currentManifestByteSha256],[sitovActualAudio42,sitovEpoch42.currentAliasContentHash,sitovEpoch42.currentAliasByteSha256]]){assert.equal(sitovHash(JSON.stringify(value)),content);assert.equal(sitovHash(JSON.stringify(value,null,2)+'\n'),bytes)}
 assert.equal(sitovHash(JSON.stringify(sitovActualManifest42,null,2)+'\n'),sitovEpoch42.currentManifestByteSha256)
 assert.equal(sitovHash(JSON.stringify(sitovActualAudio42,null,2)+'\n'),sitovEpoch42.currentAliasByteSha256)
})
test('next canonical A2.1sort5–7 bind all72 audited fields, standalone spans, six-unit cores and independent balanced forms',async()=>{
 const added=sitovActualManifest42.drafts.slice(24),refs=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/epoch42-reference-audio-candidates.json','utf8'))
 assert.deepEqual(sitovDiversityErrors(added),[]);assert.equal(Object.keys(refs).length,3)
 for(const[i,d]of added.entries()){
  const source=sources.rows.find(s=>s.id===d.textId),audit=sitovEpoch42.pools[i],chars=Array.from(source.text)
  assert.equal(d.level,'A2.1');assert.equal(source.sortOrder,i+5);assert.equal(audit.sourceBodyDe,source.text);assert.equal(refs['sitov-pretest-reference:'+d.textId],source.text);assert.equal(d.textVersion,sitovHash(source.text));assert.equal(d.active,false)
  assert.equal(d.review.status,'author_checked_independent_review_pending');assert.equal(d.review.reviewer,d.review.authorIdentity);assert.equal(d.review.humanReview,false);assert.equal(d.review.calibrationStatus,'pending');assert.equal(d.review.definitionContentHash,sitovHash(JSON.stringify(d.definition)));assert.equal(d.review.definitionContentHash,audit.definitionContentHash)
  assert.equal(d.definition.tasks.length,24);assert.equal(d.definition.competencies.length,4);assert.equal(new Set(d.definition.tasks.map(q=>q.assessmentUnit)).size,24)
  const[a,b]=d.definition.reviewForms;assert.equal(a.questionIds.length,12);assert.equal(b.questionIds.length,12);assert.ok(!a.questionIds.some(id=>b.questionIds.includes(id)))
  for(const core of d.definition.competencies){const qs=d.definition.tasks.filter(q=>q.competencyId===core.id);assert.equal(qs.length,6);assert.equal(core.languageUnits.length,6);for(const f of[a,b])assert.equal(f.questionIds.filter(id=>qs.some(q=>q.id===id)).length,3)}
  for(const[j,q]of d.definition.tasks.entries()){
   const r=audit.questions[j];assert.equal(r.questionId,q.id);assert.equal(r.publicPromptDe,q.promptDe);assert.deepEqual(r.publicOptions,q.options);assert.equal(r.correctOptionId,q.correctOptionId);assert.equal(r.correctAnswerTextDe,q.options.find(o=>o.id===q.correctOptionId).textDe);assert.equal(r.rationaleDe,q.rationaleDe);assert.equal(r.assessmentUnit,q.assessmentUnit);assert.deepEqual(r.sourceSpans,q.sourceSpans)
   assert.ok(!/\b(Frau|Freundin|Lehrerin|Schülerin|Nachbarin|Mutter|Schwester)\b/u.test(q.promptDe+' '+q.options.map(o=>o.textDe).join(' ')))
  }
  for(const span of [...d.definition.tasks.flatMap(q=>q.sourceSpans),...d.definition.competencies.flatMap(c=>c.sourceSpans)]){assert.equal(chars.slice(span.start,span.end).join(''),span.quote);assert.ok(!/[\p{L}\p{N}_]/u.test(chars[span.start-1]??''));assert.ok(!/[\p{L}\p{N}_]/u.test(chars[span.end]??''))}
 }
})
const sitovAssert42Keys=drafts=>{
 const expected=[[0,'verbs.q1','stattfinden'],[0,'verbs.q2','sein'],[0,'verbs.q4','mitmachen'],[0,'verbs.q5','uns'],[0,'verbs.q6','kennenlernen'],[0,'syntax.q4','Auf die Bewegung.'],[0,'syntax.q5','Die Dauer des Mitmachens ist jetzt größer.'],[0,'nominal.q5','Ländern'],[1,'verbs.q1','besucht'],[1,'verbs.q3','sind'],[1,'verbs.q4','abgeholt'],[1,'verbs.q5','gesehen'],[1,'verbs.q6','wollten'],[1,'syntax.q4','es kühl wurde'],[1,'nominal.q1','alten'],[1,'nominal.q5','Der Sprecher zusammen mit den anderen Besuchern.'],[2,'verbs.q2','anbieten'],[2,'verbs.q3','informiert'],[2,'verbs.q4','geschrieben'],[2,'verbs.q5','mitbringen'],[2,'verbs.q6','uns'],[2,'syntax.q5','er auch gern Fußball spielt'],[2,'nominal.q3','kostenloses']]
 for(const[i,s,key]of expected){const q=drafts[i].definition.tasks.find(q=>q.id.endsWith(s));assert.equal(q.options.find(o=>o.id===q.correctOptionId).textDe,key,q.id)}
 for(const[i,s,p]of [[0,'syntax.q4','Der Trainer zeigt jede Bewegung und erklärt sie'],[0,'syntax.q5','Jetzt kann ich länger mitmachen als am Anfang'],[1,'syntax.q2','Unsere Freunde waren am Bahnhof. Sie haben uns abgeholt'],[1,'syntax.q5','Wir saßen draußen, bis es kühl wurde'],[2,'syntax.q6','Ein Freund begleitet mich, weil er auch gern Fußball spielt']])assert.ok(drafts[i].definition.tasks.find(q=>q.id.endsWith(s)).promptDe.includes(p))
}
test('source-specific sport/country/club keys and visible premises retain actual comparative, past and bis/weil functions',()=>{
 const added=sitovActualManifest42.drafts.slice(24);sitovAssert42Keys(added)
 for(const d of added)assert.ok(!d.definition.omittedCategories.some(c=>c.category==='past_tenses'))
 assert.ok(!added[0].definition.omittedCategories.some(c=>c.category==='comparatives'))
 for(const[i,d]of added.entries())for(const c of d.definition.competencies){assert.deepEqual(c.mapping.topicIds,i===2&&c.category==='syntax'?['sitov.topic.begruenden-a21']:[]);for(const u of c.languageUnits)assert.ok(c.mapping.pendingReasonDe.includes(u))}
})
test('new27 guards reject false spans, missing evidence/rationale/audio, repeated units/forms, crosslevel targets and predictable keys',()=>{
 for(const mutate of [m=>{m.drafts[24].definition.tasks[0].sourceSpans[0].start++},m=>{m.drafts[25].definition.tasks[0].rationaleDe=''},m=>{m.drafts[26].definition.tasks[1].assessmentUnit=m.drafts[26].definition.tasks[0].assessmentUnit},m=>{const f=m.drafts[24].definition.reviewForms;f[1].questionIds[0]=f[0].questionIds[0]},m=>{m.drafts[25].definition.competencies[0].mapping.topicIds=['sitov.topic.ablauf-a12']}]){const copy=structuredClone(sitovActualManifest42);mutate(copy);assert.ok(sitovValidatePretestDrafts(copy,sources).length)}
 const audio={...sitovActualAudio42};delete audio[Object.keys(audio).at(-1)];assert.ok(sitovValidatePretestAudioAliases(sitovActualManifest42,audio).length)
 const added=sitovActualManifest42.drafts.slice(24),allA=structuredClone(added);for(const d of allA)for(const q of d.definition.tasks)q.correctOptionId=q.options.find(o=>o.id.endsWith('.a')).id;assert.ok(sitovDiversityErrors(allA).includes('unbalanced_labels'))
 for(const[i,s]of [[0,'verbs.q1'],[0,'syntax.q5'],[1,'syntax.q4'],[2,'syntax.q5']]){const wrong=structuredClone(added),q=wrong[i].definition.tasks.find(q=>q.id.endsWith(s));q.correctOptionId=q.options.find(o=>o.id!==q.correctOptionId).id;assert.throws(()=>sitovAssert42Keys(wrong))}
 const hidden=structuredClone(added);hidden[1].definition.tasks.find(q=>q.id.endsWith('syntax.q2')).promptDe='Wer holt sie ab?';assert.throws(()=>sitovAssert42Keys(hidden))
})


test('epoch43 actual27 validates and exact old27 bytes restore before history; other26/public/audio remain unchanged',async()=>{
 assert.equal(sitovHash(JSON.stringify(sitovActualManifest42)),sitovDelta43.previousManifestContentHash);assert.equal(sitovHash(JSON.stringify(sitovActualManifest42,null,2)+'\n'),sitovDelta43.previousManifestByteSha256)
 assert.equal(sitovHash(JSON.stringify(sitovActualManifest43)),sitovDelta43.currentManifestContentHash);assert.equal(sitovHash(JSON.stringify(sitovActualManifest43,null,2)+'\n'),sitovDelta43.currentManifestByteSha256)
 assert.equal(sitovHash(JSON.stringify(sitovActualAudio42,null,2)+'\n'),sitovDelta43.unchangedAudioByteSha256)
 assert.equal(sitovHash(JSON.stringify(sitovActualManifest43.drafts.filter(d=>d.textId!==sitovDelta43.textId))),sitovDelta43.other26ContentHash)
 assert.deepEqual(sitovPublicPretestAudioAliases(sitovActualManifest43),sitovPublicPretestAudioAliases(sitovActualManifest42));assert.equal(sitovHash(JSON.stringify(sitovPublicPretestAudioAliases(sitovActualManifest43))),sitovDelta43.unchangedPublicAliasContentHash)
 const d=sitovActualManifest43.drafts.find(d=>d.textId===sitovDelta43.textId),restored=structuredClone(sitovActualManifest43),r=restored.drafts.find(d=>d.textId===sitovDelta43.textId)
 assert.equal(d.review.status,'author_checked_independent_review_pending');assert.equal(d.review.authorIdentity,d.review.reviewer);assert.equal(d.review.humanReview,false);assert.equal(d.review.calibrationStatus,'pending');assert.equal(d.review.definitionContentHash,sitovHash(JSON.stringify(d.definition)));assert.notEqual(d.review.definitionContentHash,sitovDelta43.previousDefinitionContentHash)
 r.definition.competencies.find(c=>c.id===sitovDelta43.coreId).mapping.pendingReasonDe=sitovDelta43.previousReason;r.review=sitovDelta43.previousReview;assert.deepEqual(restored,sitovActualManifest42)
 assert.equal(sitovActualManifest43.drafts.length,27);assert.equal(Object.keys(sitovActualAudio42).length,2592);assert.deepEqual(sitovValidatePretestDrafts(sitovActualManifest43,sources),[]);assert.deepEqual(sitovValidatePretestAudioAliases(sitovActualManifest43,sitovActualAudio42),[])
})
test('club syntax missing list excludes its two evidenced weil skills and retains precisely four genuine gaps',()=>{
 const core=sitovActualManifest43.drafts.find(d=>d.textId===sitovDelta43.textId).definition.competencies.find(c=>c.id===sitovDelta43.coreId)
 const supported=['weil Nebensatz Verbfinal','weil Begründung Begleitung'],missing=['nach Uhrzeit erfragte Information','soll erhaltene Anweisung','Am Donnerstag Zeitangabe','zum ersten Mal erste Teilnahme']
 const check=reason=>{const[prefix,tail]=reason.split('Andere Einzelziele fehlen: ');assert.equal(prefix,'Teilbeleg ausschließlich für '+supported.join(' und ')+'. ');assert.deepEqual(tail.split('. Kein stufenfremder')[0].split(', '),missing);for(const u of supported)assert.ok(!tail.includes(u))}
 assert.deepEqual(core.mapping.topicIds,['sitov.topic.begruenden-a21']);check(core.mapping.pendingReasonDe)
 assert.throws(()=>check(sitovDelta43.previousReason));assert.throws(()=>check(core.mapping.pendingReasonDe.replace('Am Donnerstag Zeitangabe, ','')))
 assert.throws(()=>check(core.mapping.pendingReasonDe.replace('Andere Einzelziele fehlen: ','Andere Einzelziele fehlen: weil Nebensatz Verbfinal, ')))
})


test('epoch44 actual30/2880 validate directly with exact frozen27/2592 content and bytes',async()=>{
 assert.equal(sitovActualManifest44.drafts.length,30);assert.deepEqual(sitovActualManifest44.coverage,{total:60,authored:30,pending:30});assert.equal(Object.keys(sitovActualAudio44).length,2880)
 assert.deepEqual(sitovValidatePretestDrafts(sitovActualManifest44,sources),[]);assert.deepEqual(sitovValidatePretestAudioAliases(sitovActualManifest44,sitovActualAudio44),[])
 assert.equal(sitovHash(JSON.stringify(sitovActualManifest43.drafts)),sitovEpoch44.original27ContentHash)
 for(const [value,content,bytes]of [[sitovActualManifest43,sitovEpoch44.originalManifestContentHash,sitovEpoch44.originalManifestByteSha256],[sitovActualAudio42,sitovEpoch44.original2592AliasContentHash,sitovEpoch44.original2592AliasByteSha256],[sitovActualManifest44,sitovEpoch44.currentManifestContentHash,sitovEpoch44.currentManifestByteSha256],[sitovActualAudio44,sitovEpoch44.currentAliasContentHash,sitovEpoch44.currentAliasByteSha256]]){assert.equal(sitovHash(JSON.stringify(value)),content);assert.equal(sitovHash(JSON.stringify(value,null,2)+'\n'),bytes)}
 assert.equal(sitovHash(JSON.stringify(sitovActualManifest44,null,2)+'\n'),sitovEpoch44.currentManifestByteSha256)
 assert.equal(sitovHash(JSON.stringify(sitovActualAudio44,null,2)+'\n'),sitovEpoch44.currentAliasByteSha256)
})
test('next canonical A2.1sort8–10 bind all72 audited fields, standalone spans, six-unit cores and independent balanced forms',async()=>{
 const added=sitovActualManifest44.drafts.slice(27),refs=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/epoch44-reference-audio-candidates.json','utf8'))
 assert.deepEqual(sitovDiversityErrors(added),[]);assert.equal(Object.keys(refs).length,3)
 for(const[i,d]of added.entries()){
  const source=sources.rows.find(s=>s.id===d.textId),audit=sitovEpoch44.pools[i],chars=Array.from(source.text)
  assert.equal(d.level,'A2.1');assert.equal(source.sortOrder,i+8);assert.equal(audit.sourceBodyDe,source.text);assert.equal(refs['sitov-pretest-reference:'+d.textId],source.text);assert.equal(d.textVersion,sitovHash(source.text));assert.equal(d.active,false)
  assert.equal(d.review.status,'author_checked_independent_review_pending');assert.equal(d.review.reviewer,d.review.authorIdentity);assert.equal(d.review.humanReview,false);assert.equal(d.review.calibrationStatus,'pending');assert.equal(d.review.definitionContentHash,sitovHash(JSON.stringify(d.definition)));assert.equal(d.review.definitionContentHash,audit.definitionContentHash)
  assert.equal(d.definition.tasks.length,24);assert.equal(d.definition.competencies.length,4);assert.equal(new Set(d.definition.tasks.map(q=>q.assessmentUnit)).size,24)
  const[a,b]=d.definition.reviewForms;assert.equal(a.questionIds.length,12);assert.equal(b.questionIds.length,12);assert.ok(!a.questionIds.some(id=>b.questionIds.includes(id)))
  for(const core of d.definition.competencies){const qs=d.definition.tasks.filter(q=>q.competencyId===core.id);assert.equal(qs.length,6);assert.equal(core.languageUnits.length,6);for(const f of[a,b])assert.equal(f.questionIds.filter(id=>qs.some(q=>q.id===id)).length,3)}
  for(const[j,q]of d.definition.tasks.entries()){
   const r=audit.questions[j];assert.equal(r.questionId,q.id);assert.equal(r.publicPromptDe,q.promptDe);assert.deepEqual(r.publicOptions,q.options);assert.equal(r.correctOptionId,q.correctOptionId);assert.equal(r.correctAnswerTextDe,q.options.find(o=>o.id===q.correctOptionId).textDe);assert.equal(r.rationaleDe,q.rationaleDe);assert.equal(r.assessmentUnit,q.assessmentUnit);assert.deepEqual(r.sourceSpans,q.sourceSpans)
   assert.ok(!/\b(Frau|Freundin|Lehrerin|Schülerin|Nachbarin|Mutter|Schwester)\b/u.test(q.promptDe+' '+q.options.map(o=>o.textDe).join(' ')))
  }
  for(const span of [...d.definition.tasks.flatMap(q=>q.sourceSpans),...d.definition.competencies.flatMap(c=>c.sourceSpans)]){assert.equal(chars.slice(span.start,span.end).join(''),span.quote);assert.ok(!/[\p{L}\p{N}_]/u.test(chars[span.start-1]??''));assert.ok(!/[\p{L}\p{N}_]/u.test(chars[span.end]??''))}
 }
})

const sitovAssert44Keys=drafts=>{
 const expected=[[0,'verbs.q1','sein'],[0,'verbs.q2','aufgedreht'],[0,'verbs.q3','bleiben'],[0,'verbs.q4','angerufen'],[0,'verbs.q5','beschrieben'],[0,'verbs.q6','werden'],[0,'syntax.q2','ich die Heizung aufgedreht habe'],[0,'syntax.q3','der Handwerker kam'],[0,'syntax.q5','der Vermieter schnell reagiert hat'],[0,'syntax.q6','Auf den Vermieter.'],[0,'nominal.q6','kleines'],[1,'verbs.q1','getroffen'],[1,'verbs.q2','vorbereitet'],[1,'verbs.q3','wiederholt'],[1,'verbs.q4','geholfen'],[1,'verbs.q5','müssen'],[1,'verbs.q6','uns'],[1,'syntax.q4','jemand einen Fehler gemacht hat'],[1,'nominal.q6','einer'],[2,'words.q4','Ein Sitzmöbel im Park.'],[2,'verbs.q1','vergessen'],[2,'verbs.q2','können'],[2,'verbs.q3','gesetzt'],[2,'verbs.q4','gelesen'],[2,'verbs.q5','beantwortet'],[2,'verbs.q6','lasse'],[2,'syntax.q2','ich meine Nachrichten nicht lesen konnte'],[2,'syntax.q5','Dem Sprecher stand eine größere Zeitmenge zur Verfügung.'],[2,'nominal.q3','eine'],[2,'nominal.q6','nächsten']]
 for(const[i,s,key]of expected){const q=drafts[i].definition.tasks.find(q=>q.id.endsWith(s));assert.equal(q.options.find(o=>o.id===q.correctOptionId).textDe,key,q.id)}
 for(const[i,s,p]of [[0,'syntax.q1','Obwohl ich die Heizung aufgedreht habe, blieb sie kalt'],[0,'syntax.q4','Bis der Handwerker kam, tranken wir Tee'],[0,'syntax.q6','Ich habe den Vermieter angerufen. Er hat einen Handwerker bestellt'],[1,'syntax.q3','Zuerst wiederholen wir Wörter. Danach üben wir Gespräche'],[1,'syntax.q5','Wenn jemand einen Fehler macht, helfen die anderen'],[2,'words.q4','Im Park setze ich mich auf eine Bank'],[2,'syntax.q1','Ich war unruhig, weil ich meine Nachrichten nicht lesen konnte'],[2,'syntax.q5','Ohne Handy hatte ich mehr Zeit als sonst']])assert.ok(drafts[i].definition.tasks.find(q=>q.id.endsWith(s)).promptDe.includes(p))
}
test('actual heater/group/phone keys keep concessive/time/reporting/conditional/causal clauses and past/comparative premises explicit',()=>{
 const added=sitovActualManifest44.drafts.slice(27);sitovAssert44Keys(added)
 for(const d of added)assert.ok(!d.definition.omittedCategories.some(c=>c.category==='past_tenses'));assert.ok(!added[2].definition.omittedCategories.some(c=>c.category==='comparatives'))
 for(const[i,d]of added.entries())for(const c of d.definition.competencies){const mapped=i===2&&c.category==='syntax';assert.deepEqual(c.mapping.topicIds,mapped?['sitov.topic.begruenden-a21']:[]);if(mapped){const[prefix,tail]=c.mapping.pendingReasonDe.split('Andere Einzelziele fehlen: ');for(const u of c.languageUnits.slice(0,2)){assert.ok(prefix.includes(u));assert.ok(!tail.includes(u))}for(const u of c.languageUnits.slice(2))assert.ok(tail.includes(u))}else for(const u of c.languageUnits)assert.ok(c.mapping.pendingReasonDe.includes(u))}
})
test('actual30 negative guards reject false spans, rationale/unit/form/topic/audio defects and wrong new keys/hidden premises',()=>{
 for(const mutate of [m=>{m.drafts[27].definition.tasks[0].sourceSpans[0].start++},m=>{m.drafts[28].definition.tasks[0].rationaleDe=''},m=>{m.drafts[29].definition.tasks[1].assessmentUnit=m.drafts[29].definition.tasks[0].assessmentUnit},m=>{const f=m.drafts[27].definition.reviewForms;f[1].questionIds[0]=f[0].questionIds[0]},m=>{m.drafts[28].definition.competencies[0].mapping.topicIds=['sitov.topic.ablauf-a12']}]){const copy=structuredClone(sitovActualManifest44);mutate(copy);assert.ok(sitovValidatePretestDrafts(copy,sources).length)}
 const audio={...sitovActualAudio44};delete audio[Object.keys(audio).at(-1)];assert.ok(sitovValidatePretestAudioAliases(sitovActualManifest44,audio).length)
 const added=sitovActualManifest44.drafts.slice(27),allA=structuredClone(added);for(const d of allA)for(const q of d.definition.tasks)q.correctOptionId=q.options.find(o=>o.id.endsWith('.a')).id;assert.ok(sitovDiversityErrors(allA).includes('unbalanced_labels'))
 for(const[i,s]of [[0,'syntax.q2'],[0,'syntax.q5'],[1,'syntax.q4'],[2,'syntax.q2'],[2,'verbs.q3']]){const wrong=structuredClone(added),q=wrong[i].definition.tasks.find(q=>q.id.endsWith(s));q.correctOptionId=q.options.find(o=>o.id!==q.correctOptionId).id;assert.throws(()=>sitovAssert44Keys(wrong))}
 const hidden=structuredClone(added);hidden[2].definition.tasks.find(q=>q.id.endsWith('words.q4')).promptDe='Was ist eine Bank?';assert.throws(()=>sitovAssert44Keys(hidden))
})

test('actual all30 M-reviewed definitions bind exact source hashes, complete answers and the corrected private mapping',()=>{
 assert.equal(sitovLatestMReviewed30.drafts.length,30)
 assert.deepEqual(sitovValidatePretestDrafts(sitovLatestMReviewed30,sources),[])
 assert.deepEqual(sitovValidatePretestAudioAliases(sitovLatestMReviewed30,sitovActualAudio44),[])
 for(const d of sitovLatestMReviewed30.drafts){assert.equal(d.review.status,'independent_editorial_checked_draft_only');assert.equal(d.review.reviewer,'sitov.agent.M');assert.equal(d.review.authorIdentity,'sitov.agent.S3');assert.equal(d.review.humanReview,false);assert.equal(d.review.calibrationStatus,'pending');assert.equal(d.active,false)}
 for(const r of sitovMReview30.approvedEditorialDrafts){const d=sitovLatestMReviewed30.drafts.find(d=>d.textId===r.textId);assert.equal(d.review.documentSha256,sitovHash(sitovMReview30Raw));assert.equal(d.review.documentRef,sitovMReview30.documentRef);assert.equal(d.review.definitionContentHash,sitovHash(JSON.stringify(d.definition)));assert.equal(d.review.textVersion,r.textVersion);assert.deepEqual(d.definition.tasks.map(q=>({questionId:q.id,correctTextDe:q.options.find(o=>o.id===q.correctOptionId).textDe})),r.correctAnswerTexts)}
})


test('epoch45 actual33/3168 validate directly with exact frozen M-reviewed30/2880 content and bytes',async()=>{
 assert.equal(sitovActualManifest45.drafts.length,33);assert.deepEqual(sitovActualManifest45.coverage,{total:60,authored:33,pending:27});assert.equal(Object.keys(sitovActualAudio45).length,3168)
 assert.deepEqual(sitovValidatePretestDrafts(sitovActualManifest45,sources),[]);assert.deepEqual(sitovValidatePretestAudioAliases(sitovActualManifest45,sitovActualAudio45),[])
 assert.equal(sitovHash(JSON.stringify(sitovLatestMReviewed30.drafts)),sitovEpoch45.original30ContentHash)
 for(const [value,content,bytes]of [[sitovLatestMReviewed30,sitovEpoch45.originalManifestContentHash,sitovEpoch45.originalManifestByteSha256],[sitovActualAudio44,sitovEpoch45.original2880AliasContentHash,sitovEpoch45.original2880AliasByteSha256],[sitovActualManifest45,sitovEpoch45.currentManifestContentHash,sitovEpoch45.currentManifestByteSha256],[sitovActualAudio45,sitovEpoch45.currentAliasContentHash,sitovEpoch45.currentAliasByteSha256]]){assert.equal(sitovHash(JSON.stringify(value)),content);assert.equal(sitovHash(JSON.stringify(value,null,2)+'\n'),bytes)}
 assert.equal(sitovHash(JSON.stringify(sitovActualManifest45,null,2)+'\n'),sitovEpoch45.currentManifestByteSha256)
 assert.equal(sitovHash(JSON.stringify(sitovActualAudio45,null,2)+'\n'),sitovEpoch45.currentAliasByteSha256)
})
test('next canonical A2.2sort1–3 bind all72 audited fields, standalone spans, six-unit cores and independent balanced forms',async()=>{
 const added=sitovActualManifest45.drafts.slice(30),refs=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/epoch45-reference-audio-candidates.json','utf8'))
 assert.deepEqual(sitovDiversityErrors(added),[]);assert.equal(Object.keys(refs).length,3)
 for(const[i,d]of added.entries()){
  const source=sources.rows.find(s=>s.id===d.textId),audit=sitovEpoch45.pools[i],chars=Array.from(source.text)
  assert.equal(d.level,'A2.2');assert.equal(source.sortOrder,i+1);assert.equal(audit.sourceBodyDe,source.text);assert.equal(refs['sitov-pretest-reference:'+d.textId],source.text);assert.equal(d.textVersion,sitovHash(source.text));assert.equal(d.active,false)
  assert.equal(d.review.status,'author_checked_independent_review_pending');assert.equal(d.review.reviewer,d.review.authorIdentity);assert.equal(d.review.humanReview,false);assert.equal(d.review.calibrationStatus,'pending');assert.equal(d.review.definitionContentHash,sitovHash(JSON.stringify(d.definition)));assert.equal(d.review.definitionContentHash,audit.definitionContentHash)
  assert.equal(d.definition.tasks.length,24);assert.equal(d.definition.competencies.length,4);assert.equal(new Set(d.definition.tasks.map(q=>q.assessmentUnit)).size,24)
  const[a,b]=d.definition.reviewForms;assert.equal(a.questionIds.length,12);assert.equal(b.questionIds.length,12);assert.ok(!a.questionIds.some(id=>b.questionIds.includes(id)))
  for(const core of d.definition.competencies){const qs=d.definition.tasks.filter(q=>q.competencyId===core.id);assert.equal(qs.length,6);assert.equal(core.languageUnits.length,6);for(const f of[a,b])assert.equal(f.questionIds.filter(id=>qs.some(q=>q.id===id)).length,3)}
  for(const[j,q]of d.definition.tasks.entries()){
   const r=audit.questions[j];assert.equal(r.questionId,q.id);assert.equal(r.publicPromptDe,q.promptDe);assert.deepEqual(r.publicOptions,q.options);assert.equal(r.correctOptionId,q.correctOptionId);assert.equal(r.correctAnswerTextDe,q.options.find(o=>o.id===q.correctOptionId).textDe);assert.equal(r.rationaleDe,q.rationaleDe);assert.equal(r.assessmentUnit,q.assessmentUnit);assert.deepEqual(r.sourceSpans,q.sourceSpans)
   assert.ok(!/\b(Frau|Freundin|Lehrerin|Schülerin|Nachbarin|Mutter|Schwester)\b/u.test(q.promptDe+' '+q.options.map(o=>o.textDe).join(' ')))
  }
  for(const span of [...d.definition.tasks.flatMap(q=>q.sourceSpans),...d.definition.competencies.flatMap(c=>c.sourceSpans)]){assert.equal(chars.slice(span.start,span.end).join(''),span.quote);assert.ok(!/[\p{L}\p{N}_]/u.test(chars[span.start-1]??''));assert.ok(!/[\p{L}\p{N}_]/u.test(chars[span.end]??''))}
 }
})


const sitovAssert45Keys=drafts=>{
 const expected=[[0,'verbs.q1','wollen'],[0,'verbs.q3','umsteigen'],[0,'verbs.q4','ankommen'],[0,'verbs.q5','Plusquamperfekt (Vorvergangenheit).'],[0,'verbs.q6','werden'],[0,'syntax.q2','wir einen anderen Zug nehmen konnten'],[0,'syntax.q4','wir in einer fremden Stadt umsteigen mussten'],[0,'nominal.q1','meinen'],[0,'nominal.q6','langen'],[1,'verbs.q1','gebeten'],[1,'verbs.q2','erklärt'],[1,'verbs.q4','Eine mögliche, vorsichtig formulierte Lösung.'],[1,'verbs.q5','zugestimmt'],[1,'verbs.q6','ausprobieren'],[1,'syntax.q3','ich am Nachmittag zu Hause sein muss'],[1,'nominal.q2','unserem'],[1,'nominal.q5','meinem'],[2,'verbs.q1','wollten'],[2,'verbs.q2','sich'],[2,'verbs.q3','Plusquamperfekt (Vorvergangenheit).'],[2,'verbs.q4','übernommen'],[2,'verbs.q5','ist'],[2,'syntax.q1','wir den Hof verändern könnten'],[2,'syntax.q2','Auf den Innenhof.'],[2,'syntax.q3','Die Zustimmung des Vermieters.'],[2,'syntax.q4','er zugestimmt hatte'],[2,'nominal.q1','unseres'],[2,'nominal.q5','bei dem']]
 for(const[i,s,key]of expected){const q=drafts[i].definition.tasks.find(q=>q.id.endsWith(s));assert.equal(q.options.find(o=>o.id===q.correctOptionId).textDe,key,q.id)}
 for(const[i,s,p]of [[0,'syntax.q3','Weil wir in einer fremden Stadt umsteigen mussten, war ich unsicher'],[0,'syntax.q5','Wir kamen zwei Stunden später an als geplant'],[1,'verbs.q4','Dafür könnte ich morgens früher anfangen'],[1,'syntax.q4','Nachmittags muss ich früher gehen. Dafür könnte ich morgens früher anfangen'],[2,'syntax.q2','Der Innenhof war leer. Wir überlegten, wie wir ihn verändern könnten'],[2,'syntax.q3','Nachdem der Vermieter zugestimmt hatte, bereiteten wir alles vor'],[2,'syntax.q6','Wir Nachbarn kennen uns jetzt besser als vorher']])assert.ok(drafts[i].definition.tasks.find(q=>q.id.endsWith(s)).promptDe.includes(p))
}
test('A2.2 actual trip/work/courtyard keys and public contexts distinguish separable arrival, pluperfect, cautious proposal and clauses',()=>{
 const added=sitovActualManifest45.drafts.slice(30);sitovAssert45Keys(added)
 for(const d of added){assert.ok(!d.definition.omittedCategories.some(c=>c.category==='past_tenses'));assert.ok(!d.definition.omittedCategories.some(c=>c.category==='comparatives'))}
 for(const[i,d]of added.entries())for(const c of d.definition.competencies){const mapped=i===1&&c.category==='verb_forms';assert.deepEqual(c.mapping.topicIds,mapped?['sitov.topic.vorschlaege-a22']:[]);if(mapped){const[prefix,tail]=c.mapping.pendingReasonDe.split('Andere Einzelziele fehlen: ');assert.ok(prefix.includes(c.languageUnits[3]));assert.ok(!tail.includes(c.languageUnits[3]));for(const u of c.languageUnits.filter((_,j)=>j!==3))assert.ok(tail.includes(u))}else for(const u of c.languageUnits)assert.ok(c.mapping.pendingReasonDe.includes(u))}
 const q=added[0].definition.tasks.find(q=>q.id.endsWith('verbs.q4'));assert.ok(q.sourceSpans[0].quote.includes('kamen'));assert.ok(q.sourceSpans[0].quote.endsWith('an'));assert.ok(q.rationaleDe.includes('ankommen'))
})
test('actual33 guards reject false evidence, repeated units/forms, crosslevel targets, stale audio and wrong A2.2 keys or hidden context',()=>{
 for(const mutate of [m=>{m.drafts[30].definition.tasks[0].sourceSpans[0].start++},m=>{m.drafts[31].definition.tasks[0].rationaleDe=''},m=>{m.drafts[32].definition.tasks[1].assessmentUnit=m.drafts[32].definition.tasks[0].assessmentUnit},m=>{const f=m.drafts[30].definition.reviewForms;f[1].questionIds[0]=f[0].questionIds[0]},m=>{m.drafts[31].definition.competencies[1].mapping.topicIds=['sitov.topic.begruenden-a21']}]){const copy=structuredClone(sitovActualManifest45);mutate(copy);assert.ok(sitovValidatePretestDrafts(copy,sources).length)}
 const audio={...sitovActualAudio45};delete audio[Object.keys(audio).at(-1)];assert.ok(sitovValidatePretestAudioAliases(sitovActualManifest45,audio).length)
 const added=sitovActualManifest45.drafts.slice(30),allA=structuredClone(added);for(const d of allA)for(const q of d.definition.tasks)q.correctOptionId=q.options.find(o=>o.id.endsWith('.a')).id;assert.ok(sitovDiversityErrors(allA).includes('unbalanced_labels'))
 for(const[i,s]of [[0,'verbs.q4'],[0,'verbs.q5'],[0,'syntax.q2'],[1,'syntax.q3'],[2,'syntax.q4']]){const wrong=structuredClone(added),q=wrong[i].definition.tasks.find(q=>q.id.endsWith(s));q.correctOptionId=q.options.find(o=>o.id!==q.correctOptionId).id;assert.throws(()=>sitovAssert45Keys(wrong))}
 const hidden=structuredClone(added);hidden[2].definition.tasks.find(q=>q.id.endsWith('syntax.q2')).promptDe='Worauf verweist ihn?';assert.throws(()=>sitovAssert45Keys(hidden))
})


test('epoch46 exact full-task/review/alias delta preserves immutable45 bytes, old30 and every correct answer/id/source/matrix/form',async()=>{
 assert.equal(sitovDelta46.questions.length,38);assert.equal(sitovDelta46.reviewedQuestionCount,72);assert.equal(sitovDelta46.changedAliases.length,76);assert.equal(sitovDelta46.publicPromptChangeCount,2)
 for(const[value,hash,bytes]of [[sitovActualManifest45,sitovDelta46.previousManifestContentHash,sitovDelta46.previousManifestByteSha256],[sitovActualManifest46,sitovDelta46.currentManifestContentHash,sitovDelta46.currentManifestByteSha256],[sitovActualAudio45,sitovDelta46.previousAudioContentHash,sitovDelta46.previousAudioByteSha256],[sitovActualAudio46,sitovDelta46.currentAudioContentHash,sitovDelta46.currentAudioByteSha256]]){assert.equal(sitovHash(JSON.stringify(value)),hash);assert.equal(sitovHash(JSON.stringify(value,null,2)+'\n'),bytes)}
 assert.equal(sitovHash(JSON.stringify(sitovActualManifest46,null,2)+'\n'),sitovDelta46.currentManifestByteSha256)
 assert.equal(sitovHash(JSON.stringify(sitovActualAudio46,null,2)+'\n'),sitovDelta46.currentAudioByteSha256)
 assert.deepEqual(sitovActualManifest46.drafts.slice(0,30),sitovActualManifest45.drafts.slice(0,30));assert.equal(sitovHash(JSON.stringify(sitovActualManifest46.drafts.slice(0,30))),sitovDelta46.original30ContentHash)
 assert.deepEqual(Object.entries(sitovActualAudio46).slice(0,2880),Object.entries(sitovActualAudio45).slice(0,2880));assert.equal(sitovHash(JSON.stringify(Object.fromEntries(Object.entries(sitovActualAudio46).slice(0,2880)))),sitovDelta46.original2880AliasContentHash)
 assert.deepEqual(Object.keys(sitovActualAudio46),Object.keys(sitovActualAudio45));assert.deepEqual(Object.keys(sitovActualAudio46).filter(k=>sitovActualAudio46[k]!==sitovActualAudio45[k]),sitovDelta46.changedAliases.map(r=>r.key))
 for(const r of sitovDelta46.questions){const q=sitovActualManifest46.drafts.find(d=>d.textId===r.textId).definition.tasks.find(q=>q.id===r.questionId),old=r.previousTask;assert.deepEqual(q,r.currentTask);assert.equal(q.correctOptionId,old.correctOptionId);assert.equal(q.options.find(o=>o.id===q.correctOptionId).textDe,old.options.find(o=>o.id===old.correctOptionId).textDe);assert.deepEqual(q.options.map(o=>o.id),old.options.map(o=>o.id));assert.deepEqual(q.sourceSpans,old.sourceSpans);const restored=structuredClone(q);restored.promptDe=old.promptDe;restored.options=old.options;restored.rationaleDe=old.rationaleDe;assert.deepEqual(restored,old);for(const a of r.previousAliasEntries)assert.equal(sitovActualAudio45[a.key],a.textDe);for(const a of r.currentAliasEntries)assert.equal(sitovActualAudio46[a.key],a.textDe)}
 for(const d of sitovActualManifest46.drafts.slice(30)){const old=sitovActualManifest45.drafts.find(o=>o.textId===d.textId),a=structuredClone(d.definition),b=structuredClone(old.definition);delete a.tasks;delete b.tasks;assert.deepEqual(a,b)}
})
const sitovAssertQuality46=drafts=>{
 for(const d of drafts)for(const q of d.definition.tasks)for(const o of q.options)if(o.id!==q.correctOptionId)assert.ok(!/ausdrücklich|ausschließlich|Kuchen|Fahrrad|Pullover|Koffer|Heizungs|Körpergröße|Zugfarbe|Zug geschrieben/u.test(o.textDe),q.id+' unrelated/scaffolded distractor')
 const examples=[[0,'words.q1',['Der Zug kommt genau zur vorgesehenen Zeit.','Der Zug kommt früher als vorgesehen.']],[0,'verbs.q2',['Eine Verpflichtung in der Vergangenheit.','Ein Wunsch in der Vergangenheit.']],[0,'syntax.q5',['Die tatsächliche und die geplante Abfahrtszeit.','Die Wartezeit auf dem Bahnsteig und die reine Fahrzeit.']],[1,'words.q4',['Eine verbindliche Anordnung, die keine Wahl lässt.','Eine bereits endgültig getroffene Entscheidung.']],[1,'syntax.q5',['Der Beginn liegt eine Stunde nach dem bisherigen Beginn.','Der Beginn bleibt gleich, das Ende liegt eine Stunde früher.']],[2,'words.q4',['Blumen mit Wasser versorgen.','Blumen aus dem Beet abschneiden oder pflücken.']],[2,'words.q5',['Jeder hat für sich einen eigenen Plan gemacht.','Ein Nachbar hat den Plan allein für die ganze Gruppe gemacht.']],[2,'syntax.q5',['Die Schönheit dieses Hofs und die Schönheit eines anderen Hofs.','Die jetzige Schönheit des Hofs ohne Vergleich mit einem früheren Zustand.']]]
 for(const[i,s,wrong]of examples){const q=drafts[i].definition.tasks.find(q=>q.id.endsWith(s));assert.deepEqual(q.options.filter(o=>o.id!==q.correctOptionId).map(o=>o.textDe),wrong)}
 assert.ok(drafts[2].definition.tasks.find(q=>q.id.endsWith('verbs.q6')).promptDe.includes('kennen uns gegenseitig'))
 assert.ok(drafts[2].definition.tasks.find(q=>q.id.endsWith('syntax.q2')).promptDe.includes('Der Innenhof unseres Hauses war leer. Wir Nachbarn'))
}
test('repaired A2.2 distractors stay within lexical/modal/temporal/causal/reference fields with explicit pronoun premises',()=>{
 const added=sitovActualManifest46.drafts.slice(30);sitovAssertQuality46(added);assert.deepEqual(sitovDiversityErrors(added),[])
 assert.throws(()=>sitovAssertQuality46(sitovActualManifest45.drafts.slice(30)))
 for(const[i,s]of [[0,'words.q2'],[0,'syntax.q5'],[1,'words.q4'],[2,'syntax.q6']]){const bad=structuredClone(added),q=bad[i].definition.tasks.find(q=>q.id.endsWith(s));q.options.find(o=>o.id!==q.correctOptionId).textDe='Ein leerer Koffer.';assert.throws(()=>sitovAssertQuality46(bad))}
 const hidden=structuredClone(added);hidden[2].definition.tasks.find(q=>q.id.endsWith('verbs.q6')).promptDe='Was bedeutet wir kennen uns?';assert.throws(()=>sitovAssertQuality46(hidden))
})
test('actual repaired33/3168 validate and all72 current private/public audit records bind honest new pending reviews',()=>{
 assert.equal(sitovActualManifest46.drafts.length,33);assert.equal(Object.keys(sitovActualAudio46).length,3168);assert.deepEqual(sitovValidatePretestDrafts(sitovActualManifest46,sources),[]);assert.deepEqual(sitovValidatePretestAudioAliases(sitovActualManifest46,sitovActualAudio46),[])
 for(const p of sitovDelta46.reviewedCurrentPools){const d=sitovActualManifest46.drafts.find(d=>d.textId===p.textId);assert.equal(d.active,false);assert.equal(d.review.status,'author_checked_independent_review_pending');assert.equal(d.review.authorIdentity,d.review.reviewer);assert.equal(d.review.humanReview,false);assert.equal(d.review.calibrationStatus,'pending');assert.equal(d.review.definitionContentHash,sitovHash(JSON.stringify(d.definition)));assert.equal(p.definitionContentHash,d.review.definitionContentHash);assert.equal(p.questions.length,24);for(const[j,q]of d.definition.tasks.entries()){const a=p.questions[j];assert.equal(a.questionId,q.id);assert.equal(a.publicPromptDe,q.promptDe);assert.deepEqual(a.publicOptions,q.options);assert.equal(a.correctOptionId,q.correctOptionId);assert.equal(a.correctAnswerTextDe,q.options.find(o=>o.id===q.correctOptionId).textDe);assert.equal(a.rationaleDe,q.rationaleDe);assert.equal(a.assessmentUnit,q.assessmentUnit);assert.deepEqual(a.sourceSpans,q.sourceSpans)}}
})

test('actual all33 M-reviewed pools retain all prior proofs and exact repaired semantic distractors',()=>{
 assert.equal(sitovLatestMReviewed33.drafts.length,33);assert.deepEqual(sitovValidatePretestDrafts(sitovLatestMReviewed33,sources),[]);assert.deepEqual(sitovValidatePretestAudioAliases(sitovLatestMReviewed33,sitovActualAudio46),[])
 for(const d of sitovLatestMReviewed33.drafts){assert.equal(d.active,false);assert.equal(d.review.reviewer,'sitov.agent.M');assert.equal(d.review.status,'independent_editorial_checked_draft_only');assert.equal(d.review.humanReview,false);assert.equal(d.review.calibrationStatus,'pending')}
 for(const r of sitovMReview33.approvedEditorialDrafts){const d=sitovLatestMReviewed33.drafts.find(d=>d.textId===r.textId);assert.equal(d.review.documentSha256,sitovHash(sitovMReview33Raw));assert.equal(d.review.documentRef,sitovMReview33.documentRef);assert.equal(d.review.definitionContentHash,sitovHash(JSON.stringify(d.definition)));assert.equal(d.review.textVersion,r.textVersion);assert.deepEqual(d.definition.tasks.map(q=>({questionId:q.id,correctTextDe:q.options.find(o=>o.id===q.correctOptionId).textDe})),r.correctAnswerTexts)}
})


test('epoch47 actual36/3456 validate directly with exact frozen M-reviewed33/3168 content and bytes',async()=>{
 assert.equal(sitovActualManifest47.drafts.length,36);assert.deepEqual(sitovActualManifest47.coverage,{total:60,authored:36,pending:24});assert.equal(Object.keys(sitovActualAudio47).length,3456)
 assert.deepEqual(sitovValidatePretestDrafts(sitovActualManifest47,sources),[]);assert.deepEqual(sitovValidatePretestAudioAliases(sitovActualManifest47,sitovActualAudio47),[])
 assert.equal(sitovHash(JSON.stringify(sitovLatestMReviewed33.drafts)),sitovEpoch47.original33ContentHash)
 for(const [value,content,bytes]of [[sitovLatestMReviewed33,sitovEpoch47.originalManifestContentHash,sitovEpoch47.originalManifestByteSha256],[sitovActualAudio46,sitovEpoch47.original3168AliasContentHash,sitovEpoch47.original3168AliasByteSha256],[sitovActualManifest47,sitovEpoch47.currentManifestContentHash,sitovEpoch47.currentManifestByteSha256],[sitovActualAudio47,sitovEpoch47.currentAliasContentHash,sitovEpoch47.currentAliasByteSha256]]){assert.equal(sitovHash(JSON.stringify(value)),content);assert.equal(sitovHash(JSON.stringify(value,null,2)+'\n'),bytes)}
 assert.equal(sitovHash(JSON.stringify(sitovActualManifest47,null,2)+'\n'),sitovEpoch47.currentManifestByteSha256)
 assert.equal(sitovHash(JSON.stringify(sitovActualAudio47,null,2)+'\n'),sitovEpoch47.currentAliasByteSha256)
})
test('next canonical A2.2sort4–6 bind all72 audited fields, standalone spans, six-unit cores and independent balanced forms',async()=>{
 const added=sitovActualManifest47.drafts.slice(33),refs=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/epoch47-reference-audio-candidates.json','utf8'))
 assert.deepEqual(sitovDiversityErrors(added),[]);assert.equal(Object.keys(refs).length,3)
 for(const[i,d]of added.entries()){
  const source=sources.rows.find(s=>s.id===d.textId),audit=sitovEpoch47.pools[i],chars=Array.from(source.text)
  assert.equal(d.level,'A2.2');assert.equal(source.sortOrder,i+4);assert.equal(audit.sourceBodyDe,source.text);assert.equal(refs['sitov-pretest-reference:'+d.textId],source.text);assert.equal(d.textVersion,sitovHash(source.text));assert.equal(d.active,false)
  assert.equal(d.review.status,'author_checked_independent_review_pending');assert.equal(d.review.reviewer,d.review.authorIdentity);assert.equal(d.review.humanReview,false);assert.equal(d.review.calibrationStatus,'pending');assert.equal(d.review.definitionContentHash,sitovHash(JSON.stringify(d.definition)));assert.equal(d.review.definitionContentHash,audit.definitionContentHash)
  assert.equal(d.definition.tasks.length,24);assert.equal(d.definition.competencies.length,4);assert.equal(new Set(d.definition.tasks.map(q=>q.assessmentUnit)).size,24)
  const[a,b]=d.definition.reviewForms;assert.equal(a.questionIds.length,12);assert.equal(b.questionIds.length,12);assert.ok(!a.questionIds.some(id=>b.questionIds.includes(id)))
  for(const core of d.definition.competencies){const qs=d.definition.tasks.filter(q=>q.competencyId===core.id);assert.equal(qs.length,6);assert.equal(core.languageUnits.length,6);for(const f of[a,b])assert.equal(f.questionIds.filter(id=>qs.some(q=>q.id===id)).length,3)}
  for(const[j,q]of d.definition.tasks.entries()){
   const r=audit.questions[j];assert.equal(r.questionId,q.id);assert.equal(r.publicPromptDe,q.promptDe);assert.deepEqual(r.publicOptions,q.options);assert.equal(r.correctOptionId,q.correctOptionId);assert.equal(r.correctAnswerTextDe,q.options.find(o=>o.id===q.correctOptionId).textDe);assert.equal(r.rationaleDe,q.rationaleDe);assert.equal(r.assessmentUnit,q.assessmentUnit);assert.deepEqual(r.sourceSpans,q.sourceSpans)
   assert.ok(!/\b(Frau|Freundin|Lehrerin|Schülerin|Nachbarin|Mutter|Schwester)\b/u.test(q.promptDe+' '+q.options.map(o=>o.textDe).join(' ')))
  }
  for(const span of [...d.definition.tasks.flatMap(q=>q.sourceSpans),...d.definition.competencies.flatMap(c=>c.sourceSpans)]){assert.equal(chars.slice(span.start,span.end).join(''),span.quote);assert.ok(!/[\p{L}\p{N}_]/u.test(chars[span.start-1]??''));assert.ok(!/[\p{L}\p{N}_]/u.test(chars[span.end]??''))}
 }
})



const sitovAssert47Keys=drafts=>{
 const expected=[[0,'words.q1','Die untere Fläche, auf der man steht und geht.'],[0,'words.q2','Ein Beleg über einen bereits bezahlten Einkauf.'],[0,'verbs.q2','sich'],[0,'verbs.q3','bin'],[0,'verbs.q4','ist'],[0,'verbs.q5','dazugeholt'],[0,'verbs.q6','ankommen'],[0,'syntax.q4','mit dem Schuh passiert ist'],[0,'syntax.q5','das Geschäft mich anruft'],[0,'nominal.q2','den'],[0,'nominal.q3','dem'],[1,'words.q6','Beide helfen jeweils dem anderen.'],[1,'verbs.q1','lernt'],[1,'verbs.q2','gezeigt'],[1,'verbs.q3','wiederhole'],[1,'verbs.q4','anhören'],[1,'verbs.q5','beschlossen'],[1,'syntax.q1','ich zu Hause übe'],[1,'syntax.q2','ich jeden Tag wenige Wörter lerne'],[1,'syntax.q5','für zwanzig Minuten'],[1,'nominal.q4','ältere'],[2,'verbs.q1','Präteritum im Vorgangspassiv.'],[2,'verbs.q2','erfahren'],[2,'verbs.q3','angemeldet'],[2,'verbs.q4','bekommen'],[2,'verbs.q6','mithelfen'],[2,'syntax.q1','wir sauber machen sollten'],[2,'syntax.q3','Auf den älteren Mann.'],[2,'syntax.q5','Auf den Wegen lag weniger Schmutz als vorher.'],[2,'nominal.q4','älteren'],[2,'nominal.q5','mir']]
 for(const[i,s,key]of expected){const q=drafts[i].definition.tasks.find(q=>q.id.endsWith(s));assert.equal(q.options.find(o=>o.id===q.correctOptionId).textDe,key,q.id)}
 for(const[i,s,p]of [[0,'syntax.q3','Die Sohle hat sich gelöst. Deshalb gehe ich ins Geschäft'],[0,'syntax.q6','Das Geschäft ruft mich an, sobald ein neues Paar ankommt'],[1,'syntax.q3','Zuerst achte ich auf den Inhalt, später auf die Aussprache'],[1,'syntax.q4','Wir treffen uns zweimal in der Woche'],[2,'syntax.q2','Während wir arbeiteten, erzählte der Mann vom Stadtteil'],[2,'syntax.q3','Ich war mit einem älteren Mann in einer Gruppe. Er erzählte mir vom Stadtteil']])assert.ok(drafts[i].definition.tasks.find(q=>q.id.endsWith(s)).promptDe.includes(p))
 for(const d of drafts)for(const q of d.definition.tasks)for(const o of q.options)if(o.id!==q.correctOptionId)assert.ok(!/ausdrücklich|ausschließlich|Kuchen|Fahrrad|Koffer|Zugfarbe|Körpergröße/u.test(o.textDe),q.id+' field-inappropriate distractor')
}
test('new complaint/study/volunteer questions use plausible confusions and actual indirect clauses, frequency/duration and passive',()=>{
 const added=sitovActualManifest47.drafts.slice(33);sitovAssert47Keys(added)
 for(const d of added){assert.ok(!d.definition.omittedCategories.some(c=>c.category==='past_tenses'));for(const c of d.definition.competencies){assert.deepEqual(c.mapping.topicIds,[]);for(const u of c.languageUnits)assert.ok(c.mapping.pendingReasonDe.includes(u))}}
 for(const d of added.slice(1))assert.ok(!d.definition.omittedCategories.some(c=>c.category==='comparatives'))
 const cases=[[0,'words.q6',['Er hat die beschädigten Schuhe bereits repariert.','Er hat die Schuhe schon durch ein neues Paar ersetzt.']],[1,'syntax.q5',['zweimal','in der Woche']],[2,'syntax.q2',['Das Erzählen beginnt erst nach dem Ende der Arbeit.','Das Erzählen ist schon vor Beginn der Arbeit beendet.']]]
 for(const[i,s,wrong]of cases){const q=added[i].definition.tasks.find(q=>q.id.endsWith(s));assert.deepEqual(q.options.filter(o=>o.id!==q.correctOptionId).map(o=>o.textDe).sort(),wrong.sort())}
})
test('actual36 negative guards reject false source evidence, unit/form/topic/audio defects, wrong passive/key and unrelated distractors',()=>{
 for(const mutate of [m=>{m.drafts[33].definition.tasks[0].sourceSpans[0].start++},m=>{m.drafts[34].definition.tasks[0].rationaleDe=''},m=>{m.drafts[35].definition.tasks[1].assessmentUnit=m.drafts[35].definition.tasks[0].assessmentUnit},m=>{const f=m.drafts[33].definition.reviewForms;f[1].questionIds[0]=f[0].questionIds[0]},m=>{m.drafts[34].definition.competencies[0].mapping.topicIds=['sitov.topic.begruenden-a21']}]){const copy=structuredClone(sitovActualManifest47);mutate(copy);assert.ok(sitovValidatePretestDrafts(copy,sources).length)}
 const audio={...sitovActualAudio47};delete audio[Object.keys(audio).at(-1)];assert.ok(sitovValidatePretestAudioAliases(sitovActualManifest47,audio).length)
 const added=sitovActualManifest47.drafts.slice(33),allA=structuredClone(added);for(const d of allA)for(const q of d.definition.tasks)q.correctOptionId=q.options.find(o=>o.id.endsWith('.a')).id;assert.ok(sitovDiversityErrors(allA).includes('unbalanced_labels'))
 for(const[i,s]of [[0,'syntax.q5'],[1,'syntax.q5'],[1,'nominal.q4'],[2,'verbs.q1'],[2,'syntax.q1']]){const wrong=structuredClone(added),q=wrong[i].definition.tasks.find(q=>q.id.endsWith(s));q.correctOptionId=q.options.find(o=>o.id!==q.correctOptionId).id;assert.throws(()=>sitovAssert47Keys(wrong))}
 const bad=structuredClone(added);bad[0].definition.tasks[0].options.find(o=>o.id!==bad[0].definition.tasks[0].correctOptionId).textDe='Ein leerer Koffer.';assert.throws(()=>sitovAssert47Keys(bad))
 const hidden=structuredClone(added);hidden[2].definition.tasks.find(q=>q.id.endsWith('syntax.q3')).promptDe='Auf wen verweist er?';assert.throws(()=>sitovAssert47Keys(hidden))
})

test('actual36 independent M reviews bind exact source and definition while all92 prior checks retain author provenance',()=>{assert.equal(sitovLatestMReviewed36.drafts.length,36);assert.deepEqual(sitovValidatePretestDrafts(sitovLatestMReviewed36,sources),[]);assert.deepEqual(sitovValidatePretestAudioAliases(sitovLatestMReviewed36,sitovActualAudio47),[]);for(const r of sitovMReview36.approvedEditorialDrafts){const d=sitovLatestMReviewed36.drafts.find(d=>d.textId===r.textId);assert.equal(d.active,false);assert.equal(d.review.documentSha256,sitovHash(sitovMReview36Raw));assert.equal(d.review.reviewer,'sitov.agent.M');assert.equal(d.review.humanReview,false);assert.equal(d.review.calibrationStatus,'pending');assert.equal(d.review.definitionContentHash,sitovHash(JSON.stringify(d.definition)));assert.equal(d.review.textVersion,r.textVersion);assert.deepEqual(d.definition.tasks.map(q=>({questionId:q.id,correctTextDe:q.options.find(o=>o.id===q.correctOptionId).textDe})),r.correctAnswerTexts)}})

test('epoch48 actual39/3744 validate directly with exact frozen M-reviewed36/3456 content and bytes',async()=>{
 assert.equal(sitovActualManifest48.drafts.length,39);assert.deepEqual(sitovActualManifest48.coverage,{total:60,authored:39,pending:21});assert.equal(Object.keys(sitovActualAudio48).length,3744)
 assert.deepEqual(sitovValidatePretestDrafts(sitovActualManifest48,sources),[]);assert.deepEqual(sitovValidatePretestAudioAliases(sitovActualManifest48,sitovActualAudio48),[])
 assert.equal(sitovHash(JSON.stringify(sitovLatestMReviewed36.drafts)),sitovEpoch48.original36ContentHash)
 for(const [value,content,bytes]of [[sitovLatestMReviewed36,sitovEpoch48.originalManifestContentHash,sitovEpoch48.originalManifestByteSha256],[sitovActualAudio47,sitovEpoch48.original3456AliasContentHash,sitovEpoch48.original3456AliasByteSha256],[sitovActualManifest48,sitovEpoch48.currentManifestContentHash,sitovEpoch48.currentManifestByteSha256],[sitovActualAudio48,sitovEpoch48.currentAliasContentHash,sitovEpoch48.currentAliasByteSha256]]){assert.equal(sitovHash(JSON.stringify(value)),content);assert.equal(sitovHash(JSON.stringify(value,null,2)+'\n'),bytes)}
 assert.equal(sitovHash(JSON.stringify(sitovActualManifest48,null,2)+'\n'),sitovEpoch48.currentManifestByteSha256)
 assert.equal(sitovHash(JSON.stringify(sitovActualAudio48,null,2)+'\n'),sitovEpoch48.currentAliasByteSha256)
})
test('next canonical A2.2sort7–9 bind all72 audited fields, standalone spans, six-unit cores and independent balanced forms',async()=>{
 const added=sitovActualManifest48.drafts.slice(36),refs=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/epoch48-reference-audio-candidates.json','utf8'))
 assert.deepEqual(sitovDiversityErrors(added),[]);assert.equal(Object.keys(refs).length,3)
 for(const[i,d]of added.entries()){
  const source=sources.rows.find(s=>s.id===d.textId),audit=sitovEpoch48.pools[i],chars=Array.from(source.text)
  assert.equal(d.level,'A2.2');assert.equal(source.sortOrder,i+7);assert.equal(audit.sourceBodyDe,source.text);assert.equal(refs['sitov-pretest-reference:'+d.textId],source.text);assert.equal(d.textVersion,sitovHash(source.text));assert.equal(d.active,false)
  assert.equal(d.review.status,'author_checked_independent_review_pending');assert.equal(d.review.reviewer,d.review.authorIdentity);assert.equal(d.review.humanReview,false);assert.equal(d.review.calibrationStatus,'pending');assert.equal(d.review.definitionContentHash,sitovHash(JSON.stringify(d.definition)));assert.equal(d.review.definitionContentHash,audit.definitionContentHash)
  assert.equal(d.definition.tasks.length,24);assert.equal(d.definition.competencies.length,4);assert.equal(new Set(d.definition.tasks.map(q=>q.assessmentUnit)).size,24)
  const[a,b]=d.definition.reviewForms;assert.equal(a.questionIds.length,12);assert.equal(b.questionIds.length,12);assert.ok(!a.questionIds.some(id=>b.questionIds.includes(id)))
  for(const core of d.definition.competencies){const qs=d.definition.tasks.filter(q=>q.competencyId===core.id);assert.equal(qs.length,6);assert.equal(core.languageUnits.length,6);for(const f of[a,b])assert.equal(f.questionIds.filter(id=>qs.some(q=>q.id===id)).length,3)}
  for(const[j,q]of d.definition.tasks.entries()){
   const r=audit.questions[j];assert.equal(r.questionId,q.id);assert.equal(r.publicPromptDe,q.promptDe);assert.deepEqual(r.publicOptions,q.options);assert.equal(r.correctOptionId,q.correctOptionId);assert.equal(r.correctAnswerTextDe,q.options.find(o=>o.id===q.correctOptionId).textDe);assert.equal(r.rationaleDe,q.rationaleDe);assert.equal(r.assessmentUnit,q.assessmentUnit);assert.deepEqual(r.sourceSpans,q.sourceSpans)
   assert.ok(!/\b(Frau|Freundin|Lehrerin|Schülerin|Nachbarin|Mutter|Schwester)\b/u.test(q.promptDe+' '+q.options.map(o=>o.textDe).join(' ')))
  }
  for(const span of [...d.definition.tasks.flatMap(q=>q.sourceSpans),...d.definition.competencies.flatMap(c=>c.sourceSpans)]){assert.equal(chars.slice(span.start,span.end).join(''),span.quote);assert.ok(!/[\p{L}\p{N}_]/u.test(chars[span.start-1]??''));assert.ok(!/[\p{L}\p{N}_]/u.test(chars[span.end]??''))}
 }
})




const sitovAssert48Keys=ds=>{
 for(const[i,id,key]of [[0, "verbs.q1", "Plusquamperfekt (Vorvergangenheit)."], [0, "verbs.q5", "Eine gedachte Reaktion in einer vergangenen Situation."], [0, "syntax.q3", "er Donnerstag verstanden hatte"], [0, "nominal.q6", "des"], [1, "verbs.q3", "aufzupassen"], [1, "verbs.q4", "hingestellt"], [1, "syntax.q2", "Um ihre Sorgen um die Katze zu vermeiden."], [1, "nominal.q6", "glücklichsten"], [2, "verbs.q4", "entschieden"], [2, "syntax.q2", "Die Müdigkeit ist so stark, dass konzentriertes Lernen nicht gelingt."], [2, "syntax.q3", "man einen eigenen Laptop braucht"], [2, "nominal.q3", "günstiger"]]){const q=ds[i].definition.tasks.find(q=>q.id.endsWith(id));assert.equal(q.options.find(o=>o.id===q.correctOptionId).textDe,key)}
 for(const[i,id,p]of [[0, "syntax.q2", "Er hatte Donnerstag statt Dienstag verstanden"], [0, "syntax.q4", "Früher hätte ich mich geärgert. Diesmal blieb ich ruhig"], [0, "nominal.q5", "Der Mitarbeiter und ich suchten eine Lösung. Wir beide blieben ruhig"], [1, "syntax.q2", "Ich schicke den Freunden ein Foto, damit sie sich keine Sorgen machen"], [1, "syntax.q4", "Ich betreute die Katze gut. Trotzdem war sie bei der Rückkehr ihrer Besitzer am glücklichsten"], [2, "syntax.q1", "Obwohl der Abendkurs günstiger ist, wähle ich den Wochenendkurs"], [2, "syntax.q2", "Ich bin zu müde, um konzentriert zu lernen"], [2, "syntax.q5", "Ein Kurs findet am Wochenende statt, der andere an zwei Abenden"]])assert.ok(ds[i].definition.tasks.find(q=>q.id.endsWith(id)).promptDe.includes(p))
 for(const d of ds)for(const q of d.definition.tasks)for(const o of q.options)if(o.id!==q.correctOptionId)assert.ok(!/ausdrücklich|ausschließlich|Kuchen|Fahrrad|Koffer|Zugfarbe|Körpergröße/u.test(o.textDe))
}
test('new phone/pet/course questions preserve past modality, purpose and degree hindrance with visible premises',()=>{const ds=sitovActualManifest48.drafts.slice(36);sitovAssert48Keys(ds);for(const d of ds){assert.ok(!d.definition.omittedCategories.some(c=>c.category==='past_tenses'));assert.ok(!d.definition.omittedCategories.some(c=>c.category==='comparatives'));for(const c of d.definition.competencies){assert.deepEqual(c.mapping.topicIds,[]);for(const u of c.languageUnits)assert.ok(c.mapping.pendingReasonDe.includes(u))}}})
test('actual39 negative guards reject spans, missing audio, wrong modality keys and hidden premises',()=>{for(const mutate of [m=>m.drafts[36].definition.tasks[0].sourceSpans[0].start++,m=>m.drafts[37].definition.tasks[0].rationaleDe='',m=>m.drafts[38].definition.competencies[0].mapping.topicIds=['sitov.topic.begruenden-a21']]){const m=structuredClone(sitovActualManifest48);mutate(m);assert.ok(sitovValidatePretestDrafts(m,sources).length)}const a={...sitovActualAudio48};delete a[Object.keys(a).at(-1)];assert.ok(sitovValidatePretestAudioAliases(sitovActualManifest48,a).length);for(const[i,id]of [[0,'verbs.q1'],[1,'syntax.q2'],[2,'syntax.q2']]){const ds=structuredClone(sitovActualManifest48.drafts.slice(36)),q=ds[i].definition.tasks.find(q=>q.id.endsWith(id));q.correctOptionId=q.options.find(o=>o.id!==q.correctOptionId).id;assert.throws(()=>sitovAssert48Keys(ds))}const hidden=structuredClone(sitovActualManifest48.drafts.slice(36));hidden[2].definition.tasks.find(q=>q.id.endsWith('syntax.q5')).promptDe='Was bedeutet der andere?';assert.throws(()=>sitovAssert48Keys(hidden))})

test('actual quality18 repairs bind independent proof, unchanged54 and all previous97 source hashes',()=>{assert.equal(sitovQualityCurrent.drafts.length,39);assert.deepEqual(sitovValidatePretestDrafts(sitovQualityCurrent,sources),[]);assert.deepEqual(sitovValidatePretestAudioAliases(sitovQualityCurrent,sitovQualityCurrentAudio),[]);assert.equal(sitovHash(sitovQualityPatchRaw),sitovQualityReview.sourcePatchSha256);assert.deepEqual(sitovQualityCurrent.drafts.slice(3),sitovActualManifest48.drafts.slice(3));for(const r of sitovQualityPatch.pools){const d=sitovQualityCurrent.drafts.find(d=>d.textId===r.textId);assert.deepEqual(d.definition,r.candidateDefinition);assert.equal(d.review.documentSha256,sitovHash(sitovQualityReviewRaw));assert.equal(d.review.definitionContentHash,sitovHash(JSON.stringify(d.definition)));assert.equal(d.review.humanReview,false);assert.equal(d.review.calibrationStatus,'pending');assert.equal(d.active,false)}for(const r of sitovQualityPatch.patches){const q=sitovQualityCurrent.drafts.find(d=>d.textId===r.textId).definition.tasks.find(q=>q.id===r.questionId);assert.deepEqual(q,r.currentTask);for(const e of r.currentAudioAliasEntries)assert.equal(sitovQualityCurrentAudio[e.alias],e.text)}})
test('quality repair mutation cannot silently change unrelated fields, keys or omit current spoken aliases',()=>{for(const r of sitovQualityPatch.patches){const a=r.previousTask,b=r.currentTask;for(const k of Object.keys(a).filter(k=>!['promptDe','options','rationaleDe'].includes(k)))assert.deepEqual(a[k],b[k]);assert.deepEqual(a.options.map(o=>o.id),b.options.map(o=>o.id));assert.equal(a.correctOptionId,b.correctOptionId)}const bad={...sitovQualityCurrentAudio};delete bad[sitovQualityPatch.patches[0].currentAudioAliasEntries[0].alias];assert.ok(sitovValidatePretestAudioAliases(sitovQualityCurrent,bad).length);assert.equal(sitovQualityPatch.patches.filter(r=>r.correctWordingChange).length,1)})

const sitovAssert49Constructs=manifest=>{
 const question=id=>manifest.drafts.flatMap(d=>d.definition.tasks).find(q=>q.id===id)
 const direction=question('sitov.pretest.a22-08.nominal.q1')
 assert.ok(direction.promptDe.includes('gehört den Freunden')&&direction.promptDe.includes('ist das Ziel meines Weges'))
 assert.equal(direction.options.find(o=>o.id===direction.correctOptionId).textDe,'ihre')
 const syntax=question('sitov.pretest.a22-07.syntax.q6')
 assert.ok(syntax.promptDe.includes('Wortfolge')&&syntax.promptDe.includes('»In Zukunft …«')&&syntax.promptDe.includes('vollständigen Aussagesatz'))
 assert.equal(syntax.options.find(o=>o.id===syntax.correctOptionId).textDe,'wiederhole ich Datum und Uhrzeit')
 assert.deepEqual(syntax.options.filter(o=>o.id!==syntax.correctOptionId).map(o=>o.textDe).sort(),['ich Datum und Uhrzeit wiederhole','ich wiederhole Datum und Uhrzeit'].sort())
 assert.equal(syntax.assessmentUnit,'In Zukunft Vorfeld Verbzweitstellung koordiniertes Objekt')
 assert.equal(syntax.sourceSpans[0].quote,'In Zukunft wiederhole ich Datum und Uhrzeit')
 assert.ok(syntax.rationaleDe.includes('Vorfeld')&&syntax.rationaleDe.includes('zweiter Satzgliedposition')&&syntax.rationaleDe.includes('Subjekt ich'))
 const verb=question('sitov.pretest.a22-09.verbs.q6')
 assert.ok(verb.promptDe.includes('Präsensform von »stellen«')&&verb.promptDe.includes('»Die Schule ___ Geräte zur Verfügung«'))
 assert.equal(verb.options.find(o=>o.id===verb.correctOptionId).textDe,'stellt')
 assert.deepEqual(verb.options.filter(o=>o.id!==verb.correctOptionId).map(o=>o.textDe).sort(),['stellen','stellst'].sort())
 assert.equal(verb.assessmentUnit,'stellt Präsens dritte Person Singular')
 assert.equal(verb.sourceSpans[0].quote,'Die Schule stellt Geräte zur Verfügung')
 assert.ok(verb.rationaleDe.includes('dritten Person Singular')&&verb.rationaleDe.includes('zweiten Person Singular'))
 for(const q of[syntax,verb]){const d=manifest.drafts.find(d=>d.definition.tasks.includes(q)),c=d.definition.competencies.find(c=>c.id===q.competencyId);assert.equal(c.languageUnits[5],q.assessmentUnit);assert.deepEqual(c.sourceSpans[5],q.sourceSpans[0]);assert.ok(c.mapping.pendingReasonDe.includes(q.assessmentUnit));assert.deepEqual(c.mapping.topicIds,[])}
}
test('epoch49 exact full-task/core/review/alias overlay preserves quality18 and all99 earlier proofs',()=>{
 assert.equal(sitovDelta49.questions.length,3);assert.equal(sitovDelta49.cores.length,2);assert.equal(sitovDelta49.changedAliases.length,9)
 for(const[value,content,bytes]of [[sitovQualityCurrent,sitovDelta49.previousManifestContentHash,sitovDelta49.previousManifestByteSha256],[sitovActualManifest49,sitovDelta49.currentManifestContentHash,sitovDelta49.currentManifestByteSha256],[sitovQualityCurrentAudio,sitovDelta49.previousAudioContentHash,sitovDelta49.previousAudioByteSha256],[sitovActualAudio49,sitovDelta49.currentAudioContentHash,sitovDelta49.currentAudioByteSha256]]){assert.equal(sitovHash(JSON.stringify(value)),content);assert.equal(sitovHash(JSON.stringify(value,null,2)+'\n'),bytes)}
 assert.deepEqual(sitovActualManifest49.drafts.slice(0,36),sitovQualityCurrent.drafts.slice(0,36));assert.equal(sitovHash(JSON.stringify(sitovActualManifest49.drafts.slice(0,36))),sitovDelta49.original36ContentHash)
 assert.deepEqual(Object.entries(sitovActualAudio49).slice(0,3456),Object.entries(sitovQualityCurrentAudio).slice(0,3456));assert.equal(sitovHash(JSON.stringify(Object.fromEntries(Object.entries(sitovActualAudio49).slice(0,3456)))),sitovDelta49.original3456AliasContentHash)
 assert.deepEqual(Object.keys(sitovActualAudio49),Object.keys(sitovQualityCurrentAudio));assert.deepEqual(Object.keys(sitovActualAudio49).filter(k=>sitovActualAudio49[k]!==sitovQualityCurrentAudio[k]),sitovDelta49.changedAliases.map(r=>r.key))
 for(const r of sitovDelta49.changedAliases){assert.equal(sitovQualityCurrentAudio[r.key],r.previousTextDe);assert.equal(sitovActualAudio49[r.key],r.currentTextDe)}
 const restored=structuredClone(sitovActualManifest49);for(const r of sitovDelta49.questions){const d=restored.drafts.find(d=>d.textId===r.textId);assert.deepEqual(d.definition.tasks.find(q=>q.id===r.questionId),r.currentTask);d.definition.tasks[d.definition.tasks.findIndex(q=>q.id===r.questionId)]=r.previousTask}
 for(const r of sitovDelta49.cores){const d=restored.drafts.find(d=>d.textId===r.textId);assert.deepEqual(d.definition.competencies.find(c=>c.id===r.coreId),r.currentCore);d.definition.competencies[d.definition.competencies.findIndex(c=>c.id===r.coreId)]=r.previousCore}
 for(const r of sitovDelta49.pools)restored.drafts.find(d=>d.textId===r.textId).review=r.previousReview
 assert.deepEqual(restored,sitovQualityCurrent)
})
test('actual39 repairs bind all72 current audited questions, honest pending reviews and standalone source/matrix evidence',()=>{
 assert.equal(sitovActualManifest49.drafts.length,39);assert.deepEqual(sitovActualManifest49.coverage,{total:60,authored:39,pending:21});assert.equal(Object.keys(sitovActualAudio49).length,3744)
 assert.deepEqual(sitovValidatePretestDrafts(sitovActualManifest49,sources),[]);assert.deepEqual(sitovValidatePretestAudioAliases(sitovActualManifest49,sitovActualAudio49),[])
 assert.equal(sitovDelta49.current72Audit.flatMap(p=>p.questions).length,72)
 for(const p of sitovDelta49.current72Audit){const d=sitovActualManifest49.drafts.find(d=>d.textId===p.textId),source=sources.rows.find(s=>s.id===d.textId),chars=Array.from(source.text);assert.equal(source.text,p.sourceBodyDe);assert.equal(d.textVersion,sitovHash(source.text));assert.equal(d.review.definitionContentHash,p.definitionContentHash);assert.equal(p.definitionContentHash,sitovHash(JSON.stringify(d.definition)));assert.equal(d.review.status,'author_checked_independent_review_pending');assert.equal(d.review.reviewer,'sitov.agent.S3');assert.equal(d.review.humanReview,false);assert.equal(d.review.calibrationStatus,'pending');assert.equal(d.active,false)
  for(const[q,r]of d.definition.tasks.map((q,i)=>[q,p.questions[i]])){assert.deepEqual(r,{questionId:q.id,publicPromptDe:q.promptDe,publicOptions:q.options,correctOptionId:q.correctOptionId,correctAnswerTextDe:q.options.find(o=>o.id===q.correctOptionId).textDe,rationaleDe:q.rationaleDe,assessmentUnit:q.assessmentUnit,sourceSpans:q.sourceSpans})}
  for(const s of[...d.definition.tasks.flatMap(q=>q.sourceSpans),...d.definition.competencies.flatMap(c=>c.sourceSpans)]){assert.equal(chars.slice(s.start,s.end).join(''),s.quote);assert.ok(!/[\p{L}\p{N}_]/u.test(chars[s.start-1]??''));assert.ok(!/[\p{L}\p{N}_]/u.test(chars[s.end]??''))}
  const old=sitovQualityCurrent.drafts.find(x=>x.textId===d.textId);assert.deepEqual(d.definition.reviewForms,old.definition.reviewForms);assert.deepEqual(d.definition.tasks.map(q=>[q.id,q.correctOptionId,q.options.map(o=>o.id)]),old.definition.tasks.map(q=>[q.id,q.correctOptionId,q.options.map(o=>o.id)]));for(const q of d.definition.tasks.filter(q=>!sitovDelta49.questions.some(r=>r.questionId===q.id)))assert.deepEqual(q,old.definition.tasks.find(x=>x.id===q.id))
 }
 assert.equal(sitovDelta49.questions.filter(r=>r.previousTask.options.find(o=>o.id===r.previousTask.correctOptionId).textDe!==r.currentTask.options.find(o=>o.id===r.currentTask.correctOptionId).textDe).length,2)
})
test('repaired public direction, source V2 fronting and finite school agreement measure the declared constructs',()=>{
 sitovAssert49Constructs(sitovActualManifest49);assert.throws(()=>sitovAssert49Constructs(sitovQualityCurrent))
 for(const r of sitovDelta49.questions){const copy=structuredClone(sitovActualManifest49),d=copy.drafts.find(d=>d.textId===r.textId);d.definition.tasks[d.definition.tasks.findIndex(q=>q.id===r.questionId)]=r.previousTask;assert.throws(()=>sitovAssert49Constructs(copy))}
})
test('epoch49 semantic guards reject hidden destination, wrong V2/finite keys, lexical relabeling, stale cores and spoken aliases',()=>{
 const mutations=[m=>{m.drafts[37].definition.tasks.find(q=>q.id.endsWith('nominal.q1')).promptDe='Die Wohnung gehört Freunden. Ich bin in ___ Wohnung gegangen.'},m=>{const q=m.drafts[36].definition.tasks.find(q=>q.id.endsWith('syntax.q6'));q.correctOptionId=q.options.find(o=>o.id!==q.correctOptionId).id},m=>{const q=m.drafts[38].definition.tasks.find(q=>q.id.endsWith('verbs.q6'));q.correctOptionId=q.options.find(o=>o.textDe==='stellen').id},m=>{m.drafts[36].definition.tasks.find(q=>q.id.endsWith('syntax.q6')).promptDe='Welche Angaben unterscheidet Datum und Uhrzeit?'},m=>{m.drafts[38].definition.tasks.find(q=>q.id.endsWith('verbs.q6')).promptDe='Was bedeutet zur Verfügung stellen?'}]
 for(const mutate of mutations){const copy=structuredClone(sitovActualManifest49);mutate(copy);assert.throws(()=>sitovAssert49Constructs(copy))}
 for(const r of sitovDelta49.cores){const copy=structuredClone(sitovActualManifest49),d=copy.drafts.find(d=>d.textId===r.textId);d.definition.competencies[d.definition.competencies.findIndex(c=>c.id===r.coreId)]=r.previousCore;assert.ok(sitovValidatePretestDrafts(copy,sources).length);assert.throws(()=>sitovAssert49Constructs(copy))}
 for(const r of sitovDelta49.changedAliases){const stale={...sitovActualAudio49,[r.key]:r.previousTextDe};assert.ok(sitovValidatePretestAudioAliases(sitovActualManifest49,stale).length)}
})

test('actual39 independent M repairs review binds exact definitions and all103 historical author checks',()=>{assert.equal(sitovLatestMReviewed39.drafts.length,39);assert.deepEqual(sitovValidatePretestDrafts(sitovLatestMReviewed39,sources),[]);for(const r of sitovMReview39.approvedEditorialDrafts){const d=sitovLatestMReviewed39.drafts.find(d=>d.textId===r.textId);assert.equal(d.active,false);assert.equal(d.review.documentSha256,sitovHash(sitovMReview39Raw));assert.equal(d.review.reviewer,'sitov.agent.M');assert.equal(d.review.humanReview,false);assert.equal(d.review.calibrationStatus,'pending');assert.equal(d.review.definitionContentHash,sitovHash(JSON.stringify(d.definition)));assert.equal(d.review.textVersion,r.textVersion);assert.deepEqual(d.definition.tasks.map(q=>({questionId:q.id,correctTextDe:q.options.find(o=>o.id===q.correctOptionId).textDe})),r.correctAnswerTexts)}})

test('epoch50 actual42/4032 validate directly with exact frozen M-reviewed39/3744 content and bytes',async()=>{
 assert.equal(sitovActualManifest50.drafts.length,42);assert.deepEqual(sitovActualManifest50.coverage,{total:60,authored:42,pending:18});assert.equal(Object.keys(sitovActualAudio50).length,4032)
 assert.deepEqual(sitovValidatePretestDrafts(sitovActualManifest50,sources),[]);assert.deepEqual(sitovValidatePretestAudioAliases(sitovActualManifest50,sitovActualAudio50),[])
 assert.equal(sitovHash(JSON.stringify(sitovLatestMReviewed39.drafts)),sitovEpoch50.original39ContentHash)
 for(const [value,content,bytes]of [[sitovLatestMReviewed39,sitovEpoch50.originalManifestContentHash,sitovEpoch50.originalManifestByteSha256],[sitovActualAudio49,sitovEpoch50.original3744AliasContentHash,sitovEpoch50.original3744AliasByteSha256],[sitovActualManifest50,sitovEpoch50.currentManifestContentHash,sitovEpoch50.currentManifestByteSha256],[sitovActualAudio50,sitovEpoch50.currentAliasContentHash,sitovEpoch50.currentAliasByteSha256]]){assert.equal(sitovHash(JSON.stringify(value)),content);assert.equal(sitovHash(JSON.stringify(value,null,2)+'\n'),bytes)}
 assert.equal(sitovHash(JSON.stringify(sitovActualManifest50,null,2)+'\n'),sitovEpoch50.currentManifestByteSha256)
 assert.equal(sitovHash(JSON.stringify(sitovActualAudio50,null,2)+'\n'),sitovEpoch50.currentAliasByteSha256)
})
test('next canonical A2.2A2.2sort10 and B1.1sort1–2 bind all72 audited fields, standalone spans, six-unit cores and independent balanced forms',async()=>{
 const added=sitovActualManifest50.drafts.slice(39),refs=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/epoch50-reference-audio-candidates.json','utf8'))
 assert.deepEqual(sitovDiversityErrors(added),[]);assert.equal(Object.keys(refs).length,3)
 for(const[i,d]of added.entries()){
  const source=sources.rows.find(s=>s.id===d.textId),audit=sitovEpoch50.pools[i],chars=Array.from(source.text)
  assert.equal(d.level,['A2.2','B1.1','B1.1'][i]);assert.equal(source.sortOrder,[10,1,2][i]);assert.deepEqual(d.definition.competencies,audit.cores);assert.equal(audit.sourceBodyDe,source.text);assert.equal(refs['sitov-pretest-reference:'+d.textId],source.text);assert.equal(d.textVersion,sitovHash(source.text));assert.equal(d.active,false)
  assert.equal(d.review.status,'author_checked_independent_review_pending');assert.equal(d.review.reviewer,d.review.authorIdentity);assert.equal(d.review.humanReview,false);assert.equal(d.review.calibrationStatus,'pending');assert.equal(d.review.definitionContentHash,sitovHash(JSON.stringify(d.definition)));assert.equal(d.review.definitionContentHash,audit.definitionContentHash)
  assert.equal(d.definition.tasks.length,24);assert.equal(d.definition.competencies.length,4);assert.equal(new Set(d.definition.tasks.map(q=>q.assessmentUnit)).size,24)
  const[a,b]=d.definition.reviewForms;assert.equal(a.questionIds.length,12);assert.equal(b.questionIds.length,12);assert.ok(!a.questionIds.some(id=>b.questionIds.includes(id)))
  for(const core of d.definition.competencies){const qs=d.definition.tasks.filter(q=>q.competencyId===core.id);assert.equal(qs.length,6);assert.equal(core.languageUnits.length,6);for(const f of[a,b])assert.equal(f.questionIds.filter(id=>qs.some(q=>q.id===id)).length,3)}
  for(const[j,q]of d.definition.tasks.entries()){
   const r=audit.questions[j];assert.equal(r.questionId,q.id);assert.equal(r.publicPromptDe,q.promptDe);assert.deepEqual(r.publicOptions,q.options);assert.equal(r.correctOptionId,q.correctOptionId);assert.equal(r.correctAnswerTextDe,q.options.find(o=>o.id===q.correctOptionId).textDe);assert.equal(r.rationaleDe,q.rationaleDe);assert.equal(r.assessmentUnit,q.assessmentUnit);assert.deepEqual(r.sourceSpans,q.sourceSpans)
   assert.ok(!/\b(Frau|Freundin|Lehrerin|Schülerin|Nachbarin|Mutter|Schwester)\b/u.test(q.promptDe+' '+q.options.map(o=>o.textDe).join(' ')))
  }
  for(const span of [...d.definition.tasks.flatMap(q=>q.sourceSpans),...d.definition.competencies.flatMap(c=>c.sourceSpans)]){assert.equal(chars.slice(span.start,span.end).join(''),span.quote);assert.ok(!/[\p{L}\p{N}_]/u.test(chars[span.start-1]??''));assert.ok(!/[\p{L}\p{N}_]/u.test(chars[span.end]??''))}
 }
})




const sitovAssert50Keys=ds=>{
 const expected=[[0,'verbs.q1','eingeladen'],[0,'verbs.q2','vergisst'],[0,'verbs.q3','erklärte'],[0,'verbs.q4','überlegt'],[0,'verbs.q5','helfen'],[0,'verbs.q6','schreibt'],[0,'syntax.q2','mein Sohn im Unterricht gut mitarbeitet'],[0,'syntax.q3','wir ihm helfen können'],[0,'syntax.q4','in das er seine Aufgaben schreibt'],[0,'syntax.q5','schauen wir jeden Nachmittag kurz hinein'],[0,'nominal.q1','meines'],[0,'nominal.q2','einem'],[0,'nominal.q5','jeden'],[0,'nominal.q6','hilfreicher'],[1,'verbs.q1','Plusquamperfekt.'],[1,'verbs.q2','ausprobieren'],[1,'verbs.q3','interessierte'],[1,'verbs.q4','empfahl'],[1,'verbs.q5','nachfragen'],[1,'verbs.q6','vorbereiten'],[1,'syntax.q3','mein Deutsch für den Unterricht ausreichen'],[1,'syntax.q4','ich vieles verstehen konnte'],[1,'syntax.q5','bereite ich meine Bewerbung vor'],[1,'syntax.q6','neue Möglichkeiten zu entdecken'],[1,'nominal.q1','älteren'],[1,'nominal.q2','eine'],[1,'nominal.q3','mir'],[1,'nominal.q4','mein'],[1,'nominal.q6','neue'],[2,'verbs.q1','gekauft'],[2,'verbs.q2','musste'],[2,'verbs.q3','losgehen'],[2,'verbs.q4','schreibe'],[2,'verbs.q5','erscheinen'],[2,'verbs.q6','verlangt'],[2,'syntax.q2','plane ich meine Einkäufe genauer'],[2,'syntax.q4','große Packungen manchmal günstiger erscheinen'],[2,'syntax.q5','sie kein besonderes Wissen verlangt'],[2,'syntax.q6','Die Müllmenge sinkt, obwohl spontane Einkäufe weiterhin vorkommen.'],[2,'nominal.q1','der'],[2,'nominal.q2','meine'],[2,'nominal.q3','den'],[2,'nominal.q4','kleinere'],[2,'nominal.q5','günstiger'],[2,'nominal.q6','besonderes']]
 for(const[i,id,key]of expected){const q=ds[i].definition.tasks.find(q=>q.id.endsWith(id));assert.equal(q.options.find(o=>o.id===q.correctOptionId).textDe,key,q.id)}
 for(const[i,id,part]of [[0,'verbs.q1','Der Lehrer hat mich zu einem Gespräch ___'],[0,'nominal.q3','Hausaufgaben gehören meinem Sohn'],[0,'syntax.q4','Ein Sohn bekommt ein Heft und schreibt seine Aufgaben hinein'],[1,'verbs.q3','Präteritumform'],[1,'syntax.q1','Nachdem ich im Verkauf gearbeitet hatte'],[1,'syntax.q2','Die Beratung war hilfreich, trotzdem hatte ich Zweifel'],[1,'nominal.q4','Die Frage betrifft meine Deutschkenntnisse'],[1,'nominal.q5','wenn es meine eigene ist'],[2,'nominal.q3','Ich richte meinen Blick in den Innenraum des Kühlschranks'],[2,'syntax.q6','Spontane Einkäufe kommen noch vor. Trotzdem landet weniger im Müll']])assert.ok(ds[i].definition.tasks.find(q=>q.id.endsWith(id)).promptDe.includes(part))
 assert.ok(!ds[0].definition.tasks.find(q=>q.id.endsWith('verbs.q1')).promptDe.includes('eingeladen'))
 for(const d of ds)for(const q of d.definition.tasks)for(const o of q.options)if(o.id!==q.correctOptionId)assert.ok(!/ausdrücklich|ausschließlich|Kuchen|Fahrrad|Koffer|Zugfarbe|Körpergröße/u.test(o.textDe),q.id)
}
test('new teacher/career/shopping questions bind actual forms, relative/indirect clauses, temporal/contrast relations and public premises',()=>{
 const ds=sitovActualManifest50.drafts.slice(39);sitovAssert50Keys(ds)
 assert.ok(!ds[0].definition.omittedCategories.some(c=>c.category==='relative_clauses'))
 for(const d of ds.slice(1))assert.ok(d.definition.omittedCategories.some(c=>c.category==='relative_clauses'))
 for(const d of ds){assert.ok(!d.definition.omittedCategories.some(c=>['comparatives','past_tenses'].includes(c.category)));for(const c of d.definition.competencies){assert.deepEqual(c.mapping.topicIds,[]);for(const u of c.languageUnits)assert.ok(c.mapping.pendingReasonDe.includes(u))}}
 assert.equal(ds[1].definition.tasks.find(q=>q.id.endsWith('verbs.q1')).sourceSpans[0].quote,'gearbeitet hatte')
 assert.equal(ds[0].definition.tasks.find(q=>q.id.endsWith('syntax.q4')).sourceSpans[0].quote,'in das er seine Aufgaben schreibt')
})
test('actual42 negative guards reject wrong source/form/mapping/audio and hidden premises or lexical substitution of declared forms',()=>{
 for(const mutate of [m=>m.drafts[39].definition.tasks[0].sourceSpans[0].start++,m=>m.drafts[40].definition.tasks[0].rationaleDe='',m=>m.drafts[41].definition.competencies[0].mapping.topicIds=['sitov.topic.vorschlaege-a22'],m=>{const f=m.drafts[39].definition.reviewForms;f[1].questionIds[0]=f[0].questionIds[0]},m=>{m.drafts[40].definition.tasks[1].assessmentUnit=m.drafts[40].definition.tasks[0].assessmentUnit}]){const copy=structuredClone(sitovActualManifest50);mutate(copy);assert.ok(sitovValidatePretestDrafts(copy,sources).length)}
 const audio={...sitovActualAudio50};delete audio[Object.keys(audio).at(-1)];assert.ok(sitovValidatePretestAudioAliases(sitovActualManifest50,audio).length)
 for(const[i,id]of [[0,'verbs.q1'],[0,'syntax.q4'],[1,'verbs.q1'],[1,'verbs.q4'],[1,'syntax.q3'],[2,'verbs.q2'],[2,'syntax.q6'],[2,'nominal.q3']]){const ds=structuredClone(sitovActualManifest50.drafts.slice(39)),q=ds[i].definition.tasks.find(q=>q.id.endsWith(id));q.correctOptionId=q.options.find(o=>o.id!==q.correctOptionId).id;assert.throws(()=>sitovAssert50Keys(ds))}
 for(const[i,id]of [[0,'nominal.q3'],[1,'nominal.q4'],[2,'nominal.q3']]){const ds=structuredClone(sitovActualManifest50.drafts.slice(39));ds[i].definition.tasks.find(q=>q.id.endsWith(id)).promptDe='Welche Form passt?';assert.throws(()=>sitovAssert50Keys(ds))}
 const renamed=structuredClone(sitovActualManifest50.drafts.slice(39));renamed[1].definition.tasks.find(q=>q.id.endsWith('verbs.q4')).options.find(o=>o.id===renamed[1].definition.tasks.find(q=>q.id.endsWith('verbs.q4')).correctOptionId).textDe='Einen Vorschlag machen.';assert.throws(()=>sitovAssert50Keys(renamed))
})

test('quality21 applied42 preserves complete previous manifests before every historical proof and binds actual candidate tasks',()=>{assert.equal(sitovQuality21CurrentManifest.drafts.length,42);assert.equal(sitovHash(JSON.stringify(sitovQuality21PreviousManifest,null,2)+'\n'),sitovQuality21Application.previousManifestByteSha256);assert.equal(sitovHash(JSON.stringify(sitovQuality21PreviousAudio,null,2)+'\n'),sitovQuality21Application.previousAudioByteSha256);assert.equal(sitovHash(sitovQuality21PatchRaw),sitovQuality21Review.sourcePatchSha256);assert.deepEqual(sitovValidatePretestDrafts(sitovQuality21CurrentManifest,sources),[]);assert.deepEqual(sitovValidatePretestAudioAliases(sitovQuality21CurrentManifest,sitovQuality21CurrentAudio),[]);for(const r of sitovQuality21Patch.pools){const d=sitovQuality21CurrentManifest.drafts.find(d=>d.textId===r.textId);assert.deepEqual(d.definition,r.candidateDefinition);assert.equal(d.review.documentSha256,sitovHash(sitovQuality21ReviewRaw));assert.equal(d.review.definitionContentHash,sitovHash(JSON.stringify(d.definition)));assert.equal(d.active,false);assert.equal(d.review.humanReview,false);assert.equal(d.review.calibrationStatus,'pending')}for(const r of sitovQuality21Patch.patches){const d=sitovQuality21CurrentManifest.drafts.find(d=>d.textId===r.textId);assert.deepEqual(d.definition.tasks.find(q=>q.id===r.questionId),r.currentTask);for(const e of r.currentAudioAliasEntries)assert.equal(sitovQuality21CurrentAudio[e.alias],e.text)}})
test('quality21 keys identities unrelated fields and51unchangedtasks remain exact while stale spokenalias is rejected',()=>{const ids=new Set(sitovQuality21Patch.patches.map(r=>r.questionId));for(const r of sitovQuality21Patch.patches){const a=r.previousTask,b=r.currentTask;for(const k of Object.keys(a).filter(k=>!['promptDe','options','rationaleDe'].includes(k)))assert.deepEqual(a[k],b[k]);assert.equal(a.correctOptionId,b.correctOptionId);assert.deepEqual(a.options.map(o=>o.id),b.options.map(o=>o.id))}for(const d of sitovQuality21CurrentManifest.drafts){const old=sitovQuality21PreviousManifest.drafts.find(o=>o.textId===d.textId);for(const q of d.definition.tasks)if(!ids.has(q.id))assert.deepEqual(q,old.definition.tasks.find(o=>o.id===q.id))}const bad={...sitovQuality21CurrentAudio},r=sitovQuality21Patch.patches[0],e=r.previousAudioAliasEntries.find(e=>r.currentAudioAliasEntries.some(n=>n.alias===e.alias&&n.text!==e.text));assert.ok(e);bad[e.alias]=e.text;assert.ok(sitovValidatePretestAudioAliases(sitovQuality21CurrentManifest,bad).length)})

test('actual42 M review binds all72 source-supported tasks and preserves quality21/current39 before all110 immutable proofs',()=>{assert.equal(sitovLatestMReviewed42.drafts.length,42);assert.deepEqual(sitovValidatePretestDrafts(sitovLatestMReviewed42,sources),[]);assert.deepEqual(sitovValidatePretestAudioAliases(sitovLatestMReviewed42,sitovQuality21CurrentAudio),[]);assert.deepEqual(sitovLatestMReviewed42.drafts.slice(0,39),sitovBeforeMReviewed42.drafts.slice(0,39));for(const r of sitovMReview42.approvedEditorialDrafts){const d=sitovLatestMReviewed42.drafts.find(d=>d.textId===r.textId);assert.equal(d.review.documentSha256,sitovHash(sitovMReview42Raw));assert.equal(d.review.definitionContentHash,sitovHash(JSON.stringify(d.definition)));assert.equal(d.review.reviewer,'sitov.agent.M');assert.equal(d.review.humanReview,false);assert.equal(d.review.calibrationStatus,'pending');assert.equal(d.active,false);assert.deepEqual(d.definition.tasks.map(q=>({questionId:q.id,correctTextDe:q.options.find(o=>o.id===q.correctOptionId).textDe})),r.correctAnswerTexts)}})

test('epoch51 actual45/4320 validate directly with exact frozen M-reviewed42/4032 content and bytes',async()=>{
 assert.equal(sitovActualManifest51.drafts.length,45);assert.deepEqual(sitovActualManifest51.coverage,{total:60,authored:45,pending:15});assert.equal(Object.keys(sitovActualAudio51).length,4320)
 assert.deepEqual(sitovValidatePretestDrafts(sitovActualManifest51,sources),[]);assert.deepEqual(sitovValidatePretestAudioAliases(sitovActualManifest51,sitovActualAudio51),[])
 assert.equal(sitovHash(JSON.stringify(sitovLatestMReviewed42.drafts)),sitovEpoch51.original42ContentHash)
 for(const [value,content,bytes]of [[sitovLatestMReviewed42,sitovEpoch51.originalManifestContentHash,sitovEpoch51.originalManifestByteSha256],[sitovFrozenAudio42,sitovEpoch51.original4032AliasContentHash,sitovEpoch51.original4032AliasByteSha256],[sitovActualManifest51,sitovEpoch51.currentManifestContentHash,sitovEpoch51.currentManifestByteSha256],[sitovActualAudio51,sitovEpoch51.currentAliasContentHash,sitovEpoch51.currentAliasByteSha256]]){assert.equal(sitovHash(JSON.stringify(value)),content);assert.equal(sitovHash(JSON.stringify(value,null,2)+'\n'),bytes)}
 assert.equal(sitovHash(JSON.stringify(sitovActualManifest51,null,2)+'\n'),sitovEpoch51.currentManifestByteSha256)
 assert.equal(sitovHash(JSON.stringify(sitovActualAudio51,null,2)+'\n'),sitovEpoch51.currentAliasByteSha256)
})
test('next canonical B1.1sort3–5 bind all72 audited fields, standalone spans, six-unit cores and independent balanced forms',async()=>{
 const added=sitovActualManifest51.drafts.slice(42),refs=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/epoch51-reference-audio-candidates.json','utf8'))
 assert.deepEqual(sitovDiversityErrors(added),[]);assert.equal(Object.keys(refs).length,3)
 for(const[i,d]of added.entries()){
  const source=sources.rows.find(s=>s.id===d.textId),audit=sitovEpoch51.pools[i],chars=Array.from(source.text)
  assert.equal(d.level,'B1.1');assert.equal(source.sortOrder,i+3);assert.deepEqual(d.definition.competencies,audit.cores);assert.equal(audit.sourceBodyDe,source.text);assert.equal(refs['sitov-pretest-reference:'+d.textId],source.text);assert.equal(d.textVersion,sitovHash(source.text));assert.equal(d.active,false)
  assert.equal(d.review.status,'author_checked_independent_review_pending');assert.equal(d.review.reviewer,d.review.authorIdentity);assert.equal(d.review.humanReview,false);assert.equal(d.review.calibrationStatus,'pending');assert.equal(d.review.definitionContentHash,sitovHash(JSON.stringify(d.definition)));assert.equal(d.review.definitionContentHash,audit.definitionContentHash)
  assert.equal(d.definition.tasks.length,24);assert.equal(d.definition.competencies.length,4);assert.equal(new Set(d.definition.tasks.map(q=>q.assessmentUnit)).size,24)
  const[a,b]=d.definition.reviewForms;assert.equal(a.questionIds.length,12);assert.equal(b.questionIds.length,12);assert.ok(!a.questionIds.some(id=>b.questionIds.includes(id)))
  for(const core of d.definition.competencies){const qs=d.definition.tasks.filter(q=>q.competencyId===core.id);assert.equal(qs.length,6);assert.equal(core.languageUnits.length,6);for(const f of[a,b])assert.equal(f.questionIds.filter(id=>qs.some(q=>q.id===id)).length,3)}
  for(const[j,q]of d.definition.tasks.entries()){
   const r=audit.questions[j];assert.equal(r.questionId,q.id);assert.equal(r.publicPromptDe,q.promptDe);assert.deepEqual(r.publicOptions,q.options);assert.equal(r.correctOptionId,q.correctOptionId);assert.equal(r.correctAnswerTextDe,q.options.find(o=>o.id===q.correctOptionId).textDe);assert.equal(r.rationaleDe,q.rationaleDe);assert.equal(r.assessmentUnit,q.assessmentUnit);assert.deepEqual(r.sourceSpans,q.sourceSpans)
   assert.ok(!/\b(Frau|Freundin|Lehrerin|Schülerin|Nachbarin|Mutter|Schwester)\b/u.test(q.promptDe+' '+q.options.map(o=>o.textDe).join(' ')))
  }
  for(const span of [...d.definition.tasks.flatMap(q=>q.sourceSpans),...d.definition.competencies.flatMap(c=>c.sourceSpans)]){assert.equal(chars.slice(span.start,span.end).join(''),span.quote);assert.ok(!/[\p{L}\p{N}_]/u.test(chars[span.start-1]??''));assert.ok(!/[\p{L}\p{N}_]/u.test(chars[span.end]??''))}
 }
})




const sitovAssert51Keys=ds=>{
 const cases=[[0,'verbs.q1','Perfekt mit sein.'],[0,'verbs.q2','mich'],[0,'verbs.q3','vorschlagen'],[0,'verbs.q4','entschied'],[0,'verbs.q5','anzusprechen'],[0,'verbs.q6','geworden'],[0,'syntax.q1','ich nach Hannover gezogen bin'],[0,'syntax.q2','einen Kurs zu besuchen'],[0,'syntax.q3','der nichts mit meinem Beruf zu tun hatte'],[0,'syntax.q4','Kontakte Zeit brauchen'],[0,'syntax.q5','aus einem ersten Gespräch mehr entsteht'],[0,'syntax.q6','sind inzwischen Freundschaften geworden'],[0,'nominal.q1','meinem'],[0,'nominal.q2','einen'],[0,'nominal.q3','gemeinsamen'],[0,'nominal.q4','ersten'],[0,'nominal.q5','die Freundschaften'],[0,'nominal.q6','mehr'],[1,'verbs.q1','gab'],[1,'verbs.q2','putzten'],[1,'verbs.q3','uns'],[1,'verbs.q4','übernehmen'],[1,'verbs.q5','geholfen'],[1,'verbs.q6','zuzuhören'],[1,'syntax.q2','welche Aufgaben er übernehmen konnte'],[1,'syntax.q3','der jede Woche wechselt'],[1,'syntax.q6','vereinbarten wir, rechtzeitig Bescheid zu geben'],[1,'nominal.q1','unserer'],[1,'nominal.q2','die'],[1,'nominal.q3','einfachen'],[1,'nominal.q4','jede'],[1,'nominal.q5','uns'],[1,'nominal.q6','besser'],[2,'verbs.q1','bekam'],[2,'verbs.q2','weiterleiten'],[2,'verbs.q3','sich'],[2,'verbs.q4','gezeigt'],[2,'verbs.q5','entstehen'],[2,'verbs.q6','helfen'],[2,'syntax.q2','es sich um eine alte Information handelte'],[2,'syntax.q3','wie schnell Missverständnisse entstehen können'],[2,'syntax.q4','schrieb ich eine kurze Erklärung'],[2,'syntax.q5','ich die Nachricht weiterleitete'],[2,'syntax.q6','das Datum, die Quelle und eine direkte Nachfrage'],[2,'nominal.q1','einer'],[2,'nominal.q2','eine'],[2,'nominal.q3','kurze'],[2,'nominal.q4','wichtige'],[2,'nominal.q5','zuständigen'],[2,'nominal.q6','lieber']]
 for(const[i,id,key]of cases){const q=ds[i].definition.tasks.find(q=>q.id.endsWith(id));assert.equal(q.options.find(o=>o.id===q.correctOptionId).textDe,key,q.id)}
 for(const[i,id,p]of [[0,'words.q5','Gespräche kommen beim Spaziergang fast von selbst zustande'],[0,'syntax.q3','Ein Kurs hatte nichts mit meinem Beruf zu tun'],[0,'nominal.q1','wenn es mein Bruder ist'],[1,'nominal.q1','Der Streit findet innerhalb unserer Wohngemeinschaft statt'],[1,'syntax.q4','Wir geben Bescheid, wenn jemand keine Zeit hat'],[1,'syntax.q5','Nicht alles ist perfekt, aber die Stimmung ist besser'],[2,'verbs.q6','Datum, Quelle und Nachfrage bilden zusammen das Subjekt'],[2,'syntax.q1','Bevor ich die Nachricht weiterleitete'],[2,'nominal.q1','Die Nachricht erscheint innerhalb einer Chatgruppe']])assert.ok(ds[i].definition.tasks.find(q=>q.id.endsWith(id)).promptDe.includes(p))
 for(const d of ds)for(const q of d.definition.tasks)for(const o of q.options)if(o.id!==q.correctOptionId)assert.ok(!/ausdrücklich|ausschließlich|Kuchen|Fahrrad|Koffer|Zugfarbe|Körpergröße/u.test(o.textDe),q.id)
}
test('new friendship/shared-house/news questions test actual forms, relative clauses, temporal relations and public case premises',()=>{
 const ds=sitovActualManifest51.drafts.slice(42);sitovAssert51Keys(ds)
 for(const d of ds.slice(0,2))assert.ok(!d.definition.omittedCategories.some(c=>c.category==='relative_clauses'))
 assert.ok(ds[2].definition.omittedCategories.some(c=>c.category==='relative_clauses'))
 for(const d of ds){assert.ok(!d.definition.omittedCategories.some(c=>['comparatives','past_tenses'].includes(c.category)));for(const c of d.definition.competencies){assert.deepEqual(c.mapping.topicIds,[]);for(const u of c.languageUnits)assert.ok(c.mapping.pendingReasonDe.includes(u))}}
 for(const[i,id,quote]of [[0,'syntax.q3','der nichts mit meinem Beruf zu tun hatte'],[1,'syntax.q3','der jede Woche wechselt'],[2,'syntax.q2','dass es sich um eine alte Information handelte']])assert.equal(ds[i].definition.tasks.find(q=>q.id.endsWith(id)).sourceSpans[0].quote,quote)
 const relations=[[1,'syntax.q1','Das gemeinsame Gespräch ersetzt das bloße Schreiben von Nachrichten.'],[1,'syntax.q4','Fehlende Zeit ist die Bedingung für das Bescheidgeben.'],[2,'syntax.q1','Zuerst prüfte ich die Webseite, danach leitete ich die Nachricht weiter.']]
 for(const[i,id,key]of relations){const q=ds[i].definition.tasks.find(q=>q.id.endsWith(id));assert.equal(q.options.find(o=>o.id===q.correctOptionId).textDe,key)}
})
test('actual45 negative guards reject false source/units/forms/topics/audio, hidden case context and wrong genuine grammar keys',()=>{
 for(const mutate of [m=>m.drafts[42].definition.tasks[0].sourceSpans[0].start++,m=>m.drafts[43].definition.tasks[0].rationaleDe='',m=>m.drafts[44].definition.competencies[0].mapping.topicIds=['sitov.topic.vorschlaege-a22'],m=>{m.drafts[42].definition.tasks[1].assessmentUnit=m.drafts[42].definition.tasks[0].assessmentUnit},m=>{const f=m.drafts[43].definition.reviewForms;f[1].questionIds[0]=f[0].questionIds[0]}]){const copy=structuredClone(sitovActualManifest51);mutate(copy);assert.ok(sitovValidatePretestDrafts(copy,sources).length)}
 const audio={...sitovActualAudio51};delete audio[Object.keys(audio).at(-1)];assert.ok(sitovValidatePretestAudioAliases(sitovActualManifest51,audio).length)
 for(const[i,id]of [[0,'verbs.q1'],[0,'verbs.q5'],[0,'syntax.q3'],[1,'verbs.q5'],[1,'verbs.q6'],[1,'syntax.q2'],[2,'verbs.q6'],[2,'syntax.q6']]){const ds=structuredClone(sitovActualManifest51.drafts.slice(42)),q=ds[i].definition.tasks.find(q=>q.id.endsWith(id));q.correctOptionId=q.options.find(o=>o.id!==q.correctOptionId).id;assert.throws(()=>sitovAssert51Keys(ds))}
 for(const[i,id]of [[0,'nominal.q1'],[1,'nominal.q1'],[2,'nominal.q1'],[2,'verbs.q6']]){const ds=structuredClone(sitovActualManifest51.drafts.slice(42));ds[i].definition.tasks.find(q=>q.id.endsWith(id)).promptDe='Welche Form passt?';assert.throws(()=>sitovAssert51Keys(ds))}
 const lexical=structuredClone(sitovActualManifest51.drafts.slice(42)),q=lexical[0].definition.tasks.find(q=>q.id.endsWith('verbs.q5'));q.options.find(o=>o.id===q.correctOptionId).textDe='Ein Gespräch beginnen.';assert.throws(()=>sitovAssert51Keys(lexical))
})

test('actual45 M review binds all72 B1.1 tasks and preserves full42 before all115 immutable proofs',()=>{assert.equal(sitovLatestMReviewed45.drafts.length,45);assert.deepEqual(sitovValidatePretestDrafts(sitovLatestMReviewed45,sources),[]);assert.deepEqual(sitovValidatePretestAudioAliases(sitovLatestMReviewed45,sitovActualAudio51),[]);assert.deepEqual(sitovLatestMReviewed45.drafts.slice(0,42),sitovBeforeMReviewed45.drafts.slice(0,42));for(const r of sitovMReview45.approvedEditorialDrafts){const d=sitovLatestMReviewed45.drafts.find(d=>d.textId===r.textId);assert.equal(d.review.documentSha256,sitovHash(sitovMReview45Raw));assert.equal(d.review.definitionContentHash,sitovHash(JSON.stringify(d.definition)));assert.equal(d.review.reviewer,'sitov.agent.M');assert.equal(d.review.humanReview,false);assert.equal(d.review.calibrationStatus,'pending');assert.equal(d.active,false);assert.deepEqual(d.definition.tasks.map(q=>({questionId:q.id,correctTextDe:q.options.find(o=>o.id===q.correctOptionId).textDe})),r.correctAnswerTexts)}})

test('quality32 applied45 preserves complete previous manifests before every historical proof and binds actual candidate tasks',()=>{assert.equal(sitovQuality32CurrentManifest.drafts.length,45);assert.equal(sitovHash(JSON.stringify(sitovQuality32PreviousManifest,null,2)+'\n'),sitovQuality32Application.previousManifestByteSha256);assert.equal(sitovHash(JSON.stringify(sitovQuality32PreviousAudio,null,2)+'\n'),sitovQuality32Application.previousAudioByteSha256);assert.equal(sitovHash(sitovQuality32PatchRaw),sitovQuality32Review.sourcePatchSha256);assert.deepEqual(sitovValidatePretestDrafts(sitovQuality32CurrentManifest,sources),[]);assert.deepEqual(sitovValidatePretestAudioAliases(sitovQuality32CurrentManifest,sitovQuality32CurrentAudio),[]);for(const r of sitovQuality32Patch.pools){const d=sitovQuality32CurrentManifest.drafts.find(d=>d.textId===r.textId);assert.deepEqual(d.definition,r.candidateDefinition);assert.equal(d.review.documentSha256,sitovHash(sitovQuality32ReviewRaw));assert.equal(d.review.definitionContentHash,sitovHash(JSON.stringify(d.definition)));assert.equal(d.active,false);assert.equal(d.review.humanReview,false);assert.equal(d.review.calibrationStatus,'pending')}for(const r of sitovQuality32Patch.patches){const d=sitovQuality32CurrentManifest.drafts.find(d=>d.textId===r.textId);assert.deepEqual(d.definition.tasks.find(q=>q.id===r.questionId),r.currentTask);for(const e of r.currentAudioAliasEntries)assert.equal(sitovQuality32CurrentAudio[e.alias],e.text)}})
test('quality32 keys identities unrelated fields and64unchangedtasks remain exact while stale spokenalias is rejected',()=>{const ids=new Set(sitovQuality32Patch.patches.map(r=>r.questionId));for(const r of sitovQuality32Patch.patches){const a=r.previousTask,b=r.currentTask;for(const k of Object.keys(a).filter(k=>!['promptDe','options','rationaleDe'].includes(k)))assert.deepEqual(a[k],b[k]);assert.equal(a.correctOptionId,b.correctOptionId);assert.deepEqual(a.options.map(o=>o.id),b.options.map(o=>o.id))}for(const d of sitovQuality32CurrentManifest.drafts){const old=sitovQuality32PreviousManifest.drafts.find(o=>o.textId===d.textId);for(const q of d.definition.tasks)if(!ids.has(q.id))assert.deepEqual(q,old.definition.tasks.find(o=>o.id===q.id))}const bad={...sitovQuality32CurrentAudio},r=sitovQuality32Patch.patches[0],e=r.previousAudioAliasEntries.find(e=>r.currentAudioAliasEntries.some(n=>n.alias===e.alias&&n.text!==e.text));assert.ok(e);bad[e.alias]=e.text;assert.ok(sitovValidatePretestAudioAliases(sitovQuality32CurrentManifest,bad).length)})
