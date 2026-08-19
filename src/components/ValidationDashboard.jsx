import React, { useState } from 'react';
import {
  ArrowLeft, ShieldCheck, ShieldAlert, AlertTriangle,
  ChevronDown, ChevronRight, Loader, RefreshCw, CheckCircle, Download
} from 'lucide-react';

/**
 * ValidationDashboard
 *
 * Shows per-setting compliance status for matched Settings Catalog policies.
 *
 * Props:
 *  - matchedPolicies   : array of policy entries from ComparisonDashboard
 *                        (status === 'current' | 'outdated' | 'newer')
 *  - duplicatePolicies : array of OIB policies with more than one ambiguous
 *                        tenant match (status === 'duplicate') — shown as a
 *                        warning, never auto-matched or validated
 *  - validationResults : Map<policyName, result> managed by App.jsx
 *  - onValidatePolicy  : (policy) => void
 *  - onValidateAll     : (policies) => void
 *  - isValidating      : boolean
 *  - validatingPolicy  : string | null  — name of currently validating policy
 *  - onBack            : () => void
 */
const ValidationDashboard = ({
  matchedPolicies = [],
  duplicatePolicies = [],
  validationResults,
  onValidatePolicy,
  onValidateAll,
  isValidating,
  validatingPolicy,
  onBack,
}) => {
  const [expanded, setExpanded] = useState(new Set());
  const [expandedSection, setExpandedSection] = useState({}); // policyName+section → bool

  // Settings Catalog (including Settings-Catalog-format Endpoint Security) and
  // Compliance policies are supported. Admin Templates / legacy intents / device
  // configuration etc. are out of scope for now.
  const supported   = matchedPolicies.filter(p =>
    p.policyType === 'SettingsCatalog' ||
    p.policyType === 'ConfigurationPolicies' ||
    p.policyType === 'CompliancePolicies' ||
    p.policyType === 'EndpointSecurity' ||
    p.type === 'configurationPolicy' ||
    p.type === 'compliance'
  );
  const unsupported = matchedPolicies.filter(p => !supported.includes(p));

  const validatedCount   = supported.filter(p => validationResults.has(p.name)).length;
  const compliantCount   = supported.filter(p => validationResults.get(p.name)?.status === 'compliant').length;
  const driftedCount     = supported.filter(p => validationResults.get(p.name)?.status === 'drifted').length;
  const errorCount       = supported.filter(p => validationResults.get(p.name)?.status === 'error').length;

  // Flatten every deviation (mismatch, missing, extra, or error) across all
  // validated policies into CSV-ready rows — compliant policies contribute nothing.
  const buildExportRows = () => {
    const rows = [];
    supported.forEach(policy => {
      const result = validationResults.get(policy.name);
      if (!result) return;

      const base = {
        policyName: policy.name.replace('.json', ''),
        osType: policy.osType || '',
        policyType: policy.policyType || policy.type || '',
        matchedPolicy: policy.existingPolicy?.displayName || policy.existingPolicy?.name || '',
      };

      if (result.status === 'error') {
        rows.push({ ...base, deviationType: 'Error', setting: '', oibValue: '', tenantValue: result.error || '' });
        return;
      }
      if (result.status !== 'drifted') return;

      (result.mismatches || []).forEach(m => {
        rows.push({
          ...base,
          deviationType: 'Value mismatch',
          setting: m.path ?? m.label ?? m.settingDefinitionId ?? '',
          oibValue: m.oibValue,
          tenantValue: m.tenantValue,
        });
      });
      (result.oibOnly || []).forEach(item => {
        rows.push({
          ...base,
          deviationType: 'Missing in tenant',
          setting: item.label ?? item.settingDefinitionId ?? '',
          oibValue: '(configured)',
          tenantValue: '(absent)',
        });
      });
      (result.tenantOnly || []).forEach(item => {
        rows.push({
          ...base,
          deviationType: 'Extra in tenant',
          setting: item.label ?? item.settingDefinitionId ?? '',
          oibValue: '(absent)',
          tenantValue: '(configured)',
        });
      });
    });
    return rows;
  };

  const exportRows = buildExportRows();

  const csvEscape = (value) => {
    const str = String(value ?? '');
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const handleExportCsv = () => {
    const headers = ['Policy Name', 'OS', 'Policy Type', 'Matched Tenant Policy', 'Deviation Type', 'Setting', 'OIB Value', 'Tenant Value'];
    const csvContent = [
      headers.join(','),
      ...exportRows.map(r => [
        r.policyName, r.osType, r.policyType, r.matchedPolicy, r.deviationType, r.setting, r.oibValue, r.tenantValue
      ].map(csvEscape).join(','))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `oib-validation-deviations-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const toggleExpand = (name) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const toggleSection = (key) => {
    setExpandedSection(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const renderStatusBadge = (result) => {
    if (!result) return null;
    if (result.status === 'compliant') {
      return <span className="status-badge current">Compliant</span>;
    }
    if (result.status === 'drifted') {
      return (
        <span className="status-badge outdated">
          Drift detected — {result.matched}/{result.totalOib} settings match
        </span>
      );
    }
    if (result.status === 'error') {
      return <span className="status-badge missing">Validation error</span>;
    }
    return null;
  };

  const renderMismatchTable = (items, colA, colB) => (
    <table className="validation-table">
      <thead>
        <tr>
          <th>Setting</th>
          <th>{colA}</th>
          <th>{colB}</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, i) => (
          <tr key={i}>
            <td className="validation-setting-id" title={item.settingDefinitionId ?? item.path}>
              {item.path ?? item.label ?? item.settingDefinitionId}
            </td>
            <td className="validation-value oib-value">
              {String(item.oibValue ?? item.label ?? '—')}
            </td>
            <td className="validation-value tenant-value">
              {String(item.tenantValue ?? item.label ?? '—')}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const renderSimpleTable = (items, label) => (
    <table className="validation-table">
      <thead>
        <tr><th>Setting</th></tr>
      </thead>
      <tbody>
        {items.map((item, i) => (
          <tr key={i}>
            <td className="validation-setting-id" title={item.settingDefinitionId}>
              {item.label ?? item.settingDefinitionId}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const renderPolicyResult = (policy, result) => {
    const isExpanded = expanded.has(policy.name);
    const isCurrentlyValidating = isValidating && validatingPolicy === policy.name;

    const mKey   = `${policy.name}-mismatches`;
    const oibKey = `${policy.name}-oibonly`;
    const tenKey = `${policy.name}-tenonly`;

    return (
      <div key={policy.name} className={`policy-comparison-item ${result ? result.status : ''}`}>
        <div className="policy-info">
          <div className="policy-name">{policy.name.replace('.json', '')}</div>
          {policy.existingPolicy && (
            <div className="matched-policy-name">
              <span className="matched-label">Matched policy:</span>
              <span className="matched-name">{policy.existingPolicy.displayName ?? policy.existingPolicy.name}</span>
            </div>
          )}
          <div className="policy-status">
            {isCurrentlyValidating
              ? <span className="status-badge"><Loader size={12} className="spinning" /> Validating…</span>
              : renderStatusBadge(result)
            }
            {result?.status === 'drifted' && (
              <span className="validation-score">
                {result.matched}/{result.totalOib} OIB settings matched
                {result.tenantOnly.length > 0 && `, ${result.tenantOnly.length} tenant-only`}
              </span>
            )}
          </div>
        </div>

        <div className="policy-actions">
          <button
            className="btn btn-outline btn-small"
            disabled={isValidating}
            onClick={() => onValidatePolicy(policy)}
          >
            {result ? 'Re-validate' : 'Validate'}
          </button>

          {result && result.status !== 'error' && (
            <button
              className="btn btn-ghost btn-small"
              onClick={() => toggleExpand(policy.name)}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              {isExpanded ? 'Hide' : 'Details'}
            </button>
          )}
        </div>

        {isExpanded && result && result.status !== 'error' && (
          <div className="validation-details">

            {result.mismatches.length > 0 && (
              <div className="validation-section">
                <button
                  className="validation-section-toggle"
                  onClick={() => toggleSection(mKey)}
                >
                  <ShieldAlert size={14} className="icon-drift" />
                  {`Value mismatches (${result.mismatches.length})`}
                  {expandedSection[mKey] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>
                {expandedSection[mKey] && renderMismatchTable(result.mismatches, 'OIB value', 'Tenant value')}
              </div>
            )}

            {result.oibOnly.length > 0 && (
              <div className="validation-section">
                <button
                  className="validation-section-toggle"
                  onClick={() => toggleSection(oibKey)}
                >
                  <AlertTriangle size={14} className="icon-oib-only" />
                  {`In OIB, absent in tenant (${result.oibOnly.length})`}
                  {expandedSection[oibKey] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>
                {expandedSection[oibKey] && renderSimpleTable(result.oibOnly, 'OIB-only setting')}
              </div>
            )}

            {result.tenantOnly.length > 0 && (
              <div className="validation-section">
                <button
                  className="validation-section-toggle"
                  onClick={() => toggleSection(tenKey)}
                >
                  <AlertTriangle size={14} className="icon-tenant-only" />
                  {`In tenant, not in OIB (${result.tenantOnly.length})`}
                  {expandedSection[tenKey] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>
                {expandedSection[tenKey] && renderSimpleTable(result.tenantOnly, 'Tenant-only setting')}
              </div>
            )}

            {result.mismatches.length === 0 && result.oibOnly.length === 0 && result.tenantOnly.length === 0 && (
              <div className="validation-compliant-msg">
                <CheckCircle size={14} className="icon-compliant" /> All settings match the OIB baseline.
              </div>
            )}

            {result.status === 'error' && (
              <div className="validation-error-msg">
                <AlertTriangle size={14} /> {result.error}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="wizard-container comparison-dashboard">
      <div className="comparison-content">

        {/* Header */}
        <div className="wizard-header">
          <h2>Settings Validation</h2>
          <p>Validate each matched policy's settings against the OIB baseline at a per-setting level.</p>
          {unsupported.length > 0 && (
            <p className="validation-scope-note">
              <AlertTriangle size={14} />
              {` ${unsupported.length} matched ${unsupported.length === 1 ? 'policy is' : 'policies are'} not Settings Catalog, Endpoint Security or Compliance type and are excluded from validation.`}
            </p>
          )}
          {duplicatePolicies.length > 0 && (
            <div className="duplicate-matches">
              <span className="matched-label">
                <AlertTriangle size={14} className="icon-drift" />
                {` ${duplicatePolicies.length} ${duplicatePolicies.length === 1 ? 'policy has' : 'policies have'} multiple ambiguous tenant matches and ${duplicatePolicies.length === 1 ? 'was' : 'were'} skipped - resolve the duplicates in Intune before validating:`}
              </span>
              <ul className="duplicate-matches-list">
                {duplicatePolicies.map(policy => (
                  <li key={policy.name}>
                    <span className="matched-name">{policy.name.replace('.json', '')}:</span>
                    {policy.matchedPolicies.map(match => (
                      <span key={match.id} className="duplicate-match-id">
                        {match.displayName || match.name} (Graph Policy ID: {match.id})
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Summary Stats */}
        {validatedCount > 0 && (
          <div className="comparison-stats">
            <div className="stat-card current">
              <div className="stat-icon"><ShieldCheck size={24} /></div>
              <div className="stat-content">
                <div className="stat-number">{compliantCount}</div>
                <div className="stat-label">Compliant</div>
              </div>
            </div>
            <div className="stat-card outdated">
              <div className="stat-icon"><ShieldAlert size={24} /></div>
              <div className="stat-content">
                <div className="stat-number">{driftedCount}</div>
                <div className="stat-label">Drift Detected</div>
              </div>
            </div>
            <div className="stat-card missing">
              <div className="stat-icon"><AlertTriangle size={24} /></div>
              <div className="stat-content">
                <div className="stat-number">{errorCount}</div>
                <div className="stat-label">Errors</div>
              </div>
            </div>
            <div className="stat-card newer">
              <div className="stat-icon"><RefreshCw size={24} /></div>
              <div className="stat-content">
                <div className="stat-number">{validatedCount}/{supported.length}</div>
                <div className="stat-label">Validated</div>
              </div>
            </div>
          </div>
        )}

        {/* Policy List - Grouped by OS and Policy Type */}
        <div className="policy-comparison-list">
          {supported.length === 0 ? (
            <div className="empty-state">
              <AlertTriangle size={32} />
              <p>No matched Settings Catalog policies found. Run the comparison first.</p>
            </div>
          ) : (
            (() => {
              // Group by OS, then by policy type (Compliance, Settings Catalog, etc.)
              const byOS = {};
              supported.forEach(policy => {
                const osKey = policy.osType || 'Other';
                if (!byOS[osKey]) byOS[osKey] = [];
                byOS[osKey].push(policy);
              });

              return Object.entries(byOS).map(([osType, osPolicies]) => {
                const policiesByType = {};
                osPolicies.forEach(policy => {
                  const key = policy.policyType || 'Other';
                  if (!policiesByType[key]) policiesByType[key] = [];
                  policiesByType[key].push(policy);
                });

                return (
                  <div key={osType} className="os-policy-section">
                    <div className="os-section-header">
                      <h3 className="os-section-title">{osType.toUpperCase()}</h3>
                      <div className="os-section-stats">
                        <span className="os-stat-summary">{osPolicies.length} policies</span>
                      </div>
                    </div>

                    <div className="os-policies">
                      {Object.entries(policiesByType).map(([policyType, policies]) => (
                        <div key={`${osType}-${policyType}`} className="policy-type-section">
                          <div className="policy-type-header">
                            <h4 className="policy-type-title">
                              {policyType.replace(/([A-Z])/g, ' $1').trim()}
                            </h4>
                            <span className="policy-type-count">
                              {policies.length} policies
                            </span>
                          </div>

                          <div className="policy-type-policies">
                            {policies.map(policy =>
                              renderPolicyResult(policy, validationResults.get(policy.name))
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              });
            })()
          )}
        </div>

      </div>

      {/* Sticky Navigation */}
      <div className="comparison-navigation-sticky">
        <div className="wizard-navigation">
          <button className="btn-secondary" onClick={onBack}>
            <ArrowLeft size={16} />
            Back
          </button>

          {supported.length > 0 && (
            <button
              className="btn-primary"
              disabled={isValidating}
              onClick={() => onValidateAll(supported)}
            >
              {isValidating
                ? <><Loader size={14} className="spinning" /> Validating…</>
                : `Validate All (${supported.length})`
              }
            </button>
          )}

          {exportRows.length > 0 && (
            <button className="btn-secondary" onClick={handleExportCsv}>
              <Download size={16} />
              {`Export CSV (${exportRows.length})`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ValidationDashboard;
