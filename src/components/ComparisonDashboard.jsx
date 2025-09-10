import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, AlertTriangle, CheckCircle, Plus, ArrowLeft, RefreshCw } from 'lucide-react';

const ComparisonDashboard = ({ 
  existingPolicies, 
  availablePolicies, 
  onSelectPolicies, 
  onBack,
  onRefresh,
  isLoading,
  selectedVersion 
}) => {
  const [comparisonData, setComparisonData] = useState(null);
  const [selectedForDeployment, setSelectedForDeployment] = useState([]);
  const [viewFilter, setViewFilter] = useState('all'); // 'all', 'new', 'outdated', 'missing'

  useEffect(() => {
    if (availablePolicies && Object.keys(availablePolicies).length > 0) {
      generateComparisonData();
    }
  }, [availablePolicies, existingPolicies]);

  const generateComparisonData = () => {
    const comparison = {
      byOS: {}, // Organize by OS
      totals: {
        current: 0,
        outdated: 0,
        newer: 0,
        missing: 0,
        total: 0
      }
    };

    // Process each OS separately
    Object.entries(availablePolicies).forEach(([osType, osData]) => {
      comparison.byOS[osType] = {
        current: [],
        outdated: [],
        newer: [],
        missing: [],
        totals: {
          current: 0,
          outdated: 0,
          newer: 0,
          missing: 0,
          total: 0
        }
      };

      // Flatten policies for this OS
      const osPolicies = [];
      Object.values(osData).forEach(policies => {
        osPolicies.push(...policies.map(p => ({ ...p, osType })));
      });

      // Compare each available policy with existing ones
      osPolicies.forEach(availablePolicy => {
        const policyName = availablePolicy.name.replace('.json', '');
        
        // Extract version from policy name
        const extractVersion = (name) => {
          const versionMatch = name.match(/v(\d+(?:\.\d+)*)/i);
          return versionMatch ? versionMatch[1] : null;
        };

        // Extract base name without version
        const extractBaseName = (name) => {
          return name.replace(/\s*-\s*v\d+(?:\.\d+)*\s*$/i, '').trim();
        };

        const availableVersion = extractVersion(policyName);
        const availableBaseName = extractBaseName(policyName);

        // Find matching existing policy
        const existingPolicy = existingPolicies.find(existing => {
          const existingBaseName = extractBaseName(existing.displayName || existing.name || '');
          return existingBaseName.toLowerCase() === availableBaseName.toLowerCase();
        });

        if (existingPolicy) {
          const existingVersion = extractVersion(existingPolicy.displayName || existingPolicy.name || '');
          
          if (!availableVersion || !existingVersion) {
            // Can't compare versions, assume current
            comparison.byOS[osType].current.push({
              ...availablePolicy,
              existingPolicy,
              status: 'current'
            });
          } else {
            // Compare versions
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

            const versionComparison = compareVersions(availableVersion, existingVersion);
            
            if (versionComparison === 0) {
              comparison.byOS[osType].current.push({
                ...availablePolicy,
                existingPolicy,
                status: 'current'
              });
            } else if (versionComparison > 0) {
              comparison.byOS[osType].outdated.push({
                ...availablePolicy,
                existingPolicy,
                status: 'outdated',
                availableVersion,
                existingVersion
              });
            } else {
              comparison.byOS[osType].newer.push({
                ...availablePolicy,
                existingPolicy,
                status: 'newer',
                availableVersion,
                existingVersion
              });
            }
          }
        } else {
          comparison.byOS[osType].missing.push({
            ...availablePolicy,
            status: 'missing'
          });
        }
      });

      // Calculate OS totals
      comparison.byOS[osType].totals = {
        current: comparison.byOS[osType].current.length,
        outdated: comparison.byOS[osType].outdated.length,
        newer: comparison.byOS[osType].newer.length,
        missing: comparison.byOS[osType].missing.length,
        total: osPolicies.length
      };

      // Add to overall totals
      comparison.totals.current += comparison.byOS[osType].totals.current;
      comparison.totals.outdated += comparison.byOS[osType].totals.outdated;
      comparison.totals.newer += comparison.byOS[osType].totals.newer;
      comparison.totals.missing += comparison.byOS[osType].totals.missing;
      comparison.totals.total += comparison.byOS[osType].totals.total;
    });

    setComparisonData(comparison);
  };

  const getFilteredPolicies = () => {
    if (!comparisonData || !comparisonData.byOS) return [];
    
    // Collect policies from all OS types based on filter
    const allPolicies = [];
    
    Object.values(comparisonData.byOS).forEach(osData => {
      switch (viewFilter) {
        case 'new':
          allPolicies.push(...(osData.missing || []));
          break;
        case 'outdated':
          allPolicies.push(...(osData.outdated || []));
          break;
        case 'newer':
          allPolicies.push(...(osData.newer || []));
          break;
        case 'current':
          allPolicies.push(...(osData.current || []));
          break;
        default:
          allPolicies.push(
            ...(osData.missing || []),
            ...(osData.outdated || []),
            ...(osData.newer || []),
            ...(osData.current || [])
          );
          break;
      }
    });
    
    return allPolicies;
  };

  const togglePolicySelection = (policy) => {
    setSelectedForDeployment(prev => {
      const isSelected = prev.some(p => p.name === policy.name);
      if (isSelected) {
        return prev.filter(p => p.name !== policy.name);
      } else {
        return [...prev, policy];
      }
    });
  };

  const handleDeploySelected = () => {
    console.warn('ComparisonDashboard: Deploy button clicked');
    console.warn('Selected policies for deployment:', selectedForDeployment);
    if (selectedForDeployment.length > 0) {
      onSelectPolicies(selectedForDeployment);
    } else {
      console.warn('No policies selected for deployment');
    }
  };

  const handleGlobalSelectAll = () => {
    // Get all currently filtered policies across all OS types
    const allFilteredPolicies = [];
    Object.entries(comparisonData.byOS).forEach(([osType, osData]) => {
      const getOSFilteredPolicies = () => {
        switch (viewFilter) {
          case 'new':
            return osData.missing || [];
          case 'outdated':
            return osData.outdated || [];
          case 'newer':
            return osData.newer || [];
          case 'current':
            return osData.current || [];
          default:
            return [...(osData.missing || []), ...(osData.outdated || []), ...(osData.newer || [])];
        }
      };
      allFilteredPolicies.push(...getOSFilteredPolicies());
    });

    // Check if all filtered policies are selected
    const areAllSelected = allFilteredPolicies.length > 0 && 
      allFilteredPolicies.every(policy => selectedForDeployment.some(p => p.name === policy.name));

    if (areAllSelected) {
      // Deselect all filtered policies
      setSelectedForDeployment(prev => 
        prev.filter(selected => !allFilteredPolicies.some(filtered => filtered.name === selected.name))
      );
    } else {
      // Select all filtered policies that aren't already selected
      setSelectedForDeployment(prev => {
        const newSelections = allFilteredPolicies.filter(
          filtered => !prev.some(selected => selected.name === filtered.name)
        );
        return [...prev, ...newSelections];
      });
    }
  };

  if (!comparisonData) {
    return (
      <div className="wizard-container">
        <div className="loading-state">
          <RefreshCw className="spinner" size={32} />
          <p>Analyzing your tenant policies...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="wizard-container comparison-dashboard">
      <div className="comparison-content">
        <div className="wizard-header">
          <h2>Policy Comparison Dashboard</h2>
          <p>Compare your current OIB deployment with the latest version</p>
          <p><b>Important:</b> Checks are done on policy name <i>only</i>, not settings held within!</p>
          {selectedVersion && (
            <div className="version-info">
              <span className="version-badge">Comparing against: {selectedVersion}</span>
            </div>
          )}
        </div>

        {/* Summary Stats */}
        <div className="comparison-stats">
        <div className="stat-card current">
          <div className="stat-icon">
            <CheckCircle size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-number">{comparisonData.totals.current}</div>
            <div className="stat-label">Current Policies</div>
          </div>
        </div>

        <div className="stat-card outdated">
          <div className="stat-icon">
            <TrendingUp size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-number">{comparisonData.totals.outdated}</div>
            <div className="stat-label">Outdated Policies</div>
          </div>
        </div>

        <div className="stat-card missing">
          <div className="stat-icon">
            <Plus size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-number">{comparisonData.totals.missing}</div>
            <div className="stat-label">New Policies</div>
          </div>
        </div>

        <div className="stat-card newer">
          <div className="stat-icon">
            <AlertTriangle size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-number">{comparisonData.totals.newer}</div>
            <div className="stat-label">Newer Than Latest</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="filter-tabs">
        <button 
          className={`filter-tab ${viewFilter === 'all' ? 'active' : ''}`}
          onClick={() => setViewFilter('all')}
        >
          All Policies ({comparisonData.totals.total})
        </button>
        <button 
          className={`filter-tab ${viewFilter === 'new' ? 'active' : ''}`}
          onClick={() => setViewFilter('new')}
        >
          New ({comparisonData.totals.missing})
        </button>
        <button 
          className={`filter-tab ${viewFilter === 'outdated' ? 'active' : ''}`}
          onClick={() => setViewFilter('outdated')}
        >
          Updates Available ({comparisonData.totals.outdated})
        </button>
        <button 
          className={`filter-tab ${viewFilter === 'newer' ? 'active' : ''}`}
          onClick={() => setViewFilter('newer')}
        >
          Newer Than Latest ({comparisonData.totals.newer})
        </button>
      </div>

      {/* Global Selection Controls */}
      <div className="global-controls">
        <button
          onClick={handleGlobalSelectAll}
          className="btn btn-outline btn-small global-select-all"
        >
          {(() => {
            // Get all currently filtered policies
            const allFilteredPolicies = [];
            Object.entries(comparisonData.byOS).forEach(([osType, osData]) => {
              const getOSFilteredPolicies = () => {
                switch (viewFilter) {
                  case 'new':
                    return osData.missing || [];
                  case 'outdated':
                    return osData.outdated || [];
                  case 'newer':
                    return osData.newer || [];
                  case 'current':
                    return osData.current || [];
                  default:
                    return [...(osData.missing || []), ...(osData.outdated || []), ...(osData.newer || [])];
                }
              };
              allFilteredPolicies.push(...getOSFilteredPolicies());
            });
            
            const areAllSelected = allFilteredPolicies.length > 0 && 
              allFilteredPolicies.every(policy => selectedForDeployment.some(p => p.name === policy.name));
            
            return areAllSelected ? 'Deselect All Policies' : 'Select All Policies';
          })()}
        </button>
        <span className="selected-count">
          {selectedForDeployment.length} policies selected
        </span>
      </div>

      {/* Policy List */}
      <div className="policy-comparison-list">
        {comparisonData.byOS && Object.entries(comparisonData.byOS).map(([osType, osData]) => {
          // Get filtered policies for this OS
          const getOSFilteredPolicies = () => {
            switch (viewFilter) {
              case 'new':
                return osData.missing || [];
              case 'outdated':
                return osData.outdated || [];
              case 'newer':
                return osData.newer || [];
              case 'current':
                return osData.current || [];
              default:
                return [
                  ...(osData.missing || []),
                  ...(osData.outdated || []),
                  ...(osData.newer || []),
                  ...(osData.current || [])
                ];
            }
          };

          const osPolicies = getOSFilteredPolicies();
          
          if (osPolicies.length === 0) return null;

          return (
            <div key={osType} className="os-policy-section">
              <div className="os-section-header">
                <h3 className="os-section-title">{osType.toUpperCase()}</h3>
                <div className="os-section-stats">
                  {osData.totals && (
                    <>
                      {viewFilter === 'all' && (
                        <span className="os-stat-summary">
                          {osData.totals.missing} new, {osData.totals.outdated} updates, {osData.totals.current} current
                        </span>
                      )}
                      {viewFilter === 'new' && <span className="os-stat-summary">{osData.totals.missing} policies</span>}
                      {viewFilter === 'outdated' && <span className="os-stat-summary">{osData.totals.outdated} policies</span>}
                      {viewFilter === 'newer' && <span className="os-stat-summary">{osData.totals.newer} policies</span>}
                      {viewFilter === 'current' && <span className="os-stat-summary">{osData.totals.current} policies</span>}
                    </>
                  )}
                </div>
              </div>
              
              <div className="os-policies">
                {osPolicies.map((policy, index) => (
                  <div key={`${policy.name}-${osType}-${index}`} className={`policy-comparison-item ${policy.status}`}>
                    <div className="policy-info">
                      <div className="policy-name">{policy.name.replace('.json', '')}</div>
                      {policy.existingPolicy && (
                        <div className="matched-policy-name">
                          <span className="matched-label">Matched Policy:</span>
                          <span className="matched-name">{policy.existingPolicy.displayName || policy.existingPolicy.name}</span>
                        </div>
                      )}
                      <div className="policy-status">
                        {policy.status === 'current' && <span className="status-badge current">Up to date</span>}
                        {policy.status === 'outdated' && (
                          <span className="status-badge outdated">
                            Update available: v{policy.existingVersion} → v{policy.availableVersion}
                          </span>
                        )}
                        {policy.status === 'missing' && <span className="status-badge missing">New policy</span>}
                        {policy.status === 'newer' && (
                          <span className="status-badge newer">
                            Newer than latest: v{policy.existingVersion} {'>'} v{policy.availableVersion}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {(policy.status === 'outdated' || policy.status === 'missing') && (
                      <div className="policy-actions">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={selectedForDeployment.some(p => p.name === policy.name)}
                            onChange={() => togglePolicySelection(policy)}
                          />
                          <span className="checkbox-text">Deploy</span>
                        </label>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      </div>

      {/* Sticky Navigation */}
      <div className="comparison-navigation-sticky">
        <div className="wizard-navigation">
          <button className="btn-secondary" onClick={onBack}>
            <ArrowLeft size={16} />
            Back
          </button>
          
          <button className="btn-secondary btn-refresh" onClick={onRefresh} disabled={isLoading}>
            <RefreshCw size={16} className={isLoading ? 'spinning' : ''} />
            Refresh Data
          </button>

          {selectedForDeployment.length > 0 && (
            <button className="btn-primary" onClick={handleDeploySelected}>
              Deploy Selected ({selectedForDeployment.length})
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComparisonDashboard;
