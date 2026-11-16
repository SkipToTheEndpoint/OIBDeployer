// Helpers for the PolicyManifest.json "conflicts" property.
// github-api.js attaches policy.conflicts = [{ oibId, name, matchIds }] to each
// OIB policy (symmetric, previous-version OIBIDs included in matchIds).

const normaliseName = (name) => (name || '').replace(/\.json$/i, '').trim().toLowerCase();

const tenantPolicyMatchesConflict = (tenantPolicy, conflict) => {
  const tenantOibId = tenantPolicy?.oibId?.toUpperCase();
  if (tenantOibId && conflict.matchIds.includes(tenantOibId)) return true;
  // Name fallback for tenant policies that lost the OIBID from their description
  const tenantName = normaliseName(tenantPolicy?.displayName || tenantPolicy?.name);
  return !!tenantName && tenantName === normaliseName(conflict.name);
};

/**
 * Conflicts for a single policy against the tenant and/or a set of policies
 * selected for deployment.
 * Returns [{ oibId, name, tenantPolicy: object|null, selected: boolean }]
 * containing only conflicts that are actually present.
 */
export const getPolicyConflicts = (policy, { tenantPolicies = [], selectedPolicies = [] } = {}) => {
  if (!policy?.conflicts?.length) return [];
  const policyOibId = policy.oibId?.toUpperCase();

  return policy.conflicts
    .map(conflict => {
      const tenantPolicy = tenantPolicies.find(tp => tenantPolicyMatchesConflict(tp, conflict)) || null;
      const selected = selectedPolicies.some(sp => {
        const selectedOibId = sp.oibId?.toUpperCase();
        return selectedOibId && selectedOibId !== policyOibId && conflict.matchIds.includes(selectedOibId);
      });
      return { oibId: conflict.oibId, name: conflict.name, tenantPolicy, selected };
    })
    .filter(conflict => conflict.tenantPolicy || conflict.selected);
};

export const describeConflictSource = (conflict) => {
  if (conflict.tenantPolicy && conflict.selected) return 'deployed in tenant and selected for deployment';
  if (conflict.tenantPolicy) return 'deployed in tenant';
  return 'selected for deployment';
};

/**
 * Unique pairs of conflicting policies among those already deployed in the tenant.
 * `deployedPolicies` are OIB policies that have a tenant match.
 * Returns [{ policy, conflict }] with each unordered pair reported once.
 */
export const findDeployedConflictPairs = (deployedPolicies, tenantPolicies) => {
  const seen = new Set();
  const pairs = [];

  deployedPolicies.forEach(policy => {
    const policyOibId = policy.oibId?.toUpperCase();
    getPolicyConflicts(policy, { tenantPolicies }).forEach(conflict => {
      const key = [policyOibId, conflict.oibId].sort().join('|');
      if (seen.has(key)) return;
      seen.add(key);
      pairs.push({ policy, conflict });
    });
  });

  return pairs;
};

export const policyDisplayName = (policy) =>
  (policy?.displayName || policy?.name || '').replace(/\.json$/i, '');

/**
 * Unique pairs of conflicting policies within a selection (e.g. policies chosen
 * for deployment). Returns [{ policy, conflict }] with each pair reported once.
 */
export const findSelectedConflictPairs = (selectedPolicies) => {
  const seen = new Set();
  const pairs = [];

  selectedPolicies.forEach(policy => {
    const policyOibId = policy.oibId?.toUpperCase();
    getPolicyConflicts(policy, { selectedPolicies }).forEach(conflict => {
      const key = [policyOibId, conflict.oibId].sort().join('|');
      if (seen.has(key)) return;
      seen.add(key);
      pairs.push({ policy, conflict });
    });
  });

  return pairs;
};
