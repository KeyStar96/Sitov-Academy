import type { Json } from './database.types'

/** Frozen SITOV-NIGHT-2026-10-08 RPC signatures. The DAL validates JSON
 * responses; declarations do not grant access or replace database checks. */
export type SitovCommercialAccessFunctions = {
  get_sitov_access_context: { Args: { p_student?: string | null }; Returns: Json }
  set_sitov_student_vip: { Args: { p_student: string; p_enabled: boolean; p_expected_revision: number }; Returns: Json }
  set_sitov_student_trial: { Args: { p_student: string; p_manifest: Json; p_expected_revision: number }; Returns: Json }
  get_sitov_access_catalog: { Args: { p_level: string; p_trainer: string }; Returns: Json }
  get_sitov_billing_settings: { Args: never; Returns: Json }
  set_sitov_billing_enabled: { Args: { p_enabled: boolean; p_expected_revision: number }; Returns: Json }
  set_sitov_product_price: { Args: { p_level: string; p_amount_minor: number; p_currency: string; p_expected_revision: number }; Returns: Json }
  start_sitov_checkout: { Args: { p_level: string; p_request_id: string }; Returns: Json }
}

export type SitovPronunciationPretestFunctions = {
  sitov_get_pronunciation_pretests: { Args: { p_level: string }; Returns: Json }
  sitov_start_pronunciation_pretest: { Args: { p_text_id: string; p_request_id: string }; Returns: Json }
  sitov_get_pronunciation_pretest_attempt: { Args: { p_attempt_id: string }; Returns: Json }
  sitov_save_pronunciation_pretest_answers: { Args: { p_attempt_id: string; p_revision: number; p_answers: Json; p_request_id: string }; Returns: Json }
  sitov_submit_pronunciation_pretest: { Args: { p_attempt_id: string; p_revision: number; p_answers: Json; p_request_id: string }; Returns: Json }
  sitov_get_pronunciation_pretest_staff: { Args: { p_text_id: string; p_student_id?: string | null }; Returns: Json }
  sitov_save_pronunciation_pretest_draft: { Args: { p_text_id: string; p_text_version: string; p_base_definition_id: string | null; p_definition: Json; p_request_id: string }; Returns: Json }
  sitov_get_pronunciation_pretest_publication: { Args: { p_text_id: string; p_definition_id: string; p_text_version: string; p_test_version: string; p_base_active_definition_id: string | null }; Returns: Json }
  sitov_publish_pronunciation_pretest: { Args: { p_text_id: string; p_definition_id: string; p_text_version: string; p_test_version: string; p_base_active_definition_id: string | null; p_request_id: string }; Returns: Json }
  sitov_create_pronunciation_upload_ticket: { Args: { p_text_id: string; p_request_id: string; p_extension: string }; Returns: Json }
  sitov_create_pronunciation_reply_upload_ticket: { Args: { p_submission_id: string; p_request_id: string; p_extension: string }; Returns: Json }
}

/** Frozen optional Special transport v1. Definitions remain private/inactive
 * until editorial and actual prepared-audio publication guards are verified. */
export type SitovLearningSpecialFunctions = {
  sitov_special_operation: {
    Args: { p_operation: string; p_node_id?: string | null; p_run_id?: string | null;
      p_mode?: string | null; p_revision?: number | null; p_request_id?: string | null;
      p_answers?: Json; p_locale?: string }
    Returns: Json
  }
  sitov_special_staff_catalog: { Args: { p_node_id: string }; Returns: Json }
  sitov_special_author_context: { Args: { p_unit_id: string; p_anchor_id: string; p_source_ref: string }; Returns: Json }
  sitov_special_author_create: { Args: { p_input: Json }; Returns: Json }
  sitov_get_special_publication: { Args: { p_node_id: string; p_definition_id: string; p_definition_version: string; p_source_sha256: string; p_base_active_definition_id: string | null }; Returns: Json }
  sitov_publish_special: { Args: { p_node_id: string; p_definition_id: string; p_definition_version: string; p_source_sha256: string; p_base_active_definition_id: string | null; p_request_id: string }; Returns: Json }
}
