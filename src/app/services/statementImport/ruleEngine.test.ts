import { describe, expect, it } from 'vitest';
import { applyAssignmentRules, sortRulesByPriority, type AssignmentRule } from './ruleEngine';

describe('rule engine', () => {
  const rules: AssignmentRule[] = [
    { id: '1', pattern: 'coffee', envelopeId: 'env-coffee', priority: 10 },
    { id: '2', pattern: 'star', envelopeId: 'env-star', priority: 5 },
    { id: '3', pattern: 'gas', envelopeId: 'env-gas', priority: 20 },
  ];

  it('sorts by priority descending', () => {
    const s = sortRulesByPriority(rules);
    expect(s[0].id).toBe('3');
    expect(s[1].id).toBe('1');
    expect(s[2].id).toBe('2');
  });

  it('first match wins after sort', () => {
    const sorted = sortRulesByPriority(rules);
    expect(applyAssignmentRules('shell gas station', sorted)?.envelopeId).toBe('env-gas');
    expect(applyAssignmentRules('starbucks latte coffee', sorted)?.envelopeId).toBe('env-coffee');
  });

  it('returns null when no rule matches', () => {
    expect(applyAssignmentRules('nothing here', sortRulesByPriority(rules))).toBeNull();
  });
});
