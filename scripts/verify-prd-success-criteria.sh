#!/usr/bin/env bash
# PRD success criteria audit — maps all 24 criteria to automated tests or manual checks.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; exit 1; }
manual() { echo "MANUAL: $1"; }

echo "=== PRD Success Criteria Audit (§23) ==="
echo ""

# criterion_number|description|verification_type|reference
CRITERIA=(
  "1|Watchlists import successfully and return immediately with a job ID|test|test_import_returns_job_immediately"
  "2|Enrichment status is poll-visible per film and per job|test|test_import_pipeline_completes_with_accurate_counts"
  "3|Metadata enrichment succeeds|test|test_import_pipeline_completes_with_accurate_counts"
  "4|Semantic enrichment is generated and persisted|test|test_semantic_profile_and_embedding_persisted"
  "5|Semantic profiles are versioned|test|test_semantic_profile_and_embedding_persisted"
  "6|Film embeddings are generated and stored|test|test_semantic_profile_and_embedding_persisted"
  "7|Recommendation profiles are created independently of sessions|test|test_identical_questionnaire_profile_cache_hit"
  "8|Sessions reference profiles via profile_id|test|test_end_to_end_recommendation"
  "9|Recommendation profile embeddings are cached by profile hash|test|test_identical_questionnaire_profile_cache_hit"
  "10|Candidate retrieval uses vector similarity|test|test_end_to_end_recommendation"
  "11|Retrieval traces are stored|test|test_end_to_end_recommendation"
  "12|Recommendations come exclusively from films with enrichment_status = ready|test|test_end_to_end_recommendation"
  "13|Subtitle filtering uses original_language as proxy|test|test_non_english_film_excluded_when_subtitles_no"
  "14|Recommendation history is auditable via stored profile and version metadata|test|test_history_list_and_detail"
  "15|RSS synchronization updates watchlist state|test|test_rss_poll_idempotent"
  "16|Developer Mode exposes recommendation internals|test|test_dev_endpoints_return_trace_when_enabled"
  "17|Recommendation generation completes within 30 seconds|test|test_end_to_end_recommendation"
  "18|Users receive one winner and four runners-up with structured reasoning|manual|UI results screen or integration response shape (test_end_to_end_recommendation asserts winner + runners_up)"
  "19|All recommendation decisions are explainable and traceable|test|test_end_to_end_recommendation"
  "20|Archived films retain metadata and recommendation history|test|test_csv_sync_re_add_archived"
  "21|Watched films are excluded from future recommendations|test|test_watched_film_excluded_from_stage1_query"
  "22|Provider changes require only config.yaml edits, not code changes|manual|Change provider in config.yaml; no application code edit required"
  "23|Constraint relaxation is recorded as a JSONB object on the session|test|test_runtime_relaxation_recorded"
  "24|The recommendation system promotes variety while remaining explainable|test|test_end_to_end_recommendation"
)

missing=0
manual_count=0
auto_count=0

for entry in "${CRITERIA[@]}"; do
  IFS='|' read -r num desc kind ref <<< "$entry"
  if [[ "$kind" == "manual" ]]; then
    manual_count=$((manual_count + 1))
    printf "  #%-2s %-8s %s\n" "$num" "[manual]" "$desc"
    printf "       → %s\n" "$ref"
    continue
  fi

  if (cd api && pytest tests/ --collect-only -q 2>/dev/null | grep -q "$ref"); then
    auto_count=$((auto_count + 1))
    printf "  #%-2s %-8s %s\n" "$num" "[test]" "$desc"
    printf "       → %s\n" "$ref"
  else
    missing=$((missing + 1))
    printf "  #%-2s %-8s %s\n" "$num" "[MISSING]" "$desc"
    printf "       → expected test: %s\n" "$ref"
  fi
done

echo ""
echo "Summary: ${auto_count} automated, ${manual_count} manual, ${missing} missing"
echo ""

if [[ "$missing" -gt 0 ]]; then
  fail "${missing} PRD criteria lack mapped automated tests"
fi

pass "All 24 PRD success criteria have documented verification paths (${auto_count} automated + ${manual_count} manual)"
