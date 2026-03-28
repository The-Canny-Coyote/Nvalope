export interface AssignmentRule {
  id: string;
  pattern: string;
  envelopeId: string;
  priority: number;
}

export interface RuleMatchResult {
  envelopeId: string;
  priority: number;
}

function compilePattern(pattern: string): RegExp {
  return new RegExp(pattern, 'i');
}

/** Sort descending by priority; first matching regex wins. */
export function sortRulesByPriority(rules: readonly AssignmentRule[]): AssignmentRule[] {
  return [...rules].sort((a, b) => b.priority - a.priority);
}

/**
 * @param text Description or normalized payee to test
 */
export function applyAssignmentRules(text: string, rulesSorted: readonly AssignmentRule[]): RuleMatchResult | null {
  const t = text.trim();
  if (!t) return null;
  for (const rule of rulesSorted) {
    try {
      const re = compilePattern(rule.pattern);
      if (re.test(t)) {
        return { envelopeId: rule.envelopeId, priority: rule.priority };
      }
    } catch {
      /* invalid regex — skip rule */
    }
  }
  return null;
}
