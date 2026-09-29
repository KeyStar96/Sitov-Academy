import type { Json } from './database.types'

// Mirrors the certificate CSV migration and its applied PostgreSQL catalog.
// Keep this additive module separate from the existing generated table definitions.
export type CertificateTables = {
  import_batches: {
    Row: {
      account_key: string
      applied_at: string | null
      baseline_hash: string | null
      created_at: string
      created_by: string | null
      export_year: number | null
      exported_at: string
      file_sha256: string
      filename: string
      id: string
      is_complete_snapshot: boolean
      kind: string
      scope: Json
      status: string
      summary: Json
      updated_at: string
    }
    Insert: {
      account_key?: string
      applied_at?: string | null
      baseline_hash?: string | null
      created_at?: string
      created_by?: string | null
      export_year?: number | null
      exported_at: string
      file_sha256: string
      filename: string
      id?: string
      is_complete_snapshot?: boolean
      kind: string
      scope?: Json
      status?: string
      summary?: Json
      updated_at?: string
    }
    Update: {
      account_key?: string
      applied_at?: string | null
      baseline_hash?: string | null
      created_at?: string
      created_by?: string | null
      export_year?: number | null
      exported_at?: string
      file_sha256?: string
      filename?: string
      id?: string
      is_complete_snapshot?: boolean
      kind?: string
      scope?: Json
      status?: string
      summary?: Json
      updated_at?: string
    }
    Relationships: [
      {
        foreignKeyName: "import_batches_created_by_fkey"
        columns: ["created_by"]
        isOneToOne: false
        referencedRelation: "profiles"
        referencedColumns: ["id"]
      },
    ]
  }
  import_rows: {
    Row: {
      batch_id: string
      created_at: string
      disposition: string
      external_key: string | null
      id: string
      issues: Json
      normalized_data: Json
      raw_data: Json
      resolution: Json
      row_number: number
      updated_at: string
    }
    Insert: {
      batch_id: string
      created_at?: string
      disposition: string
      external_key?: string | null
      id?: string
      issues?: Json
      normalized_data?: Json
      raw_data?: Json
      resolution?: Json
      row_number: number
      updated_at?: string
    }
    Update: {
      batch_id?: string
      created_at?: string
      disposition?: string
      external_key?: string | null
      id?: string
      issues?: Json
      normalized_data?: Json
      raw_data?: Json
      resolution?: Json
      row_number?: number
      updated_at?: string
    }
    Relationships: [
      {
        foreignKeyName: "import_rows_batch_id_fkey"
        columns: ["batch_id"]
        isOneToOne: false
        referencedRelation: "import_batches"
        referencedColumns: ["id"]
      },
    ]
  }
  external_customers: {
    Row: {
      account_key: string
      city: string | null
      created_at: string
      customer_number: string
      display_name: string
      email: string | null
      id: string
      last_import_batch_id: string | null
      person_id: string | null
      phone: string | null
      postal_code: string | null
      review_reason: string | null
      review_status: string
      source_data: Json
      source_exported_at: string | null
      source_revision: number
      street: string | null
      updated_at: string
    }
    Insert: {
      account_key?: string
      city?: string | null
      created_at?: string
      customer_number: string
      display_name?: string
      email?: string | null
      id?: string
      last_import_batch_id?: string | null
      person_id?: string | null
      phone?: string | null
      postal_code?: string | null
      review_reason?: string | null
      review_status?: string
      source_data?: Json
      source_exported_at?: string | null
      source_revision?: number
      street?: string | null
      updated_at?: string
    }
    Update: {
      account_key?: string
      city?: string | null
      created_at?: string
      customer_number?: string
      display_name?: string
      email?: string | null
      id?: string
      last_import_batch_id?: string | null
      person_id?: string | null
      phone?: string | null
      postal_code?: string | null
      review_reason?: string | null
      review_status?: string
      source_data?: Json
      source_exported_at?: string | null
      source_revision?: number
      street?: string | null
      updated_at?: string
    }
    Relationships: [
      {
        foreignKeyName: "external_customers_last_import_batch_id_fkey"
        columns: ["last_import_batch_id"]
        isOneToOne: false
        referencedRelation: "import_batches"
        referencedColumns: ["id"]
      },
      {
        foreignKeyName: "external_customers_person_id_fkey"
        columns: ["person_id"]
        isOneToOne: false
        referencedRelation: "people"
        referencedColumns: ["id"]
      },
    ]
  }
  external_products: {
    Row: {
      account_key: string
      article_number: string
      created_at: string
      description: string
      id: string
      last_import_batch_id: string | null
      name: string
      review_reason: string | null
      review_status: string
      source_data: Json
      source_exported_at: string | null
      source_revision: number
      unit: string | null
      unit_price: number | null
      updated_at: string
    }
    Insert: {
      account_key?: string
      article_number: string
      created_at?: string
      description?: string
      id?: string
      last_import_batch_id?: string | null
      name: string
      review_reason?: string | null
      review_status?: string
      source_data?: Json
      source_exported_at?: string | null
      source_revision?: number
      unit?: string | null
      unit_price?: number | null
      updated_at?: string
    }
    Update: {
      account_key?: string
      article_number?: string
      created_at?: string
      description?: string
      id?: string
      last_import_batch_id?: string | null
      name?: string
      review_reason?: string | null
      review_status?: string
      source_data?: Json
      source_exported_at?: string | null
      source_revision?: number
      unit?: string | null
      unit_price?: number | null
      updated_at?: string
    }
    Relationships: [
      {
        foreignKeyName: "external_products_last_import_batch_id_fkey"
        columns: ["last_import_batch_id"]
        isOneToOne: false
        referencedRelation: "import_batches"
        referencedColumns: ["id"]
      },
    ]
  }
  external_product_courses: {
    Row: {
      certificate_description: string
      certificate_title: string
      course_id: string
      created_at: string
      product_id: string
      schedule_snapshot: Json
      updated_at: string
      version: number
    }
    Insert: {
      certificate_description?: string
      certificate_title: string
      course_id: string
      created_at?: string
      product_id: string
      schedule_snapshot?: Json
      updated_at?: string
      version?: number
    }
    Update: {
      certificate_description?: string
      certificate_title?: string
      course_id?: string
      created_at?: string
      product_id?: string
      schedule_snapshot?: Json
      updated_at?: string
      version?: number
    }
    Relationships: [
      {
        foreignKeyName: "external_product_courses_course_id_fkey"
        columns: ["course_id"]
        isOneToOne: false
        referencedRelation: "courses"
        referencedColumns: ["id"]
      },
      {
        foreignKeyName: "external_product_courses_product_id_fkey"
        columns: ["product_id"]
        isOneToOne: false
        referencedRelation: "external_products"
        referencedColumns: ["id"]
      },
    ]
  }
  invoices: {
    Row: {
      account_key: string
      article_numbers: string[]
      created_at: string
      currency: string
      customer_number: string | null
      discount_amount: number
      document_type: string
      due_date: string | null
      external_customer_id: string | null
      gross_amount: number
      id: string
      invoice_date: string
      invoice_number: string
      last_import_batch_id: string | null
      last_seen_at: string
      paid_amount: number
      paid_at: string | null
      payment_status: string
      review_reason: string | null
      service_month: string | null
      service_month_source: string | null
      source_data: Json
      source_exported_at: string
      source_revision: number
      source_status: string
      subject: string
      updated_at: string
      validity: string
    }
    Insert: {
      account_key?: string
      article_numbers?: string[]
      created_at?: string
      currency?: string
      customer_number?: string | null
      discount_amount?: number
      document_type?: string
      due_date?: string | null
      external_customer_id?: string | null
      gross_amount: number
      id?: string
      invoice_date: string
      invoice_number: string
      last_import_batch_id?: string | null
      last_seen_at?: string
      paid_amount?: number
      paid_at?: string | null
      payment_status?: string
      review_reason?: string | null
      service_month?: string | null
      service_month_source?: string | null
      source_data?: Json
      source_exported_at: string
      source_revision?: number
      source_status: string
      subject?: string
      updated_at?: string
      validity?: string
    }
    Update: {
      account_key?: string
      article_numbers?: string[]
      created_at?: string
      currency?: string
      customer_number?: string | null
      discount_amount?: number
      document_type?: string
      due_date?: string | null
      external_customer_id?: string | null
      gross_amount?: number
      id?: string
      invoice_date?: string
      invoice_number?: string
      last_import_batch_id?: string | null
      last_seen_at?: string
      paid_amount?: number
      paid_at?: string | null
      payment_status?: string
      review_reason?: string | null
      service_month?: string | null
      service_month_source?: string | null
      source_data?: Json
      source_exported_at?: string
      source_revision?: number
      source_status?: string
      subject?: string
      updated_at?: string
      validity?: string
    }
    Relationships: [
      {
        foreignKeyName: "invoices_external_customer_id_fkey"
        columns: ["external_customer_id"]
        isOneToOne: false
        referencedRelation: "external_customers"
        referencedColumns: ["id"]
      },
      {
        foreignKeyName: "invoices_last_import_batch_id_fkey"
        columns: ["last_import_batch_id"]
        isOneToOne: false
        referencedRelation: "import_batches"
        referencedColumns: ["id"]
      },
    ]
  }
  invoice_relations: {
    Row: {
      confirmed: boolean
      confirmed_at: string | null
      confirmed_by: string | null
      created_at: string
      id: string
      original_invoice_id: string
      related_invoice_id: string
      relation_type: string
      updated_at: string
    }
    Insert: {
      confirmed?: boolean
      confirmed_at?: string | null
      confirmed_by?: string | null
      created_at?: string
      id?: string
      original_invoice_id: string
      related_invoice_id: string
      relation_type: string
      updated_at?: string
    }
    Update: {
      confirmed?: boolean
      confirmed_at?: string | null
      confirmed_by?: string | null
      created_at?: string
      id?: string
      original_invoice_id?: string
      related_invoice_id?: string
      relation_type?: string
      updated_at?: string
    }
    Relationships: [
      {
        foreignKeyName: "invoice_relations_confirmed_by_fkey"
        columns: ["confirmed_by"]
        isOneToOne: false
        referencedRelation: "profiles"
        referencedColumns: ["id"]
      },
      {
        foreignKeyName: "invoice_relations_original_invoice_id_fkey"
        columns: ["original_invoice_id"]
        isOneToOne: false
        referencedRelation: "invoices"
        referencedColumns: ["id"]
      },
      {
        foreignKeyName: "invoice_relations_related_invoice_id_fkey"
        columns: ["related_invoice_id"]
        isOneToOne: false
        referencedRelation: "invoices"
        referencedColumns: ["id"]
      },
    ]
  }
  invoice_allocations: {
    Row: {
      booking_item_id: string | null
      course_id: string
      created_at: string
      created_by: string | null
      end_date: string
      id: string
      invoice_id: string
      person_id: string
      source: string
      source_revision: number
      start_date: string
      status: string
      updated_at: string
    }
    Insert: {
      booking_item_id?: string | null
      course_id: string
      created_at?: string
      created_by?: string | null
      end_date: string
      id?: string
      invoice_id: string
      person_id: string
      source?: string
      source_revision?: number
      start_date: string
      status?: string
      updated_at?: string
    }
    Update: {
      booking_item_id?: string | null
      course_id?: string
      created_at?: string
      created_by?: string | null
      end_date?: string
      id?: string
      invoice_id?: string
      person_id?: string
      source?: string
      source_revision?: number
      start_date?: string
      status?: string
      updated_at?: string
    }
    Relationships: [
      {
        foreignKeyName: "invoice_allocations_booking_item_id_fkey"
        columns: ["booking_item_id"]
        isOneToOne: false
        referencedRelation: "booking_items"
        referencedColumns: ["id"]
      },
      {
        foreignKeyName: "invoice_allocations_course_id_fkey"
        columns: ["course_id"]
        isOneToOne: false
        referencedRelation: "courses"
        referencedColumns: ["id"]
      },
      {
        foreignKeyName: "invoice_allocations_created_by_fkey"
        columns: ["created_by"]
        isOneToOne: false
        referencedRelation: "profiles"
        referencedColumns: ["id"]
      },
      {
        foreignKeyName: "invoice_allocations_invoice_id_fkey"
        columns: ["invoice_id"]
        isOneToOne: false
        referencedRelation: "invoices"
        referencedColumns: ["id"]
      },
      {
        foreignKeyName: "invoice_allocations_person_id_fkey"
        columns: ["person_id"]
        isOneToOne: false
        referencedRelation: "people"
        referencedColumns: ["id"]
      },
    ]
  }
  participation_periods: {
    Row: {
      booking_item_id: string | null
      confirmed_at: string | null
      confirmed_by: string | null
      course_id: string
      created_at: string
      description_snapshot: string
      end_date: string
      id: string
      note: string | null
      person_id: string
      revision: number
      schedule_snapshot: Json
      source_revision: number
      start_date: string
      status: string
      title_snapshot: string
      updated_at: string
    }
    Insert: {
      booking_item_id?: string | null
      confirmed_at?: string | null
      confirmed_by?: string | null
      course_id: string
      created_at?: string
      description_snapshot?: string
      end_date: string
      id?: string
      note?: string | null
      person_id: string
      revision?: number
      schedule_snapshot?: Json
      source_revision?: number
      start_date: string
      status?: string
      title_snapshot: string
      updated_at?: string
    }
    Update: {
      booking_item_id?: string | null
      confirmed_at?: string | null
      confirmed_by?: string | null
      course_id?: string
      created_at?: string
      description_snapshot?: string
      end_date?: string
      id?: string
      note?: string | null
      person_id?: string
      revision?: number
      schedule_snapshot?: Json
      source_revision?: number
      start_date?: string
      status?: string
      title_snapshot?: string
      updated_at?: string
    }
    Relationships: [
      {
        foreignKeyName: "participation_periods_booking_item_id_fkey"
        columns: ["booking_item_id"]
        isOneToOne: false
        referencedRelation: "booking_items"
        referencedColumns: ["id"]
      },
      {
        foreignKeyName: "participation_periods_confirmed_by_fkey"
        columns: ["confirmed_by"]
        isOneToOne: false
        referencedRelation: "profiles"
        referencedColumns: ["id"]
      },
      {
        foreignKeyName: "participation_periods_course_id_fkey"
        columns: ["course_id"]
        isOneToOne: false
        referencedRelation: "courses"
        referencedColumns: ["id"]
      },
      {
        foreignKeyName: "participation_periods_person_id_fkey"
        columns: ["person_id"]
        isOneToOne: false
        referencedRelation: "people"
        referencedColumns: ["id"]
      },
    ]
  }
  certificate_issues: {
    Row: {
      certificate_number: string | null
      created_at: string
      failure_reason: string | null
      id: string
      issued_at: string | null
      pdf_sha256: string | null
      person_id: string
      requested_by: string | null
      requested_month: string | null
      revoked_at: string | null
      revoked_by: string | null
      revoked_reason: string | null
      snapshot: Json
      status: string
      storage_bucket: string
      storage_path: string | null
      template_version: string
      updated_at: string
    }
    Insert: {
      certificate_number?: string | null
      created_at?: string
      failure_reason?: string | null
      id?: string
      issued_at?: string | null
      pdf_sha256?: string | null
      person_id: string
      requested_by?: string | null
      requested_month?: string | null
      revoked_at?: string | null
      revoked_by?: string | null
      revoked_reason?: string | null
      snapshot: Json
      status?: string
      storage_bucket?: string
      storage_path?: string | null
      template_version?: string
      updated_at?: string
    }
    Update: {
      certificate_number?: string | null
      created_at?: string
      failure_reason?: string | null
      id?: string
      issued_at?: string | null
      pdf_sha256?: string | null
      person_id?: string
      requested_by?: string | null
      requested_month?: string | null
      revoked_at?: string | null
      revoked_by?: string | null
      revoked_reason?: string | null
      snapshot?: Json
      status?: string
      storage_bucket?: string
      storage_path?: string | null
      template_version?: string
      updated_at?: string
    }
    Relationships: [
      {
        foreignKeyName: "certificate_issues_person_id_fkey"
        columns: ["person_id"]
        isOneToOne: false
        referencedRelation: "people"
        referencedColumns: ["id"]
      },
      {
        foreignKeyName: "certificate_issues_requested_by_fkey"
        columns: ["requested_by"]
        isOneToOne: false
        referencedRelation: "profiles"
        referencedColumns: ["id"]
      },
      {
        foreignKeyName: "certificate_issues_revoked_by_fkey"
        columns: ["revoked_by"]
        isOneToOne: false
        referencedRelation: "profiles"
        referencedColumns: ["id"]
      },
    ]
  }
  certificate_sources: {
    Row: {
      allocation_revision: number
      created_at: string
      id: string
      invoice_allocation_id: string
      invoice_revision: number
      issue_id: string
      participation_period_id: string
      participation_revision: number
      snapshot: Json
      source_revision: number
    }
    Insert: {
      allocation_revision: number
      created_at?: string
      id?: string
      invoice_allocation_id: string
      invoice_revision: number
      issue_id: string
      participation_period_id: string
      participation_revision: number
      snapshot: Json
      source_revision: number
    }
    Update: {
      allocation_revision?: number
      created_at?: string
      id?: string
      invoice_allocation_id?: string
      invoice_revision?: number
      issue_id?: string
      participation_period_id?: string
      participation_revision?: number
      snapshot?: Json
      source_revision?: number
    }
    Relationships: [
      {
        foreignKeyName: "certificate_sources_invoice_allocation_id_fkey"
        columns: ["invoice_allocation_id"]
        isOneToOne: false
        referencedRelation: "invoice_allocations"
        referencedColumns: ["id"]
      },
      {
        foreignKeyName: "certificate_sources_issue_id_fkey"
        columns: ["issue_id"]
        isOneToOne: false
        referencedRelation: "certificate_issues"
        referencedColumns: ["id"]
      },
      {
        foreignKeyName: "certificate_sources_participation_period_id_fkey"
        columns: ["participation_period_id"]
        isOneToOne: false
        referencedRelation: "participation_periods"
        referencedColumns: ["id"]
      },
    ]
  }
  certificate_audit_log: {
    Row: {
      action: string
      actor_id: string | null
      after_data: Json | null
      before_data: Json | null
      created_at: string
      entity_id: string
      entity_type: string
      id: string
      import_batch_id: string | null
    }
    Insert: {
      action: string
      actor_id?: string | null
      after_data?: Json | null
      before_data?: Json | null
      created_at?: string
      entity_id: string
      entity_type: string
      id?: string
      import_batch_id?: string | null
    }
    Update: {
      action?: string
      actor_id?: string | null
      after_data?: Json | null
      before_data?: Json | null
      created_at?: string
      entity_id?: string
      entity_type?: string
      id?: string
      import_batch_id?: string | null
    }
    Relationships: [
      {
        foreignKeyName: "certificate_audit_log_actor_id_fkey"
        columns: ["actor_id"]
        isOneToOne: false
        referencedRelation: "profiles"
        referencedColumns: ["id"]
      },
      {
        foreignKeyName: "certificate_audit_log_import_batch_id_fkey"
        columns: ["import_batch_id"]
        isOneToOne: false
        referencedRelation: "import_batches"
        referencedColumns: ["id"]
      },
    ]
  }
}

export type CertificateFunctions = {
  certificate_issue_command: {
    Args: { p_actor: string; p_command: string; p_payload?: Json }
    Returns: Json
  }
  certificate_import_baseline: {
    Args: { p_account: string }
    Returns: string
  }
  certificate_staff_command: {
    Args: { p_actor: string; p_command: string; p_payload: Json }
    Returns: Json
  }
  certificate_eligibility: {
    Args: { p_person: string }
    Returns: Json
  }
}
