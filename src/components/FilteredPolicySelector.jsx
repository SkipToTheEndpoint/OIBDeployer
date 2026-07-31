import React, { useState, useEffect } from 'react';
import { Search, CheckCircle, HelpCircle, Package, Filter, ArrowLeft, Upload, Plus, BarChart3 } from 'lucide-react';

const FilteredPolicySelector = ({ 
  existingPolicies, 
  onPolicySelection, 
  availablePolicies,
  selectedPolicyTypes,
  selectedOSTypes,
  selectedVersion,
  tenantLicensing,
  usingDefenderAV,
  onBack,
  onDeploy,
  isLoading = false
}) => {
  const [selectedPolicies, setSelectedPolicies] = useState([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showGatedPolicies, setShowGatedPolicies] = useState(false);

  // Check if a policy from the OIB repo already exists in the tenant.
  // Pass 1: OIBID match (v3.8+ policies with a GUID in description).
  // Pass 2: name-based fallback for older policies or tenants that stripped the OIBID.
  const checkIfPolicyExists = (availablePolicy, existingPolicies) => {
    if (!existingPolicies || !Array.isArray(existingPolicies)) {
      return { exists: false, status: 'new' };
    }

    // Pass 1: OIBID
    const availableOibId = availablePolicy.oibId?.toUpperCase();
    if (availableOibId) {
      const matched = existingPolicies.find(e => e.oibId?.toUpperCase() === availableOibId);
      if (matched) return { exists: true, status: 'existing', matchedPolicy: matched };
    }

    // Pass 2: name fallback
    const baseName = (availablePolicy.name || '').replace('.json', '').toLowerCase();
    const matched = existingPolicies.find(e => {
      const existingName = (e.displayName || e.name || '').toLowerCase();
      return existingName === baseName ||
             existingName.includes(baseName) ||
             baseName.includes(existingName);
    });

    if (matched) return { exists: true, status: 'existing', matchedPolicy: matched };
    return { exists: false, status: 'new' };
  };

  // A policy is "gated" when it requires licensing the tenant said it doesn't have
  // (PolicyManifest.json skuRequirements/licenseRequirements) — hidden by default.
  const isGatedByLicensing = (policy) => {
    const gatedBySku = policy.skuRequirements === 'Enterprise' && tenantLicensing !== 'e3-e5-e7';
    const gatedByLicense = policy.licenseRequirements === 'MDE' && usingDefenderAV !== true;
    return gatedBySku || gatedByLicense;
  };

  // Map wizard policy type names to GitHub API policy type names
  const mapPolicyTypeNames = (wizardPolicyType) => {
    const mapping = {
      'compliance': 'CompliancePolicies',
      'endpoint-security': 'EndpointSecurity', 
      'settings-catalog': 'SettingsCatalog',
      'update-policies': 'UpdatePolicies',
      'device-configurations': 'DeviceConfigurations',
      'admin-templates': 'AdminTemplates',
      'configuration-policies': 'ConfigurationPolicies',
      'powershell-scripts': 'PowerShellScripts',
      'app-protection': 'AppProtectionPolicies',
      'byod-policies': 'BYODPolicies'
    };
    return mapping[wizardPolicyType] || wizardPolicyType;
  };

  // Process available policies with status
  const processedPolicies = React.useMemo(() => {
    const processed = {};
    
    if (!availablePolicies) {
      return processed;
    }

    // Process each OS type
    Object.entries(availablePolicies).forEach(([osType, osTypePolicies]) => {
      // Only process selected OS types
      if (!selectedOSTypes.includes(osType)) {
        return;
      }
      
      processed[osType] = {};
      
      // Process each policy type
      Object.entries(osTypePolicies).forEach(([policyType, policyList]) => {
        // Map the wizard policy type names to GitHub API names for comparison
        const mappedSelectedTypes = selectedPolicyTypes.map(mapPolicyTypeNames);
        
        // Only process selected policy types (after mapping)
        if (!mappedSelectedTypes.includes(policyType)) {
          return;
        }
        
        processed[osType][policyType] = policyList.map(policy => {
          const matchResult = checkIfPolicyExists(policy, existingPolicies);
          return {
            ...policy,
            status: matchResult.status,
            matchedPolicy: matchResult.matchedPolicy,
            gated: isGatedByLicensing(policy),
            selected: false,
            hasContent: false
          };
        });
      });
    });
    
    return processed;
  }, [availablePolicies, selectedPolicyTypes, selectedOSTypes, existingPolicies, tenantLicensing, usingDefenderAV]);

  // Get flattened list for filtering
  const getAllPolicies = () => {
    const allPolicies = [];
    
    Object.entries(processedPolicies).forEach(([osType, osTypePolicies]) => {
      Object.entries(osTypePolicies).forEach(([policyType, policyList]) => {
        policyList.forEach(policy => {
          allPolicies.push({
            ...policy,
            osType,
            policyType
          });
        });
      });
    });
    
    return allPolicies;
  };

  // Filter policies based on search and filters
  const getFilteredPolicies = () => {
    const allPolicies = getAllPolicies();
    
    return allPolicies.filter(policy => {
      // Search filter
      const searchMatch = !searchFilter || 
        policy.name.toLowerCase().includes(searchFilter.toLowerCase());
      
      // Type filter
      const typeMatch = typeFilter === 'all' || policy.policyType === typeFilter;
      
      // Status filter
      const statusMatch = statusFilter === 'all' || policy.status === statusFilter;
      
      // Licensing gate — hidden unless the user chose to reveal gated policies
      const gatedMatch = showGatedPolicies || !policy.gated;
      
      return searchMatch && typeMatch && statusMatch && gatedMatch;
    });
  };

  const handlePolicyToggle = (policy) => {
    const policyKey = `${policy.osType}-${policy.policyType}-${policy.name}`;
    
    const updatedPolicies = { ...processedPolicies };
    const targetPolicy = updatedPolicies[policy.osType][policy.policyType].find(p => p.name === policy.name);
    if (targetPolicy) {
      targetPolicy.selected = !targetPolicy.selected;
    }

    const updatedSelected = targetPolicy?.selected 
      ? [...selectedPolicies, { ...policy, selected: true }]
      : selectedPolicies.filter(p => `${p.osType}-${p.policyType}-${p.name}` !== policyKey);
    
    setSelectedPolicies(updatedSelected);
    onPolicySelection(updatedSelected);
  };

  const handleGlobalSelectAll = () => {
    const allFilteredPolicies = getFilteredPolicies();
    
    // Check if all filtered policies are selected
    const areAllSelected = allFilteredPolicies.length > 0 && 
      allFilteredPolicies.every(policy => {
        const policyKey = `${policy.osType}-${policy.policyType}-${policy.name}`;
        return selectedPolicies.some(p => `${p.osType}-${p.policyType}-${p.name}` === policyKey);
      });

    if (areAllSelected) {
      // Deselect all filtered policies
      const filteredKeys = allFilteredPolicies.map(p => `${p.osType}-${p.policyType}-${p.name}`);
      const updatedSelected = selectedPolicies.filter(p => 
        !filteredKeys.includes(`${p.osType}-${p.policyType}-${p.name}`)
      );
      
      // Update processedPolicies to reflect deselection
      const updatedPolicies = { ...processedPolicies };
      allFilteredPolicies.forEach(policy => {
        const targetPolicy = updatedPolicies[policy.osType][policy.policyType].find(p => p.name === policy.name);
        if (targetPolicy) {
          targetPolicy.selected = false;
        }
      });
      
      setSelectedPolicies(updatedSelected);
      onPolicySelection(updatedSelected);
    } else {
      // Select all filtered policies that aren't already selected
      const newSelections = allFilteredPolicies.filter(policy => {
        const policyKey = `${policy.osType}-${policy.policyType}-${policy.name}`;
        return !selectedPolicies.some(p => `${p.osType}-${p.policyType}-${p.name}` === policyKey);
      });
      
      // Update processedPolicies to reflect selection
      const updatedPolicies = { ...processedPolicies };
      allFilteredPolicies.forEach(policy => {
        const targetPolicy = updatedPolicies[policy.osType][policy.policyType].find(p => p.name === policy.name);
        if (targetPolicy) {
          targetPolicy.selected = true;
        }
      });
      
      const updatedSelected = [...selectedPolicies, ...newSelections.map(p => ({ ...p, selected: true }))];
      setSelectedPolicies(updatedSelected);
      onPolicySelection(updatedSelected);
    }
  };

  const filteredPolicies = getFilteredPolicies();
  const selectedCount = selectedPolicies.length;
  const newPoliciesCount = filteredPolicies.filter(p => p.status === 'new').length;
  const existingPoliciesCount = filteredPolicies.filter(p => p.status === 'existing').length;
  const gatedPoliciesCount = getAllPolicies().filter(p => p.gated).length;

  return (
    <div className="wizard-container comparison-dashboard">
      <div className="comparison-content">

      {/* Header */}
      <div className="wizard-header">
        <h2>New Policy Deployment</h2>
        <p>Review and select policies to deploy from the latest OpenIntuneBaseline</p>
        {selectedVersion && (
          <div className="version-info">
            <span className="version-badge">Deploying from: {selectedVersion}</span>
          </div>
        )}
        {gatedPoliciesCount > 0 && (
          <p className="validation-scope-note">
            <HelpCircle size={14} />
            {` ${gatedPoliciesCount} ${gatedPoliciesCount === 1 ? 'policy requires' : 'policies require'} licensing you indicated you don't have (Windows Enterprise or Defender for Endpoint) and ${gatedPoliciesCount === 1 ? 'is' : 'are'} hidden by default.`}
            {' '}
            <button type="button" className="btn-link select-all" onClick={() => setShowGatedPolicies(v => !v)}>
              {showGatedPolicies ? 'Hide them' : 'Show them anyway'}
            </button>
          </p>
        )}
      </div>

      {/* Filter Section */}
      <div className="filter-row">
        <div className="filter-group">
          <Search className="filter-icon" />
          <input
            type="text"
            placeholder="Search policies..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="filter-input"
          />
        </div>

        <div className="filter-group">
          <Filter className="filter-icon" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Types</option>
            {selectedPolicyTypes.map(type => (
              <option key={type} value={type}>
                {type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Status</option>
            <option value="new">New Policies</option>
            <option value="existing">Existing Policies</option>
          </select>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="comparison-stats">
        <div className="stat-card">
          <div className="stat-icon"><Package size={24} /></div>
          <div className="stat-content">
            <div className="stat-number">{filteredPolicies.length}</div>
            <div className="stat-label">Total Available</div>
          </div>
        </div>
        <div className="stat-card missing">
          <div className="stat-icon"><Plus size={24} /></div>
          <div className="stat-content">
            <div className="stat-number">{newPoliciesCount}</div>
            <div className="stat-label">New Policies</div>
          </div>
        </div>
        <div className="stat-card existing">
          <div className="stat-icon"><HelpCircle size={24} /></div>
          <div className="stat-content">
            <div className="stat-number">{existingPoliciesCount}</div>
            <div className="stat-label">Already in Tenant</div>
          </div>
        </div>
        <div className="stat-card deploy">
          <div className="stat-icon"><BarChart3 size={24} /></div>
          <div className="stat-content">
            <div className="stat-number">{selectedCount}</div>
            <div className="stat-label">Selected to Deploy</div>
          </div>
        </div>
      </div>

      {/* Global Controls */}
      {filteredPolicies.length > 0 && (
        <div className="global-controls">
          <button
            onClick={handleGlobalSelectAll}
            className="btn btn-outline btn-small global-select-all"
          >
            {(() => {
              const areAllSelected = filteredPolicies.length > 0 && 
                filteredPolicies.every(policy => {
                  const policyKey = `${policy.osType}-${policy.policyType}-${policy.name}`;
                  return selectedPolicies.some(p => `${p.osType}-${p.policyType}-${p.name}` === policyKey);
                });
              return areAllSelected ? 'Deselect All Policies' : 'Select All Policies';
            })()}
          </button>
          <span className="selected-count">
            {selectedCount} policies selected
          </span>
        </div>
      )}

      {/* Policies List - Grouped by OS and Policy Type */}
      <div className="policies-container">
        {Object.keys(processedPolicies).length === 0 ? (
          <div className="no-policies">
            <Package className="no-policies-icon" />
            <p>No policies found matching your filters</p>
          </div>
        ) : (
          <div className="policies-sections">
            {Object.entries(processedPolicies).map(([osType, osTypePolicies]) => {
              // Get filtered policies for this OS
              const getOSFilteredPolicies = () => {
                const allOSPolicies = [];
                Object.entries(osTypePolicies).forEach(([policyType, policyList]) => {
                  policyList.forEach(policy => {
                    const policyWithType = {
                      ...policy,
                      osType,
                      policyType
                    };
                    
                    // Apply filters
                    const searchMatch = !searchFilter || 
                      policy.name.toLowerCase().includes(searchFilter.toLowerCase());
                    const typeMatch = typeFilter === 'all' || policyType === mapPolicyTypeNames(typeFilter);
                    const statusMatch = statusFilter === 'all' || policy.status === statusFilter;
                    const gatedMatch = showGatedPolicies || !policy.gated;
                    
                    if (searchMatch && typeMatch && statusMatch && gatedMatch) {
                      allOSPolicies.push(policyWithType);
                    }
                  });
                });
                return allOSPolicies;
              };

              const osPolicies = getOSFilteredPolicies();
              
              if (osPolicies.length === 0) return null;

              // Group policies by policy type within this OS
              const policiesByType = {};
              osPolicies.forEach(policy => {
                if (!policiesByType[policy.policyType]) {
                  policiesByType[policy.policyType] = [];
                }
                policiesByType[policy.policyType].push(policy);
              });

              return (
                <div key={osType} className="os-policy-section">
                  <div className="os-section-header">
                    <h3 className="os-section-title">{osType.toUpperCase()}</h3>
                    <div className="os-section-stats">
                      <span className="os-stat-summary">
                        {osPolicies.length} policies, {osPolicies.filter(p => p.status === 'new').length} new
                      </span>
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
                          {policies.map((policy, index) => {
                            const isSelected = selectedPolicies.some(p => 
                              `${p.osType}-${p.policyType}-${p.name}` === `${policy.osType}-${policy.policyType}-${policy.name}`
                            );
                            
                            return (
                              <div 
                                key={`${policy.osType}-${policy.policyType}-${policy.name}-${index}`}
                                className={`policy-item ${isSelected ? 'selected' : ''} ${policy.status} ${policy.gated ? 'gated' : ''}`}
                                onClick={() => handlePolicyToggle(policy)}
                              >
                                <div className="policy-details">
                                  <h5 className="policy-name">{policy.name.replace('.json', '')}</h5>
                                  {(policy.skuRequirements || policy.licenseRequirements) && (
                                    <div className="policy-req-tags">
                                      {policy.skuRequirements === 'Enterprise' && (
                                        <span className="req-tag req-tag--enterprise" title="Requires Windows Enterprise SKU">Enterprise</span>
                                      )}
                                      {policy.licenseRequirements === 'MDE' && (
                                        <span className="req-tag req-tag--mde" title="Requires Microsoft Defender for Endpoint licence">MDE</span>
                                      )}
                                    </div>
                                  )}
                                </div>

                                <div className="policy-actions">
                                  {policy.status === 'existing' ? (
                                    <span
                                      className="policy-status-icon policy-status-icon--existing"
                                      title={policy.matchedPolicy ? `Already in tenant: ${policy.matchedPolicy.displayName}` : 'Already in tenant'}
                                    >
                                      <HelpCircle size={14} />
                                    </span>
                                  ) : (
                                    <span
                                      className="policy-status-icon policy-status-icon--new"
                                      title="New policy — not yet in tenant"
                                    >
                                      <Plus size={14} />
                                    </span>
                                  )}
                                  <div className={`selection-checkbox ${isSelected ? 'checked' : ''}`}>
                                    {isSelected && <CheckCircle size={16} />}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      </div>{/* end comparison-content */}

      {/* Sticky Navigation */}
      <div className="comparison-navigation-sticky">
        <div className="wizard-navigation">
          <button className="btn-secondary" onClick={onBack}>
            <ArrowLeft size={16} />
            Back
          </button>

          {selectedPolicies.length > 0 && (
            <button
              className="btn-primary"
              onClick={() => onDeploy(selectedPolicies)}
              disabled={isLoading}
            >
              Deploy Selected Policies ({selectedPolicies.length})
              <Upload size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FilteredPolicySelector;
