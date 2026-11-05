import React, { useState, useEffect } from 'react';
import { Download, Filter, Search, CheckCircle, AlertCircle, Package, Upload, Loader } from 'lucide-react';
import githubAPI from '../utils/github-api';
import graphAPI from '../utils/graph-api';

const PolicySelector = ({ existingPolicies, onPolicySelection, onDeploy, isLoading, tenantId, tenantInfo }) => {
  const [availableVersions, setAvailableVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState('');
  const [selectedOS, setSelectedOS] = useState('');
  const [availablePolicies, setAvailablePolicies] = useState({});
  const [selectedPolicies, setSelectedPolicies] = useState([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loadingPolicies, setLoadingPolicies] = useState(false);
  const [loadingVersions, setLoadingVersions] = useState(false);

  useEffect(() => {
    loadVersions();
  }, []);

  // Check if a policy exists in the tenant by name matching with version awareness
  const checkIfPolicyExistsByName = (policyName, existingPolicies) => {
    if (!existingPolicies || !Array.isArray(existingPolicies)) {
      return { exists: false, status: 'new' };
    }

    // Create variations of the policy name to check against
    // Keep version suffixes and OS prefixes as they're critical for identification
    const baseName = policyName.replace('.json', ''); // Remove .json extension
    
    // Extract version from the policy name
    const extractVersion = (name) => {
      const versionMatch = name.match(/v(\d+(?:\.\d+)*)/i);
      return versionMatch ? versionMatch[1] : null;
    };

    // Extract base name without version for comparison
    const extractBaseName = (name) => {
      return name.replace(/\s*-\s*v\d+(?:\.\d+)*\s*$/i, '').trim();
    };

    const policyVersion = extractVersion(baseName);
    const policyBaseName = extractBaseName(baseName);
    
    const namesToCheck = [
      baseName, // Original name from filename (most important)
      baseName.replace(/[-_]/g, ' '), // Replace dashes/underscores with spaces
      baseName.replace(/\s+/g, ' ').trim(), // Normalize whitespace
      
      // Handle different organization prefixes (someone might change "OIB" to their own)
      // Extract the core policy name while preserving OS and version
      baseName.replace(/^(Win|Mac)\s*-\s*[A-Za-z0-9]+\s*-\s*/, '$1 - '), // Replace custom prefix but keep OS
      
      // Handle cases where the prefix structure might be slightly different
      baseName.replace(/^(Win|Mac)\s*[-_]\s*[A-Za-z0-9]+\s*[-_]\s*/, '$1 - '), // Different separators
    ];

    // Remove duplicates and empty strings
    const uniqueNames = [...new Set(namesToCheck.filter(name => name && name.trim()))];

    console.debug(`Checking policy "${baseName}" (version: ${policyVersion}) against ${existingPolicies.length} existing policies`);
    console.debug(`Name variations to check (preserving OS/version):`, uniqueNames);

    let bestMatch = { exists: false, status: 'new', matchedPolicy: null };

    // Check against existing policies display names
    existingPolicies.forEach(existing => {
      const existingName = existing.displayName;
      if (!existingName) return;
      
      // Try exact matches first (most reliable)
      const exactMatch = uniqueNames.some(nameToCheck => 
        nameToCheck.toLowerCase() === existingName.toLowerCase()
      );
      
      if (exactMatch) {
        console.log(`Exact match found: "${baseName}" matches existing "${existingName}"`);
        bestMatch = { exists: true, status: 'existing', matchedPolicy: existing };
        return;
      }
      
      // Check for version-aware matches (same policy, different version)
      if (policyVersion) {
        const existingVersion = extractVersion(existingName);
        const existingBaseName = extractBaseName(existingName);
        
        // Compare base names without versions
        const baseNameMatches = uniqueNames.some(nameToCheck => {
          const nameBaseWithoutVersion = extractBaseName(nameToCheck);
          return nameBaseWithoutVersion.toLowerCase() === existingBaseName.toLowerCase();
        });
        
        if (baseNameMatches && existingVersion && existingVersion !== policyVersion) {
          // Same policy, different version
          const compareVersions = (v1, v2) => {
            const parts1 = v1.split('.').map(Number);
            const parts2 = v2.split('.').map(Number);
            
            for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
              const part1 = parts1[i] || 0;
              const part2 = parts2[i] || 0;
              
              if (part1 > part2) return 1;
              if (part1 < part2) return -1;
            }
            return 0;
          };
          
          const versionComparison = compareVersions(policyVersion, existingVersion);
          
          if (versionComparison > 0) {
            // Policy to deploy is newer
            console.log(`Newer version found: "${baseName}" (v${policyVersion}) vs existing "${existingName}" (v${existingVersion})`);
            if (!bestMatch.exists || bestMatch.status === 'older-version-exists') {
              bestMatch = { exists: true, status: 'older-version-exists', matchedPolicy: existing };
            }
          } else if (versionComparison < 0) {
            // Policy to deploy is older
            console.log(`Older version found: "${baseName}" (v${policyVersion}) vs existing "${existingName}" (v${existingVersion})`);
            if (!bestMatch.exists || bestMatch.status !== 'existing') {
              bestMatch = { exists: true, status: 'newer-version-exists', matchedPolicy: existing };
            }
          }
          return;
        }
      }
      
      // For partial matches, be more careful to preserve important identifiers
      const partialMatch = uniqueNames.some(nameToCheck => {
        const nameToCheckLower = nameToCheck.toLowerCase();
        const existingNameLower = existingName.toLowerCase();
        
        // Skip very short names to avoid false positives
        if (nameToCheckLower.length < 6 || existingNameLower.length < 6) return false;
        
        // Extract key components for more accurate matching
        const extractKeyComponents = (name) => {
          // Look for OS prefix (Win/Mac)
          const osMatch = name.match(/^(win|mac)/i);
          // Look for version suffix (v1.0, v2.1, etc.)
          const versionMatch = name.match(/v\d+(\.\d+)*\s*$/i);
          // Get the middle part (policy description)
          const middle = name.replace(/^(win|mac)\s*[-_]\s*/i, '').replace(/\s*[-_]\s*v\d+(\.\d+)*\s*$/i, '');
          
          return {
            os: osMatch ? osMatch[1].toLowerCase() : null,
            version: versionMatch ? versionMatch[0].toLowerCase() : null,
            middle: middle.toLowerCase().trim()
          };
        };
        
        const nameComponents = extractKeyComponents(nameToCheckLower);
        const existingComponents = extractKeyComponents(existingNameLower);
        
        // If both have OS prefixes, they must match
        if (nameComponents.os && existingComponents.os && nameComponents.os !== existingComponents.os) {
          return false;
        }
        
        // If both have versions, they should match (or be very similar)
        if (nameComponents.version && existingComponents.version && nameComponents.version !== existingComponents.version) {
          return false;
        }
        
        // Check if the core policy description matches (with some flexibility for organizational prefixes)
        const middleMatch = nameComponents.middle.includes(existingComponents.middle) || 
                           existingComponents.middle.includes(nameComponents.middle) ||
                           // Allow for different organizational prefixes in the middle
                           nameComponents.middle.replace(/^[a-z0-9]+\s*[-_]\s*/i, '').includes(existingComponents.middle.replace(/^[a-z0-9]+\s*[-_]\s*/i, ''));
        
        return middleMatch;
      });
      
      if (partialMatch && !bestMatch.exists) {
        console.log(`Partial match found: "${baseName}" matches existing "${existingName}"`);
        bestMatch = { exists: true, status: 'existing', matchedPolicy: existing };
      }
    });

    return bestMatch;
  };

  useEffect(() => {
    // Only load policies when both version and OS are selected AND user has requested it
    // Don't auto-load policies to prevent excessive GitHub API calls
    if (selectedVersion && selectedOS && availablePolicies && Object.keys(availablePolicies).length > 0) {
      // Only reload if we already have policies loaded (user initiated reload)
      return;
    }
  }, [selectedVersion, selectedOS, availablePolicies]);

  useEffect(() => {
    onPolicySelection(selectedPolicies);
    
    // Only log when there are actual policies selected and it's a meaningful change
    if (tenantId && selectedPolicies.length > 0) {
      console.info(`Policy selection updated for tenant ${tenantId}: ${selectedPolicies.length} policies selected`);
    }
  }, [selectedPolicies, onPolicySelection, tenantId]);

  // Update policy status when existing policies change
  useEffect(() => {
    if (Object.keys(availablePolicies).length > 0 && existingPolicies.length > 0) {
      const updatedPolicies = { ...availablePolicies };
      
      // Re-check all policies against the updated existing policies list
      Object.entries(updatedPolicies).forEach(([policyType, policyList]) => {
        policyList.forEach(policy => {
          const matchResult = checkIfPolicyExistsByName(policy.name, existingPolicies);
          policy.status = matchResult.status;
          policy.matchedPolicy = matchResult.matchedPolicy;
        });
      });
      
      setAvailablePolicies(updatedPolicies);
    }
  }, [existingPolicies]);

  const loadVersions = async () => {
    try {
      setLoadingVersions(true);
      const versions = await githubAPI.getReleases();
      setAvailableVersions(versions);
      
      // Don't automatically select the first version to prevent unwanted API calls
      // Let user choose manually
      if (versions.length > 0) {
        console.log(`Found ${versions.length} versions, please select one to continue`);
      }
    } catch (error) {
      console.error('Failed to load versions:', error);
    } finally {
      setLoadingVersions(false);
    }
  };

  const loadPolicies = async () => {
    try {
      setLoadingPolicies(true);
      const policies = await githubAPI.getPoliciesForOS(selectedOS, selectedVersion);
      
      // Check for existing policies by name matching (without downloading content)
      const policiesWithStatus = {};
      
      for (const [policyType, policyList] of Object.entries(policies)) {
        policiesWithStatus[policyType] = policyList.map(policy => {
          // Check if policy is already deployed by comparing names
          const matchResult = checkIfPolicyExistsByName(policy.name, existingPolicies);
          
          return {
            ...policy,
            status: matchResult.status,
            matchedPolicy: matchResult.matchedPolicy,
            selected: false,
            hasContent: false // Flag to indicate content hasn't been loaded yet
          };
        });
      }
      
      setAvailablePolicies(policiesWithStatus);
    } catch (error) {
      console.error('Failed to load policies:', error);
    } finally {
      setLoadingPolicies(false);
    }
  };

  const handlePolicyToggle = (policyType, policyIndex) => {
    const updatedPolicies = { ...availablePolicies };
    const policy = updatedPolicies[policyType][policyIndex];
    policy.selected = !policy.selected;
    
    setAvailablePolicies(updatedPolicies);
    
    // Update selected policies list
    const allSelected = [];
    Object.values(updatedPolicies).forEach(typeGroup => {
      typeGroup.forEach(policy => {
        if (policy.selected) {
          allSelected.push(policy);
        }
      });
    });
    
    setSelectedPolicies(allSelected);
  };

  const handleSelectAll = (policyType) => {
    const updatedPolicies = { ...availablePolicies };
    const typeGroup = updatedPolicies[policyType];
    const filteredPolicies = getFilteredPolicies(typeGroup);
    const areAllSelected = filteredPolicies.every(policy => policy.selected);
    
    typeGroup.forEach(policy => {
      if (filteredPolicies.includes(policy)) {
        policy.selected = !areAllSelected;
      }
    });
    
    setAvailablePolicies(updatedPolicies);
    
    // Update selected policies list
    const newSelectedPolicies = [];
    Object.values(updatedPolicies).forEach(typeGroup => {
      typeGroup.forEach(policy => {
        if (policy.selected) {
          newSelectedPolicies.push(policy);
        }
      });
    });
    
    setSelectedPolicies(newSelectedPolicies);
  };

  const handleGlobalSelectAll = () => {
    const updatedPolicies = { ...availablePolicies };
    
    // Get all currently filtered policies across all types
    const allFilteredPolicies = [];
    Object.entries(updatedPolicies).forEach(([policyType, policies]) => {
      const filteredPolicies = getFilteredPolicies(policies);
      allFilteredPolicies.push(...filteredPolicies);
    });
    
    // Check if all filtered policies are selected
    const areAllSelected = allFilteredPolicies.every(policy => policy.selected);
    
    // Toggle selection for all filtered policies
    Object.entries(updatedPolicies).forEach(([policyType, policies]) => {
      const filteredPolicies = getFilteredPolicies(policies);
      policies.forEach(policy => {
        if (filteredPolicies.includes(policy)) {
          policy.selected = !areAllSelected;
        }
      });
    });
    
    setAvailablePolicies(updatedPolicies);
    
    // Update selected policies list
    const newSelectedPolicies = [];
    Object.values(updatedPolicies).forEach(typeGroup => {
      typeGroup.forEach(policy => {
        if (policy.selected) {
          newSelectedPolicies.push(policy);
        }
      });
    });
    
    setSelectedPolicies(newSelectedPolicies);
  };

  const getFilteredPolicies = (policies) => {
    return policies.filter(policy => {
      const matchesSearch = policy.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
                           (policy.actualDisplayName && policy.actualDisplayName.toLowerCase().includes(searchFilter.toLowerCase()));
      
      const matchesType = typeFilter === 'all' || policy.policyType === typeFilter;
      
      const matchesStatus = statusFilter === 'all' || 
                           (statusFilter === 'new' && policy.status === 'new') ||
                           (statusFilter === 'existing' && policy.status === 'existing') ||
                           (statusFilter === 'version-mismatch' && (policy.status === 'newer-version-exists' || policy.status === 'older-version-exists'));
      
      return matchesSearch && matchesType && matchesStatus;
    });
  };

  const getPolicyTypeDisplayName = (type) => {
    const typeNames = {
      'SettingsCatalog': 'Settings Catalog',
      'ConfigurationPolicies': 'Configuration Policies',
      'CompliancePolicies': 'Compliance Policies',
      'DeviceConfigurations': 'Device Configurations',
      'EndpointSecurity': 'Endpoint Security',
      'AdminTemplates': 'Administrative Templates',
      'UpdatePolicies': 'Update Policies',
      'AppProtection': 'App Protection Policies',
      'AppProtectionPolicies': 'App Protection Policies',
      'PowerShellScripts': 'PowerShell Scripts'
    };
    return typeNames[type] || type;
  };

  const getUniqueTypes = () => {
    const types = new Set();
    Object.values(availablePolicies).forEach(typeGroup => {
      typeGroup.forEach(policy => types.add(policy.policyType));
    });
    return Array.from(types);
  };

  // Get ordered policy types for display
  const getOrderedPolicyTypes = () => {
    const desiredOrder = [
      'CompliancePolicies',
      'SettingsCatalog', 
      'UpdatePolicies',
      'DeviceConfigurations',
      'EndpointSecurity',
      'AdminTemplates',
      'ConfigurationPolicies',
      'PowerShellScripts'
    ];
    
    const availableTypes = Object.keys(availablePolicies);
    const orderedTypes = [];
    
    // Add types in desired order if they exist
    desiredOrder.forEach(type => {
      if (availableTypes.includes(type)) {
        orderedTypes.push(type);
      }
    });
    
    // Add any remaining types that weren't in the desired order
    availableTypes.forEach(type => {
      if (!orderedTypes.includes(type)) {
        orderedTypes.push(type);
      }
    });
    
    return orderedTypes;
  };

  return (
    <div className="policy-selector">
      <div className="selector-header">
        <h2>Select Policies to Deploy</h2>
        <p>Choose OpenIntuneBaseline policies to deploy to your Intune tenant</p>
      </div>

      <div className="selector-controls">
        <div className="control-row">
          <div className="control-group">
            <label htmlFor="os-select">Operating System:</label>
            <select
              id="os-select"
              value={selectedOS}
              onChange={(e) => setSelectedOS(e.target.value)}
              className="select-input"
            >
              <option value="">Select Operating System</option>
              <option value="WINDOWS">Windows</option>
              <option value="MACOS">macOS</option>
            </select>
          </div>

          <div className="control-group">
            <label htmlFor="version-select">Version:</label>
            <select
              id="version-select"
              value={selectedVersion}
              onChange={(e) => setSelectedVersion(e.target.value)}
              disabled={loadingVersions}
              className="select-input"
            >
              {loadingVersions ? (
                <option>Loading versions...</option>
              ) : (
                <>
                  <option value="">Select Version</option>
                  {availableVersions.map(version => (
                    <option key={version.name} value={version.name}>
                      {version.displayName} {version.prerelease ? '(Pre-release)' : ''}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>
        </div>

        <div className="load-policies-section">
          <button
            onClick={loadPolicies}
            disabled={loadingPolicies || !selectedVersion || !selectedOS}
            className="load-policies-btn"
          >
            {loadingPolicies ? (
              <>
                <Loader className="icon spinning" />
                Loading Policies...
              </>
            ) : (
              <>
                <Upload className="icon" />
                Load Policies for {selectedOS} {selectedVersion}
              </>
            )}
          </button>
          {Object.keys(availablePolicies).length === 0 && !loadingPolicies && (
            <p className="load-hint">Select a version and OS, then click "Load Policies" to see available policies</p>
          )}
        </div>

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
              {getUniqueTypes().map(type => (
                <option key={type} value={type}>{getPolicyTypeDisplayName(type)}</option>
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
              <option value="existing">Already Deployed</option>
              <option value="version-mismatch">Version Differences</option>
            </select>
          </div>
        </div>

        {Object.keys(availablePolicies).length > 0 && (
          <div className="global-controls">
            <button
              onClick={handleGlobalSelectAll}
              className="btn btn-outline btn-small global-select-all"
            >
              {(() => {
                // Check if all filtered policies across all types are selected
                const allFilteredPolicies = [];
                Object.entries(availablePolicies).forEach(([policyType, policies]) => {
                  const filteredPolicies = getFilteredPolicies(policies);
                  allFilteredPolicies.push(...filteredPolicies);
                });
                const areAllSelected = allFilteredPolicies.length > 0 && allFilteredPolicies.every(policy => policy.selected);
                return areAllSelected ? 'Deselect All Policies' : 'Select All Policies';
              })()}
            </button>
            <span className="selected-count">
              {selectedPolicies.length} policies selected
            </span>
          </div>
        )}
      </div>

      <div className="policies-container">
        {loadingPolicies ? (
          <div className="loading-policies">
            <Package className="loading-icon" />
            <p>Loading policies...</p>
          </div>
        ) : (
          getOrderedPolicyTypes().map(policyType => {
            const policies = availablePolicies[policyType];
            if (!policies) return null;
            
            const filteredPolicies = getFilteredPolicies(policies);
            
            if (filteredPolicies.length === 0) return null;

            const selectedCount = filteredPolicies.filter(p => p.selected).length;
            const newPoliciesCount = filteredPolicies.filter(p => p.status === 'new').length;
            const existingPoliciesCount = filteredPolicies.filter(p => p.status === 'existing').length;
            const versionMismatchCount = filteredPolicies.filter(p => p.status === 'newer-version-exists' || p.status === 'older-version-exists').length;

            return (
              <div key={policyType} className="policy-type-group">
                <div className="policy-type-header">
                  <h3>{getPolicyTypeDisplayName(policyType)}</h3>
                  <div className="policy-type-stats">
                    <span className="stat-badge stat-total">{filteredPolicies.length} total</span>
                    <span className="stat-badge stat-new">{newPoliciesCount} new</span>
                    <span className="stat-badge stat-existing">{existingPoliciesCount} deployed</span>
                    {versionMismatchCount > 0 && (
                      <span className="stat-badge stat-version-mismatch">{versionMismatchCount} version diff</span>
                    )}
                  </div>
                  <button
                    onClick={() => handleSelectAll(policyType)}
                    className="btn btn-secondary btn-small"
                  >
                    {selectedCount === filteredPolicies.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                <div className="policy-list">
                  {filteredPolicies.map((policy, index) => {
                    const originalIndex = policies.indexOf(policy);
                    return (
                      <div
                        key={`${policy.fileName}-${index}`}
                        className={`policy-item ${policy.selected ? 'selected' : ''} ${policy.status}`}
                      >
                        <div className="policy-checkbox">
                          <input
                            type="checkbox"
                            checked={policy.selected}
                            onChange={() => handlePolicyToggle(policyType, originalIndex)}
                            id={`policy-${policyType}-${index}`}
                          />
                          <label htmlFor={`policy-${policyType}-${index}`} />
                        </div>

                        <div className="policy-info">
                          <div className="policy-name">
                            {policy.actualDisplayName || policy.name}
                          </div>
                          <div className="policy-details">
                            <span className="policy-filename">{policy.fileName}</span>
                            {policy.actualDisplayName && policy.actualDisplayName !== policy.name && (
                              <span className="policy-alt-name">File: {policy.name}</span>
                            )}
                          </div>
                        </div>

                        <div className="policy-status">
                          {policy.status === 'existing' ? (
                            <div className="status-badge status-existing">
                              <CheckCircle className="status-icon" />
                              Already Deployed
                            </div>
                          ) : policy.status === 'newer-version-exists' ? (
                            <div className="status-badge status-newer-version">
                              <AlertCircle className="status-icon" />
                              Newer Version Exists
                              {policy.matchedPolicy && (
                                <div className="status-details">
                                  Deployed: {policy.matchedPolicy.displayName}
                                </div>
                              )}
                            </div>
                          ) : policy.status === 'older-version-exists' ? (
                            <div className="status-badge status-older-version">
                              <AlertCircle className="status-icon" />
                              Older Version Exists
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
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {selectedPolicies.length > 0 && (
        <div className="deploy-section">
          <div className="deploy-summary">
            <p>
              <strong>{selectedPolicies.length}</strong> policies selected for deployment
            </p>
          </div>
          <button
            onClick={() => onDeploy(selectedPolicies)}
            disabled={isLoading || selectedPolicies.length === 0}
            className="btn btn-primary btn-large"
          >
            <Download className="btn-icon" />
            {isLoading ? 'Deploying...' : `Deploy ${selectedPolicies.length} Policies`}
          </button>
        </div>
      )}
    </div>
  );
};

export default PolicySelector;
