import { describe, expect, it } from 'vitest';
import {
  evaluateInfinityFreeModelEvidence,
  type InfinityFreeModelEvidence,
} from '../../services/infinity-free-model-policy.js';

const NOW = new Date('2026-11-04T00:00:00.000Z');

function validEvidence(overrides: Partial<InfinityFreeModelEvidence> = {}): InfinityFreeModelEvidence {
  return {
    providerId: 'google',
    modelId: 'gemini-example-free-model',
    classification: 'restricted_free',
    recurringNoCharge: true,
    modelSpecific: true,
    evidenceType: 'official_pricing',
    evidenceUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
    officialEvidenceHosts: ['ai.google.dev', 'generativelanguage.googleapis.com', 'cloud.google.com'],
    verifiedAt: '2026-11-03T12:00:00.000Z',
    validUntil: '2026-12-03T12:00:00.000Z',
    accountTier: 'free',
    regionScope: 'supported_regions',
    ...overrides,
  };
}

describe('Infinity free-model publication policy', () => {
  it('auto-adds only current, model-specific recurring no-charge evidence', () => {
    expect(evaluateInfinityFreeModelEvidence(validEvidence(), NOW)).toEqual({
      action: 'auto_add',
      reason: 'current_model_specific_recurring_free_evidence',
    });
  });

  it('rejects evidence URLs outside the provider official-host allowlist', () => {
    expect(evaluateInfinityFreeModelEvidence(validEvidence({ evidenceUrl: 'https://example.com/fake-pricing' }), NOW)).toMatchObject({
      action: 'review',
      reason: 'evidence_host_not_in_provider_official_allowlist',
    });
  });

  it('sends provider-level-only evidence to Review', () => {
    expect(evaluateInfinityFreeModelEvidence(validEvidence({ modelSpecific: false }), NOW)).toMatchObject({
      action: 'review',
      reason: 'provider_level_evidence_does_not_prove_model_eligibility',
    });
  });

  it('does not treat trial credits as recurring free access', () => {
    expect(evaluateInfinityFreeModelEvidence(validEvidence({ classification: 'trial_only' }), NOW)).toMatchObject({
      action: 'exclude',
      reason: 'trial_credits_are_not_recurring_free_access',
    });
  });

  it('sends expired evidence to Review', () => {
    expect(evaluateInfinityFreeModelEvidence(validEvidence({ validUntil: '2026-11-03T23:59:59.000Z' }), NOW)).toMatchObject({
      action: 'review',
      reason: 'evidence_expired_or_invalid',
    });
  });

  it('excludes paid-only models', () => {
    expect(evaluateInfinityFreeModelEvidence(validEvidence({ classification: 'paid_only' }), NOW)).toMatchObject({
      action: 'exclude',
      reason: 'paid_only',
    });
  });

  it('requires account-tier and region scope before automatic publication', () => {
    expect(evaluateInfinityFreeModelEvidence(validEvidence({ accountTier: null }), NOW)).toMatchObject({ action: 'review' });
    expect(evaluateInfinityFreeModelEvidence(validEvidence({ regionScope: null }), NOW)).toMatchObject({ action: 'review' });
  });
});
