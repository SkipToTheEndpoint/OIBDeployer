import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { describeConflictSource, policyDisplayName } from '../utils/conflicts';

// Per-policy notice listing the conflicting policies that are present.
// `conflicts` comes from getPolicyConflicts().
export const ConflictNotice = ({ conflicts }) => {
  if (!conflicts?.length) return null;
  return (
    <div className="conflict-notice" role="alert">
      <AlertTriangle size={14} />
      <span>Conflicts with {conflicts.length === 1 ? 'another OIB policy' : 'other OIB policies'}:</span>
      {conflicts.map(conflict => (
        <span key={conflict.oibId} className="conflict-notice-item">
          {policyDisplayName(conflict)}{' '}
          <span className="conflict-notice-source">({describeConflictSource(conflict)})</span>
        </span>
      ))}
    </div>
  );
};

// Summary notice for conflict pairs from findDeployedConflictPairs() /
// findSelectedConflictPairs(). `message` describes where the pairs were found.
export const ConflictPairsNotice = ({ pairs, message = 'Conflicting OIB policies are deployed in this tenant - review which should remain:' }) => {
  if (!pairs?.length) return null;
  return (
    <div className="conflict-notice" role="alert">
      <AlertTriangle size={14} />
      <span>{message}</span>
      {pairs.map(({ policy, conflict }) => (
        <span key={`${policy.oibId}-${conflict.oibId}`} className="conflict-notice-item">
          {policyDisplayName(policy)} ↔ {policyDisplayName(conflict.tenantPolicy || conflict)}
        </span>
      ))}
    </div>
  );
};

export const ConflictTag = () => (
  <span className="policy-conflict-tag" title="Conflicts with another OIB policy">
    <AlertTriangle size={11} /> Conflict
  </span>
);
