export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface SeverityIssue {
  dataLoss?: boolean;
  authBypass?: boolean;
  runtimeCrash?: boolean;
  hardcodedSecret?: boolean;
  unhandledEdgeCase?: boolean;
  performanceIssue?: boolean;
  validationMissing?: boolean;
  logicalError?: boolean;
  missingErrorHandling?: boolean;
  styleOnly?: boolean;
}

/**
 * Classifies the severity of an issue based on a decision tree.
 *
 * Decision logic:
 * - CRITICAL: data loss, auth bypass, runtime crash, or hardcoded secret
 * - HIGH: unhandled edge case, performance issue (O(n²)+), or missing validation (non-auth)
 * - MEDIUM: style issues combined with logic concerns (not purely cosmetic)
 * - LOW: style-only issues
 * - INFO: no flags set — informational only
 */
export function classifySeverity(issue: SeverityIssue): Severity {
  // CRITICAL — immediate danger
  if (issue.dataLoss || issue.authBypass || issue.runtimeCrash || issue.hardcodedSecret) {
    return 'CRITICAL';
  }

  // HIGH — serious but not immediately catastrophic
  if (issue.unhandledEdgeCase || issue.performanceIssue || issue.validationMissing) {
    return 'HIGH';
  }

  // MEDIUM — logic errors or missing error handling
  if (issue.logicalError || issue.missingErrorHandling) {
    return 'MEDIUM';
  }

  // LOW — style-only issues
  if (issue.styleOnly) {
    return 'LOW';
  }

  // If we get here with no flags → INFO
  return 'INFO';
}
