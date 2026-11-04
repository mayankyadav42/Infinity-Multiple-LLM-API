/** Infinity's publication gate for the free-model catalogue.
 *
 * A provider's /models response only proves that an identifier is visible; it
 * does not prove that inference on that model is free. This function requires
 * current model-specific evidence for recurring no-charge access before a
 * model can be auto-published. Anything ambiguous is routed to Review.
 */

export type InfinityModelClassification =
  | 'verified_free'
  | 'restricted_free'
  | 'trial_only'
  | 'paid_only'
  | 'unknown'
  | 'retired';

export type InfinityEvidenceType =
  | 'official_pricing'
  | 'official_model_catalog'
  | 'official_rate_limits'
  | 'official_api_response'
  | 'manual_review';

export interface InfinityFreeModelEvidence {
  providerId: string;
  modelId: string;
  classification: InfinityModelClassification;
  recurringNoCharge: boolean;
  modelSpecific: boolean;
  evidenceType: InfinityEvidenceType;
  evidenceUrl: string;
  officialEvidenceHosts: string[];
  verifiedAt: string;
  validUntil?: string | null;
  accountTier?: string | null;
  regionScope?: string | null;
}

export type InfinityPublicationDecision =
  | { action: 'auto_add'; reason: 'current_model_specific_recurring_free_evidence' }
  | { action: 'review'; reason: string }
  | { action: 'exclude'; reason: string };

export function evaluateInfinityFreeModelEvidence(
  evidence: InfinityFreeModelEvidence,
  now: Date = new Date(),
): InfinityPublicationDecision {
  if (!evidence.providerId.trim() || !evidence.modelId.trim()) {
    return { action: 'review', reason: 'provider_or_model_identifier_missing' };
  }

  let evidenceHost = '';
  try {
    const parsedUrl = new URL(evidence.evidenceUrl);
    if (parsedUrl.protocol !== 'https:') throw new Error('https required');
    evidenceHost = parsedUrl.hostname.toLowerCase();
  } catch {
    return { action: 'review', reason: 'official_https_evidence_url_required' };
  }

  const allowedHosts = evidence.officialEvidenceHosts.map(host => host.toLowerCase());
  if (!allowedHosts.includes(evidenceHost)) {
    return { action: 'review', reason: 'evidence_host_not_in_provider_official_allowlist' };
  }

  if (evidence.classification === 'paid_only' || evidence.classification === 'retired') {
    return { action: 'exclude', reason: evidence.classification };
  }

  if (evidence.classification === 'trial_only') {
    return { action: 'exclude', reason: 'trial_credits_are_not_recurring_free_access' };
  }

  if (evidence.classification === 'unknown') {
    return { action: 'review', reason: 'free_tier_status_unverified' };
  }

  if (!evidence.modelSpecific) {
    return { action: 'review', reason: 'provider_level_evidence_does_not_prove_model_eligibility' };
  }

  if (!evidence.recurringNoCharge) {
    return { action: 'review', reason: 'recurring_no_charge_access_not_confirmed' };
  }

  const verifiedAt = Date.parse(evidence.verifiedAt);
  if (!Number.isFinite(verifiedAt) || verifiedAt > now.getTime()) {
    return { action: 'review', reason: 'evidence_verification_timestamp_invalid' };
  }

  if (evidence.validUntil) {
    const validUntil = Date.parse(evidence.validUntil);
    if (!Number.isFinite(validUntil) || validUntil <= now.getTime()) {
      return { action: 'review', reason: 'evidence_expired_or_invalid' };
    }
  }

  if (!evidence.accountTier?.trim()) {
    return { action: 'review', reason: 'eligible_account_tier_not_specified' };
  }

  if (!evidence.regionScope?.trim()) {
    return { action: 'review', reason: 'region_scope_not_specified' };
  }

  return {
    action: 'auto_add',
    reason: 'current_model_specific_recurring_free_evidence',
  };
}
