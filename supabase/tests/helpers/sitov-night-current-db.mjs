import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

export const sitovCurrentSchema = new URL('../fixtures/sitov-night-current92-schema.sql', import.meta.url)
export const sitovPinnedLookups = new URL('../fixtures/sitov-night-current92-lookups.sql', import.meta.url)
export const sitovPrerequisites = new URL('../fixtures/sitov-night-current-prerequisites.sql', import.meta.url)
export const sitovBaseline = new URL('../fixtures/sitov-night-current-baseline.sql', import.meta.url)
export const sitovReviewedThrough = 92
export const sitovBaseline92 = Object.freeze({
 target: 'baseline92', through: 92, sourceSha: 'e22c73883356e61700ed57f3cfeb601f9bf55b32',
 sourcePath: 'supabase/schema.sql', fixturePath: 'supabase/tests/fixtures/sitov-night-current92-schema.sql',
 schemaSha256: 'c6b90f3bb5527ae6d36d0336c84afd7c5549a5e16d9f79af245d21c0fb8b5cfe',
 lookupSha256: '9e19b140bc5ae9b0585cadb3e97a0691a4c04717dce62959682c689e985e1803',
})
const sitovPinnedMigrations = [
 {
  "name": "02_identity_alignment.sql",
  "sha256": "53d19a9cf3cbb0fc92f9f5d618c498797610d70b609c7610f9ab86b247be221d",
  "transaction": "separate"
 },
 {
  "name": "03_registration_identity.sql",
  "sha256": "c9a83441deeedadffc51600ae31ed728860c7f37e9251abce1144e726f6fd8b4",
  "transaction": "separate"
 },
 {
  "name": "01_critical_fixes.sql",
  "sha256": "fd6cd1970c04919aa49e90cdc69ee83e0ddb193a1e6525e1f0e7b44dbca6c010",
  "transaction": "separate"
 },
 {
  "name": "04_normalization.sql",
  "sha256": "9edda8ac2249324df6339b9406f2c0c10d060c69c3eb73cc27129ea325591b38",
  "transaction": "separate"
 },
 {
  "name": "05_rpc_errors.sql",
  "sha256": "583aca49fc0f04c988380e847a4976888a2043b87802ebd814f0f0becedd5cbb",
  "transaction": "separate"
 },
 {
  "name": "06_soft_errors.sql",
  "sha256": "19d00e05bd0e7ac2e2ad89e7a4b1868be8197b863bcb8212652e0243cb0936d2",
  "transaction": "separate"
 },
 {
  "name": "07_content_quality.sql",
  "sha256": "a5c4602a8fc5cc2cc72d233a93dda0f4b6c56b72bc83d0296306582a3e9e5813",
  "transaction": "separate"
 },
 {
  "name": "08_performance_indexes.sql",
  "sha256": "f75908e814d0cfba66745b8d9422a29d5301868d03dab54df11d2c09fdee33bd",
  "transaction": "autocommit"
 },
 {
  "name": "09_progress_aggregate.sql",
  "sha256": "3a750927a117dcf7a4ba57c201062bd6db3b061bdf6dd80cd67e927419febb02",
  "transaction": "separate"
 },
 {
  "name": "10_rls_performance.sql",
  "sha256": "f721343fb87fe9bcd9a19080a996d795a2ba26103ec6905240c7ab4dfb38c56d",
  "transaction": "separate"
 },
 {
  "name": "11_teacher_analytics.sql",
  "sha256": "3b279ea46b154fd250819142fc7d6454b1a163c69d7f906bf1226d9b4b2332c5",
  "transaction": "separate"
 },
 {
  "name": "12_media_upload.sql",
  "sha256": "e510be2075e67201a5e5a8e0dbefce5d38bf780502737c71a616af68ef7f2418",
  "transaction": "separate"
 },
 {
  "name": "13_mail_exception_kind.sql",
  "sha256": "d81f08f4cf1287330d07ba8e5a841952738be92fe678ec56a2e03f7d85a887eb",
  "transaction": "separate"
 },
 {
  "name": "14_mail_exceptions.sql",
  "sha256": "2c25706dfc7d056c96295a2513d3da592e9aec5bf47fb06af2f9be311242eed5",
  "transaction": "separate"
 },
 {
  "name": "15_grading_helper_permissions.sql",
  "sha256": "1e090054fbfbba7581ebc7d9dac99dfbc0672ef783e113b526308e7692a048eb",
  "transaction": "separate"
 },
 {
  "name": "16_uploaded_video_visibility.sql",
  "sha256": "1c77f8d09bb7d5031ed630ccf9b07f337e3a4f923ce082dc1e839b9890fd6110",
  "transaction": "separate"
 },
 {
  "name": "17_remove_video_placeholders.sql",
  "sha256": "0cadc644a651a7f5d593aa98acc243af62d9b52a4532989aee6778ea04e8f1d2",
  "transaction": "separate"
 },
 {
  "name": "18_vocabulary_self_rating.sql",
  "sha256": "d0f4d4b7fff938e8a0aa441ac32663e04b084c95e0a31dfca82cbdbada424b80",
  "transaction": "separate"
 },
 {
  "name": "19_vocabulary_self_rating_fix.sql",
  "sha256": "03557f9ce8e55f36416fec976dabae72c9c4b993c81becdbee6bde2bef3482a0",
  "transaction": "separate"
 },
 {
  "name": "20_vocabulary_learner_mode.sql",
  "sha256": "3c7cca50111d506266c833d8734e1b17310e3a9a3fc8b323120ea19575eaa6b1",
  "transaction": "separate"
 },
 {
  "name": "21_vocabulary_sentence_learner_choice.sql",
  "sha256": "de049c798fa0e441a0bfa05684541c393bfe0ad0c347c3179a82579c8fcf4e29",
  "transaction": "separate"
 },
 {
  "name": "22_vocabulary_phase6_rules.sql",
  "sha256": "a52a0fefcc6580df92d2772d0b4822fcde92c6ed368696f0238b7889be01c60a",
  "transaction": "separate"
 },
 {
  "name": "23_vocabulary_own_words.sql",
  "sha256": "d0da5d24bb098665a61797618e38b3348781997d331b4bd95513837b1d94a9a0",
  "transaction": "separate"
 },
 {
  "name": "24_learning_activity_days.sql",
  "sha256": "6e241c657639dea0f1ec25e36e30e7d00d0a7dad3bb363dcd48fe55d6409c29b",
  "transaction": "separate"
 },
 {
  "name": "25_vocabulary_lesson_switch.sql",
  "sha256": "f17c8cc8df5b484131154076c646879cc31f25a62ff532853a6904485d9fee66",
  "transaction": "separate"
 },
 {
  "name": "26_mail_signup_kind.sql",
  "sha256": "a995b13f3219dd592ef5e196020c0c921d9f32c322a2c9912e8a73ced438eace",
  "transaction": "separate"
 },
 {
  "name": "27_staff_signup_notification.sql",
  "sha256": "9e34eb0598790c11cbd2c5818f7b7340f2b61315a2bebed12bf577789fe72971",
  "transaction": "separate"
 },
 {
  "name": "28_mail_level_access_kind.sql",
  "sha256": "61d483ed5ce6e0d2478d6c872f30ad7936e72b185d9d54e4dc79eae651b3be42",
  "transaction": "separate"
 },
 {
  "name": "29_student_level_access_notification.sql",
  "sha256": "f9e54a85a88f76b666a7c43338e8f2ab9e3045a42ba8bcadbdd0762585b228a9",
  "transaction": "separate"
 },
 {
  "name": "30_fair_answer_grading.sql",
  "sha256": "f489b0a5773f5d612fb32d754155f41b5f2fd2dbdbf9b8cbd5b2b3366f448d5d",
  "transaction": "separate"
 },
 {
  "name": "31_vocabulary_target_forms.sql",
  "sha256": "11bfe95cc78dd7db0bc42c11444700e9c57e8ba2f202e89f095fefa6e7a579c3",
  "transaction": "separate"
 },
 {
  "name": "32_last_active_level.sql",
  "sha256": "01080fbae02207cb278ad00ddbef6358e3c10edf9b2e7826581f09bbffd3a852",
  "transaction": "separate"
 },
 {
  "name": "33_path_exercise_types.sql",
  "sha256": "afd9753489f9f955bf2a3e40252301dd88b35f9e475dcf7c75e0a4720c2b8912",
  "transaction": "separate"
 },
 {
  "name": "34_path_content_contract.sql",
  "sha256": "b4a23fb53028137ed52595ad9c019f5ee149f8d3d49f7798a8aca149e39e3ea0",
  "transaction": "separate"
 },
 {
  "name": "35_path_learning.sql",
  "sha256": "ef5d33b2ac86a49f31b4724a6760eff41e6cb58efd3b66c09fbe319bc9c70db6",
  "transaction": "separate"
 },
 {
  "name": "36_migrate_old_grammar_progress.sql",
  "sha256": "264bd5ca3f787e6123e4d03a623ca1353b08fe8e2c712dad34e34cd8bd0009a7",
  "transaction": "separate"
 },
 {
  "name": "37_vocabulary_carryover.sql",
  "sha256": "c83737b760f7405346f84d1cabc86acc5d46cd590b581e72d2b6b85e25ead8c2",
  "transaction": "separate"
 },
 {
  "name": "38_learning_sessions.sql",
  "sha256": "9396c758fd4c80903ae262c82283a935c098d3fdcf9d714a257be2d4c677fc1f",
  "transaction": "separate"
 },
 {
  "name": "39_teacher_dashboard.sql",
  "sha256": "e841b93f17638fbdf321c7d4cc59d1604a353b4c4de9c40eeded1a73f255d1ad",
  "transaction": "separate"
 },
 {
  "name": "40_level_access_verified_email.sql",
  "sha256": "96923e320266c8b8f84ac7d5086bff3903fd20d7ef86d7fb8ace31709b198119",
  "transaction": "separate"
 },
 {
  "name": "41_mail_notifications.sql",
  "sha256": "9a593e16286f8d65f1177a5cdfc9c81f059f4096393a7b61a28a75beaabd87df",
  "transaction": "separate"
 },
 {
  "name": "42_learning_new.sql",
  "sha256": "06d61d2ee6177158f434d4e6214b633ab40b3ea38c1ff399deec0b4977791a5c",
  "transaction": "separate"
 },
 {
  "name": "43_path_open_tests.sql",
  "sha256": "7915a42baee4e744f8f27890815c00b0d2015a120e20824cd63ef6071dfaa4e3",
  "transaction": "separate"
 },
 {
  "name": "44_path_task_help.sql",
  "sha256": "e9464811ff0e086a968ed3a482ebd61856bee0d4bee5a376c84e8aa37f39cc8e",
  "transaction": "separate"
 },
 {
  "name": "45_path_test_review.sql",
  "sha256": "4a5410c9a90506e9ef0d1354286e16fcfaf82ac1709434e1d220189949f6573c",
  "transaction": "separate"
 },
 {
  "name": "46_mail_reminder_kind.sql",
  "sha256": "ee3508942fc55cd63f2de2006c2ea9f6c6cddf49307da6ee3da638f661c7a43c",
  "transaction": "separate"
 },
 {
  "name": "47_mail_preferences.sql",
  "sha256": "63ec5c6ebc600ec5110ac1aab5f6583c87aa62f0d1462222df4c571acf26bbc4",
  "transaction": "separate"
 },
 {
  "name": "48_certificate_csv_schema.sql",
  "sha256": "c1580ed5f55420e7ffec6d01c3d6921f2f41e3eeeebe4d9c81d076ef4120c6f9",
  "transaction": "separate"
 },
 {
  "name": "49_certificate_csv_workflow.sql",
  "sha256": "6d1cbc97b04d06139fa1ab3ebec2db987f672a090131c592f21f85d17f3a146d",
  "transaction": "separate"
 },
 {
  "name": "50_certificate_eligibility_guards.sql",
  "sha256": "52ca820b5c687d1364e7a7e73b6f4ad4252d7d9de7c618954f38dc9be27a9e79",
  "transaction": "separate"
 },
 {
  "name": "51_certificate_pdf_issuance.sql",
  "sha256": "162c374e7544ccaa4081300f32d3ca038b9b174bae5defa3d6bd8c6fe0bb9acd",
  "transaction": "separate"
 },
 {
  "name": "52_independent_trainer_analytics.sql",
  "sha256": "d074637b10869994c1a801414074e5068202d36509dc7be7f57c47293af1a5de",
  "transaction": "separate"
 },
 {
  "name": "53_course_cancellation_billing.sql",
  "sha256": "5cf7d2760acf9ce830706342937d0dd4b0ad4f17d5b4ed62dabbda8b0d10c1dd",
  "transaction": "separate"
 },
 {
  "name": "54_learning_progress_focus.sql",
  "sha256": "6eedb7c925cf9cec80f9a9dc0047571744dc2105c1554cf53d9d5d4827fa24fd",
  "transaction": "separate"
 },
 {
  "name": "55_preserve_course_outages_focus_access.sql",
  "sha256": "757377a8dd732f162e38de448d6344dda8ecbbfd496351895980bd2c57258855",
  "transaction": "separate"
 },
 {
  "name": "56_answer_typographic_punctuation.sql",
  "sha256": "a04b6dccb192f4f65603c24a54e7c783b70f21568672bf360d7089106ca0c23a",
  "transaction": "separate"
 },
 {
  "name": "57_pronunciation_moderation_profile_deletion.sql",
  "sha256": "6df4dc945cf0ee91a04a5fd2a1fbc8b07617fbd024f0e1d38b6af840392b6d84",
  "transaction": "separate"
 },
 {
  "name": "58_path_authored_wrong_forms.sql",
  "sha256": "69ed2a04c9532f78c34c401f1e434143fc1c9303eae3b83389901fc8d3c1d2ce",
  "transaction": "separate"
 },
 {
  "name": "59_daily_quests.sql",
  "sha256": "c845e71b0c4cd10c89ca8d70951ddd1975d0e4b4dbc579932405bfa7b9821e14",
  "transaction": "separate"
 },
 {
  "name": "60_daily_quest_resume.sql",
  "sha256": "3096182ed8f50946f3e3690a41be7ac86ac34c2fb498117ee31b2d354dede0a7",
  "transaction": "separate"
 },
 {
  "name": "61_account_learning_checkpoints.sql",
  "sha256": "a53eab331cf2a5917d61cf8516a574576634dba57ef1ce38d600b5db9b2f3bcf",
  "transaction": "separate"
 },
 {
  "name": "62_verb_trainer_enums.sql",
  "sha256": "38a1ec1f3b5ca7a501de420420c8ef11ef07d470418022859b6323655aaf0ab9",
  "transaction": "separate"
 },
 {
  "name": "63_verb_trainer.sql",
  "sha256": "e63bcd77bc36a1f4fa70d38aab79d055fc3ea4511b9bfff991ec5234783c74f0",
  "transaction": "separate"
 },
 {
  "name": "64_daily_quest_male_characters.sql",
  "sha256": "18a21af0e332adc342e0738942957c5b3762d64434a345d1035c5983bfad4ff8",
  "transaction": "separate"
 },
 {
  "name": "65_sitov_verb_learning_progress.sql",
  "sha256": "da84ed5fb563b6c637fd01a3b5d19930fec994bc55f2a91de0eefe9e29e71197",
  "transaction": "separate"
 },
 {
  "name": "66_sitov_pronunciation_readiness.sql",
  "sha256": "b958685fa4f1b10dc42663621bbc63e50577bb836bf3f7f5db1a3156dd563f01",
  "transaction": "separate"
 },
 {
  "name": "67_sitov_daily_quest_catalog.sql",
  "sha256": "5667ac7e4fde09c8d94c41cb1d5eab63a25de40f4295726e40ef8b69918bdbf4",
  "transaction": "separate"
 },
 {
  "name": "68_sitov_confirmed_registration_monthly_access.sql",
  "sha256": "9b8b6e93d6eef0e10fc378ab2fabd860d1cd82c77e72eb66f044a93279ec27cd",
  "transaction": "separate"
 },
 {
  "name": "69_sitov_audio_preparation_requests.sql",
  "sha256": "12643eaaf87c32a88aa485fcf47a56010b42bdbe771bc7422e10cd068bdabc82",
  "transaction": "separate"
 },
 {
  "name": "70_sitov_prepared_own_vocabulary.sql",
  "sha256": "6976b79067400fde74a480ba4b6b24c322dc47d44985d1d64d28a9769663bf9d",
  "transaction": "separate"
 },
 {
  "name": "71_sitov_prepared_learning_publication.sql",
  "sha256": "ce97207a48621311bd99554ae4e9197fb072fbf214b1d11d03bdbc940c4956b0",
  "transaction": "separate"
 },
 {
  "name": "72_sitov_prepared_path_publication.sql",
  "sha256": "bfd6261b4f453de77fe85a927e4ecacf5b97f9a465545de4f79d2e0dbeaa7eba",
  "transaction": "separate"
 },
 {
  "name": "73_sitov_exam_preparation.sql",
  "sha256": "206745dcd62ddd97db26e1be7503ad2b76550ef9749c99a1594fc83a4de14488",
  "transaction": "separate"
 },
 {
  "name": "74_sitov_vocabulary_chunks_import.sql",
  "sha256": "50efb960e1b8226e16049e267f03af0152f8a6e16911b7c55020c318bf521fd6",
  "transaction": "separate"
 },
 {
  "name": "75_sitov_exam_simulation.sql",
  "sha256": "a58754c49851fa6ca90a7d20d019c510f2680ee509385b81e0ca55486c006588",
  "transaction": "separate"
 },
 {
  "name": "76_sitov_simulation_feature_access.sql",
  "sha256": "d8943e88e39c1db38a005edf256c887f49649ff460665ad814683cff34b5baa3",
  "transaction": "separate"
 },
 {
  "name": "77_sitov_simulation_staff_reset.sql",
  "sha256": "b3d73cc96572d60c7fd5e49e69f425ea2a65395fb36f154aba243350c3b9d88e",
  "transaction": "separate"
 },
 {
  "name": "78_sitov_simulation_teacher_management.sql",
  "sha256": "cdbe95568c84a5bb2d69d977bc50c220a8349b98d9354a0aa4ab6e06a6e43cae",
  "transaction": "separate"
 },
 {
  "name": "79_sitov_storage_security_limits.sql",
  "sha256": "23bc90123442197700dfea4de13291b89909389879423674a49d684ada9fc82f",
  "transaction": "separate"
 },
 {
  "name": "80_sitov_staff_mfa.sql",
  "sha256": "674c0ff1e11e6a5714926d95c6629d2f010eecc9633864ea974aeed491a86eb3",
  "transaction": "separate"
 },
 {
  "name": "81_sitov_explicit_api_default_privileges.sql",
  "sha256": "13a6e699244abd2577487f47ffbdcd07ef1e3fa13788c51f04466a53299b4613",
  "transaction": "separate"
 },
 {
  "name": "82_sitov_course_recording_optional.sql",
  "sha256": "81da0d3daed4eea1a7edc6c4fd1a6de823f75d3c4c70188057099340bc140b30",
  "transaction": "separate"
 },
 {
  "name": "83_sitov_teacher_password_login.sql",
  "sha256": "9e62a3c9924206e63a598eeba31ce9d582513575f0372214717e0573763a4ff8",
  "transaction": "separate"
 },
 {
  "name": "84_sitov_online_recording_requirement.sql",
  "sha256": "ea0ddab2dd5c90e4683164f8cd3bb3ca8b53c3613d242b305f88163642f5fc5b",
  "transaction": "separate"
 },
 {
  "name": "85_sitov_upper_levels.sql",
  "sha256": "ca37a49c0163650caa77cd8b6369acf975bda46aaf60bf267dee87879dc5cf1a",
  "transaction": "separate"
 },
 {
  "name": "86_sitov_release_upper_levels.sql",
  "sha256": "3bbc7f9f57a964b8466086411ff2d1c651350336dcb8630b73bbb5b01118773b",
  "transaction": "separate"
 },
 {
  "name": "87_sitov_course_level_3_inactive.sql",
  "sha256": "c924499604c05d2c7b2cb729070bcc893e99800f4f4e86e925814e397fbb0d8a",
  "transaction": "separate"
 },
 {
  "name": "88_sitov_independent_simulation_levels.sql",
  "sha256": "8433183a096d1de0f579c3d233a4a6274b73bfddbd9be7216c5eeaaa6c38911e",
  "transaction": "separate"
 },
 {
  "name": "89_sitov_media_storage_usage_breakdown.sql",
  "sha256": "e0275dd53edd63e7c4764650302f3615928949c15918bb75bff7abe5fa766ac1",
  "transaction": "separate"
 },
 {
  "name": "90_sitov_pronunciation_recall_evidence.sql",
  "sha256": "1b1505434b25cd73fc33d0b69d9b27617482b570fb858c1f18b5a70b04f49302",
  "transaction": "separate"
 },
 {
  "name": "91_sitov_learning_progress_media_visibility.sql",
  "sha256": "d47d6cf6ff5545c203a757c329e953934d1790c2247c981c2d0a507180177822",
  "transaction": "separate"
 },
 {
  "name": "92_sitov_verb_vocabulary_parity.sql",
  "sha256": "c69a1d3c298d111e3bf2e45138c73587f6d1411e083ecad8da0a688382a27e97",
  "transaction": "separate"
 }
]

export function sitovVerifyPinnedContent(content, expected, label) {
 const digest = createHash('sha256').update(content).digest('hex')
 if (digest !== expected) throw new Error(`Sitov baseline92 checksum mismatch: ${label}`)
 return content
}

export async function sitovLoadInstallTarget({target='baseline92'}={}) {
 if (target !== sitovBaseline92.target) throw new Error(`Unsupported Sitov install target: ${target}`)
 const [schema,lookups]=await Promise.all([readFile(sitovCurrentSchema,'utf8'),readFile(sitovPinnedLookups,'utf8')])
 return {schema:sitovVerifyPinnedContent(schema,sitovBaseline92.schemaSha256,'schema'),
  lookups:sitovVerifyPinnedContent(lookups,sitovBaseline92.lookupSha256,'lookups')}
}

/** Frozen baseline92. Mutable canonical schema/runner/seed are never install inputs. */
export async function sitovCurrentPlan({target='baseline92'}={}) {
 await sitovLoadInstallTarget({target})
 return {...sitovBaseline92, source:'pinned e22 canonical normalized baseline',
  migrations:structuredClone(sitovPinnedMigrations), historicalReplay:false,
  sequence:['synthetic Supabase SQL prerequisites','pinned normalized base',
   'pinned public catalog lookup INSERTs','pinned consolidated additions including 91 and 92',
   'Auth-owned trigger using real business_private.provision_profile()','synthetic rights/history baseline'],
  enumStrategy:'final enum labels created directly; historical62 separately committed in runner inventory',
  omissions:['Auth HTTP/JWT verification','PostgREST HTTP','Storage HTTP/object bytes'],
 }
}

export const sitovId = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
export const sitovUsers = { all: sitovId(101), none: sitovId(102), selected: sitovId(103),
 disabled: sitovId(104), german: sitovId(105), teacher: sitovId(106), outsider: sitovId(107), explicitAll: sitovId(108) }

/** Core normalized functions evaluate actual effective unit rights, not row counts. */
export async function sitovRightsSnapshot(db) {
 const rights = {}
 for (const [name,uid] of Object.entries(sitovUsers)) {
  // Private predicates are deliberately inaccessible to API roles. The owner
  // evaluates them with the learner's auth claims; direct-role RLS is tested separately.
  await db.actor(uid,'postgres',{role:'authenticated'})
  rights[name] = (await db.query(`SELECT u.id,u.level,u.trainer::text,
   trainer_access_private.allowed(u.level,u.trainer::text) AS trainer_allowed,
   learning_private.unit_allowed(u.id) AS unit_allowed
   FROM public.learning_units u WHERE u.label LIKE 'Sitov QA %' ORDER BY u.id`)).rows
 }
 await db.actor(null,'postgres')
 return rights
}

export async function sitovHistorySnapshot(db) {
 await db.actor(null,'postgres')
 const tables=['vocabulary_direction_progress','sitov_learning_checkpoints','sitov_pronunciation_access',
  'learning_activity_days','learning_sessions','submissions']
 const pairs=tables.map(table=>`'${table}',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]')
  FROM public.${table} t WHERE auth_user_id='${sitovUsers.selected}')`)
 pairs.push(`'messages',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id),'[]')
  FROM public.pronunciation_messages t WHERE submission_id='${sitovId(304)}')`)
 pairs.push(`'storage',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id),'[]')
  FROM storage.objects t WHERE id='${sitovId(305)}')`)
 return (await db.query(`SELECT jsonb_build_object(${pairs.join(',')}) snapshot`)).rows[0].snapshot
}
