import React, { useState, useEffect } from 'react';
import { Search, CheckCircle, AlertCircle, Package, Filter, ArrowLeft, Upload } from 'lucide-react';

const FilteredPolicySelector = ({ 
  existingPolicies, 
  onPolicySelection, 
  availablePolicies,
  selectedPolicyTypes,
  selectedOSTypes,
  selectedVersion,
  onBack,
  onDeploy,
  isLoading = false
}) => {
  const [selectedPolicies, setSelectedPolicies] = useState([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Check if a policy exists in the tenant by name matching
  const checkIfPolicyExistsByName = (policyName, existingPolicies) => {
    if (!existingPolicies || !Array.isArray(existingPolicies)) {
      return { exists: false, status: 'new' };
    }

    const baseName = policyName.replace('.json', '');
    
    const foundPolicy = existingPolicies.find(existing => {
      const existingName = existing.displayName || existing.name || '';
      return existingName.toLowerCase().includes(baseName.toLowerCase()) ||
             baseName.toLowerCase().includes(existingName.toLowerCase());
    });

    if (foundPolicy) {
      return { 
        exists: true, 
        status: 'existing',
        matchedPolicy: foundPolicy
      };
    }

    return { exists: false, status: 'new' };
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
          const matchResult = checkIfPolicyExistsByName(policy.name, existingPolicies);
          
          return {
            ...policy,
            status: matchResult.status,
            matchedPolicy: matchResult.matchedPolicy,
            selected: false,
            hasContent: false
          };
        });
      });
    });
    
    return processed;
  }, [availablePolicies, selectedPolicyTypes, selectedOSTypes, existingPolicies]);

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
      
      return searchMatch && typeMatch && statusMatch;
    });
  };

  const handlePolicyToggle = (policy) => {
    console.warn('Policy toggle clicked:', policy);
    const policyKey = `${policy.osType}-${policy.policyType}-${policy.name}`;
    
    // Update the policy in processedPolicies
    const updatedPolicies = { ...processedPolicies };
    const targetPolicy = updatedPolicies[policy.osType][policy.policyType].find(p => p.name === policy.name);
    if (targetPolicy) {
      targetPolicy.selected = !targetPolicy.selected;
      console.warn('Policy selected state changed to:', targetPolicy.selected);
    }

    // Update selected policies list
    const updatedSelected = targetPolicy?.selected 
      ? [...selectedPolicies, { ...policy, selected: true }]
      : selectedPolicies.filter(p => `${p.osType}-${p.policyType}-${p.name}` !== policyKey);
    
    console.warn('Updated selected policies:', updatedSelected);
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

  // Add debugging
  console.warn('FilteredPolicySelector render:', {
    selectedPolicies: selectedCount,
    filteredPolicies: filteredPolicies.length,
    newPoliciesCount,
    existingPoliciesCount,
    availablePolicies: availablePolicies ? Object.keys(availablePolicies).length : 0,
    selectedPolicyTypes,
    selectedOSTypes,
    isLoading
  });

  return (
    <div className="filtered-policy-selector">
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

      {/* Summary Stats */}
      <div className="policies-summary">
        <div className="summary-stat">
          <span className="stat-label">Total Available:</span>
          <span className="stat-value">{filteredPolicies.length}</span>
        </div>
        <div className="summary-stat">
          <span className="stat-label">New Policies:</span>
          <span className="stat-value new">{newPoliciesCount}</span>
        </div>
        <div className="summary-stat">
          <span className="stat-label">Existing:</span>
          <span className="stat-value existing">{existingPoliciesCount}</span>
        </div>
        <div className="summary-stat">
          <span className="stat-label">Selected:</span>
          <span className="stat-value selected">{selectedCount}</span>
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
                    
                    if (searchMatch && typeMatch && statusMatch) {
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
                                className={`policy-item ${isSelected ? 'selected' : ''} ${policy.status}`}
                                onClick={() => handlePolicyToggle(policy)}
                              >
                                <div className="policy-details">
                                  <div className="policy-header">
                                    <h5 className="policy-name">{policy.name}</h5>
                                  </div>
                                  
                                  <div className="policy-status">
                                    {policy.status === 'existing' ? (
                                      <div className="status-badge status-existing">
                                        <CheckCircle className="status-icon" />
                                        Already Deployed
                                        {policy.matchedPolicy && (
                                          <div className="status-details">
                                            Deployed: {policy.matchedPolicy.displayName}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="status-badge status-new">
                                        <AlertCircle className="status-icon" />
                                        New Policy
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="policy-actions">
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
              onClick={() => {
                console.warn('Deploy button clicked with policies:', selectedPolicies);
                onDeploy(); // Call without arguments, like PolicySelector does
              }}
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
