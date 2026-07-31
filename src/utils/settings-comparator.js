/**
 * Settings Comparator utility for OIB per-setting validation.
 *
 * Compares Settings Catalog policy settings between an OIB JSON export
 * and the live tenant values returned by Graph API.
 *
 * Scope: configurationPolicy (Settings Catalog) only.
 */

// Fields that exist only as Graph API response metadata or OIB export
// artefacts and must not be included in comparison.
const ANNOTATION_PREFIXES = ['@odata.', 'settingDefinitions@odata.'];
const IGNORED_KEYS = new Set([
  'id',                              // numeric array index on each setting row
  'settingInstanceTemplateReference',
  'settingValueTemplateReference',
  'roleScopeTagIds',
  'assignments',
  'createdDateTime',
  'lastModifiedDateTime',
  'creationSource',
  'version',
  'isAssigned',
  'supportsScopeTags',
]);

/** Returns true when a key should be excluded from comparison. */
function isAnnotationKey(key) {
  if (IGNORED_KEYS.has(key)) return true;
  return ANNOTATION_PREFIXES.some(prefix => key.startsWith(prefix));
}

/**
 * Strip all annotation / metadata keys from an object (shallow).
 * Returns a new object.
 */
function stripAnnotations(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!isAnnotationKey(k)) {
      result[k] = v;
    }
  }
  return result;
}

/**
 * Build a Map<settingDefinitionId, settingInstance> from a settings array.
 * Accepts either the raw Graph array (each element has a `settingInstance`
 * property) or a pre-extracted array of settingInstance objects.
 */
function indexByDefinitionId(settings) {
  const map = new Map();
  if (!Array.isArray(settings)) return map;

  for (const item of settings) {
    // Handle both:
    //   { id, settingInstance: { settingDefinitionId, ... } }  (Graph / OIB export format)
    //   { settingDefinitionId, ... }                           (bare settingInstance)
    const instance = item.settingInstance ?? item;
    const defId = instance?.settingDefinitionId;
    if (defId) {
      map.set(defId, instance);
    }
  }
  return map;
}

// ── Value extractors ─────────────────────────────────────────────────────────

function getChoiceValue(instance) {
  return instance?.choiceSettingValue?.value ?? null;
}

function getSimpleValue(instance) {
  return instance?.simpleSettingValue?.value ?? null;
}

function getChoiceChildren(instance) {
  return instance?.choiceSettingValue?.children ?? [];
}

function getGroupCollectionValue(instance) {
  return instance?.groupSettingCollectionValue ?? [];
}

function getSimpleCollectionValue(instance) {
  return instance?.simpleSettingCollectionValue ?? [];
}

// ── Human-readable label ─────────────────────────────────────────────────────

/**
 * Return a short human-readable label for a settingDefinitionId.
 * Takes the last underscore-delimited segment, converts to Title Case.
 */
export function labelForDefinitionId(defId) {
  if (!defId) return defId;
  const parts = defId.split('_');
  const last = parts[parts.length - 1];
  return last.replace(/([a-z])([A-Z])/g, '$1 $2')
             .replace(/^./, c => c.toUpperCase());
}

// ── Recursive instance comparison ────────────────────────────────────────────

/**
 * Compare two settingInstance objects of the same settingDefinitionId.
 * Returns an array of { path, oibValue, tenantValue } mismatch descriptors.
 */
function compareInstances(oibInst, tenantInst, path) {
  const mismatches = [];
  if (!oibInst || !tenantInst) return mismatches;

  const oibType  = oibInst['@odata.type'] ?? '';
  const tenantType = tenantInst['@odata.type'] ?? '';

  // Different setting types at same definition ID → fundamental mismatch
  if (oibType && tenantType && oibType !== tenantType) {
    mismatches.push({ path, oibValue: oibType, tenantValue: tenantType });
    return mismatches;
  }

  const type = oibType || tenantType;

  if (type.includes('ChoiceSetting')) {
    const oibVal    = getChoiceValue(oibInst);
    const tenantVal = getChoiceValue(tenantInst);
    if (oibVal !== tenantVal) {
      mismatches.push({ path, oibValue: oibVal, tenantValue: tenantVal });
    }

    // Recurse into children
    const oibChildren    = indexByDefinitionId(getChoiceChildren(oibInst));
    const tenantChildren = indexByDefinitionId(getChoiceChildren(tenantInst));

    for (const [childDefId, oibChild] of oibChildren) {
      const tenantChild = tenantChildren.get(childDefId);
      const childPath   = `${path} > ${labelForDefinitionId(childDefId)}`;
      if (!tenantChild) {
        mismatches.push({ path: childPath, oibValue: getChoiceValue(oibChild) ?? '(set)', tenantValue: '(absent)' });
      } else {
        mismatches.push(...compareInstances(oibChild, tenantChild, childPath));
      }
    }

    for (const [childDefId, tenantChild] of tenantChildren) {
      if (!oibChildren.has(childDefId)) {
        const childPath = `${path} > ${labelForDefinitionId(childDefId)}`;
        mismatches.push({ path: childPath, oibValue: '(absent)', tenantValue: getChoiceValue(tenantChild) ?? '(set)' });
      }
    }

  } else if (type.includes('SimpleSetting') && !type.includes('Collection')) {
    const oibVal    = getSimpleValue(oibInst);
    const tenantVal = getSimpleValue(tenantInst);
    if (String(oibVal) !== String(tenantVal)) {
      mismatches.push({ path, oibValue: oibVal, tenantValue: tenantVal });
    }

  } else if (type.includes('GroupSettingCollection')) {
    const oibItems    = getGroupCollectionValue(oibInst);
    const tenantItems = getGroupCollectionValue(tenantInst);

    const maxLen = Math.max(oibItems.length, tenantItems.length);
    for (let i = 0; i < maxLen; i++) {
      const oibGroup    = oibItems[i];
      const tenantGroup = tenantItems[i];
      const groupPath   = `${path}[${i}]`;

      if (!oibGroup) {
        mismatches.push({ path: groupPath, oibValue: '(absent)', tenantValue: '(present)' });
      } else if (!tenantGroup) {
        mismatches.push({ path: groupPath, oibValue: '(present)', tenantValue: '(absent)' });
      } else {
        // Each group item has its own children array
        const oibGroupChildren    = indexByDefinitionId(oibGroup.children ?? []);
        const tenantGroupChildren = indexByDefinitionId(tenantGroup.children ?? []);

        for (const [childDefId, oibChild] of oibGroupChildren) {
          const tenantChild = tenantGroupChildren.get(childDefId);
          const childPath   = `${groupPath} > ${labelForDefinitionId(childDefId)}`;
          if (!tenantChild) {
            mismatches.push({ path: childPath, oibValue: '(set)', tenantValue: '(absent)' });
          } else {
            mismatches.push(...compareInstances(oibChild, tenantChild, childPath));
          }
        }
        for (const [childDefId, tenantChild] of tenantGroupChildren) {
          if (!oibGroupChildren.has(childDefId)) {
            const childPath = `${groupPath} > ${labelForDefinitionId(childDefId)}`;
            mismatches.push({ path: childPath, oibValue: '(absent)', tenantValue: '(set)' });
          }
        }
      }
    }

  } else if (type.includes('SimpleSettingCollection')) {
    const oibItems    = getSimpleCollectionValue(oibInst).map(s => s?.value).sort();
    const tenantItems = getSimpleCollectionValue(tenantInst).map(s => s?.value).sort();
    if (JSON.stringify(oibItems) !== JSON.stringify(tenantItems)) {
      mismatches.push({ path, oibValue: oibItems.join(', '), tenantValue: tenantItems.join(', ') });
    }
  }

  return mismatches;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Compare OIB settings against tenant settings.
 *
 * @param {Array} oibSettings    - the `settings` array from the OIB JSON export
 * @param {Array} tenantSettings - the array returned by Graph
 *                                 /configurationPolicies/{id}/settings
 * @returns {{
 *   totalOib:    number,
 *   totalTenant: number,
 *   matched:     number,
 *   mismatches:  Array<{ settingDefinitionId, label, path, oibValue, tenantValue }>,
 *   oibOnly:     Array<{ settingDefinitionId, label }>,
 *   tenantOnly:  Array<{ settingDefinitionId, label }>,
 *   compliant:   boolean
 * }}
 */
export function compareSettings(oibSettings, tenantSettings) {
  const oibMap    = indexByDefinitionId(oibSettings);
  const tenantMap = indexByDefinitionId(tenantSettings);

  const mismatches = [];
  const oibOnly    = [];
  const tenantOnly = [];
  let   matched    = 0;

  // Check every OIB setting against the tenant
  for (const [defId, oibInst] of oibMap) {
    const label = labelForDefinitionId(defId);
    const tenantInst = tenantMap.get(defId);

    if (!tenantInst) {
      oibOnly.push({ settingDefinitionId: defId, label });
      continue;
    }

    const instanceMismatches = compareInstances(oibInst, tenantInst, label);
    if (instanceMismatches.length === 0) {
      matched++;
    } else {
      mismatches.push(
        ...instanceMismatches.map(m => ({ settingDefinitionId: defId, label, ...m }))
      );
    }
  }

  // Flag tenant settings not in OIB
  for (const [defId] of tenantMap) {
    if (!oibMap.has(defId)) {
      tenantOnly.push({ settingDefinitionId: defId, label: labelForDefinitionId(defId) });
    }
  }

  return {
    totalOib:    oibMap.size,
    totalTenant: tenantMap.size,
    matched,
    mismatches,
    oibOnly,
    tenantOnly,
    compliant: mismatches.length === 0 && oibOnly.length === 0 && tenantOnly.length === 0,
  };
}

// ── Compliance policy comparison (flat property bag) ─────────────────────────
//
// Compliance policies (`deviceCompliancePolicies`) are NOT Settings Catalog —
// there's no `settings` array. Each configurable item is a top-level scalar
// or array property on the policy object itself (e.g. `passwordRequired`,
// `bitLockerEnabled`, `validOperatingSystemBuildRanges`). Comparison is a
// flat key-by-key diff instead of a recursive settingInstance walk.

// Fields that are Graph metadata / read-only / not a configurable "setting".
const COMPLIANCE_IGNORED_KEYS = new Set([
  'id', 'displayName', 'description', 'version',
  'createdDateTime', 'lastModifiedDateTime', 'creationSource',
  'roleScopeTagIds', 'assignments', 'scheduledActionsForRule',
  'deviceStatusOverview', 'userStatusOverview', 'deviceSettingStateSummaries',
  'deviceStatuses', 'userStatuses', 'deviceCompliancePolicyScript',
]);

function isComplianceAnnotationKey(key) {
  if (COMPLIANCE_IGNORED_KEYS.has(key)) return true;
  if (key.startsWith('@odata.')) return true;
  if (key.endsWith('@odata.type')) return true;
  if (key.endsWith('@odata.context') || key.endsWith('@odata.associationLink') || key.endsWith('@odata.navigationLink')) return true;
  // OData bound-action/function annotations (e.g. "#microsoft.graph.assign",
  // "#microsoft.graph.scheduleActionsForRules") are metadata describing
  // available Graph actions on the exported entity, not policy settings.
  // They're present in raw IntuneManagement/Graph exports but never returned
  // by a GET on the live policy, so they must be excluded from comparison.
  if (key.startsWith('#')) return true;
  return false;
}

/** Turn a camelCase property name into a human-readable label. */
function labelForPropertyName(name) {
  if (!name) return name;
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, c => c.toUpperCase());
}

function valuesEqual(a, b) {
  // Treat null/undefined as equivalent "not configured" states.
  if ((a === null || a === undefined) && (b === null || b === undefined)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return a === b;
}

/**
 * Compare a compliance policy from OIB against the live tenant policy.
 *
 * @param {object} oibPolicy    - full compliance policy object from OIB JSON
 * @param {object} tenantPolicy - full compliance policy object from Graph
 *                                 (GET /deviceManagement/deviceCompliancePolicies/{id})
 * @returns same shape as compareSettings(): { totalOib, totalTenant, matched,
 *          mismatches, oibOnly, tenantOnly, compliant }
 */
export function compareCompliancePolicy(oibPolicy, tenantPolicy) {
  const oib    = oibPolicy || {};
  const tenant = tenantPolicy || {};

  const oibKeys    = Object.keys(oib).filter(k => !isComplianceAnnotationKey(k));
  const tenantKeys = Object.keys(tenant).filter(k => !isComplianceAnnotationKey(k));
  const allKeys    = new Set([...oibKeys, ...tenantKeys]);

  const mismatches = [];
  const oibOnly     = [];
  const tenantOnly  = [];
  let   matched     = 0;

  for (const key of allKeys) {
    const inOib    = Object.prototype.hasOwnProperty.call(oib, key);
    const inTenant = Object.prototype.hasOwnProperty.call(tenant, key);
    const label    = labelForPropertyName(key);

    if (inOib && !inTenant) {
      oibOnly.push({ settingDefinitionId: key, label });
      continue;
    }
    if (!inOib && inTenant) {
      tenantOnly.push({ settingDefinitionId: key, label });
      continue;
    }

    if (valuesEqual(oib[key], tenant[key])) {
      matched++;
    } else {
      mismatches.push({
        settingDefinitionId: key,
        label,
        path: label,
        oibValue: oib[key],
        tenantValue: tenant[key],
      });
    }
  }

  return {
    totalOib:    oibKeys.length,
    totalTenant: tenantKeys.length,
    matched,
    mismatches,
    oibOnly,
    tenantOnly,
    compliant: mismatches.length === 0 && oibOnly.length === 0 && tenantOnly.length === 0,
  };
}
