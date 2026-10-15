import React, { useState, useEffect } from 'react';
import { Shield, Settings, FileText, RefreshCw, ArrowRight, ArrowLeft, CheckCircle, Loader } from 'lucide-react';
import ReleasePlatformCards from './ReleasePlatformCards';
import ReleaseChannelWarningModal from './ReleaseChannelWarningModal';
import { getPlatformsForChannel } from '../utils/release-manifest';

// Display metadata for all known manifest policyType values.
// Add new entries here whenever new types are introduced in PolicyManifest.json.
const POLICY_TYPE_META = {
  CompliancePolicies: {
    name: 'Compliance Policies',
    description: 'Device compliance requirements and health checks',
    icon: Shield,
    color: 'blue'
  },
  EndpointSecurity: {
    name: 'Endpoint Security',
    description: 'Security configurations managed from the Endpoint Security blade (Antivirus, Firewall, Disk Encryption etc.)',
    icon: Shield,
    color: 'red'
  },
  SettingsCatalog: {
    name: 'Settings Catalog',
    description: 'Device management and user experience settings',
    icon: Settings,
    color: 'green'
  },
  UpdatePolicies: {
    name: 'Update Policies',
    description: 'Windows Update Ring configuration',
    icon: RefreshCw,
    color: 'orange'
  },
  DriverUpdateProfiles: {
    name: 'Driver Update Policies',
    description: 'Windows Update Driver configuration',
    icon: RefreshCw,
    color: 'yellow'
  },
  DeviceConfiguration: {
    name: 'Endpoint Analytics',
    description: 'Device health monitoring and analytics',
    icon: Settings,
    color: 'gray'
  },
  AdminTemplates: {
    name: 'Administrative Templates',
    description: 'Group Policy-style administrative template configurations',
    icon: FileText,
    color: 'purple'
  },
  AppProtectionPolicies: {
    name: 'App Protection Policies',
    description: 'Application data protection and access control for managed apps',
    icon: Shield,
    color: 'teal'
  },
};

// Last-resort fallback when neither a release manifest nor repository paths can be read.
const FALLBACK_POLICY_TYPES = ['CompliancePolicies', 'EndpointSecurity', 'SettingsCatalog', 'UpdatePolicies'];

// Policy types that require a Windows Enterprise entitlement (unavailable on Business Premium)
const ENTERPRISE_ONLY_POLICY_TYPES = ['DriverUpdateProfiles'];

// Policy types that conflict with Autopatch-managed updates
const AUTOPATCH_MANAGED_POLICY_TYPES = ['UpdatePolicies', 'DriverUpdateProfiles'];
const WINDOWS_PLATFORM_FOLDERS = ['WINDOWS', 'WINDOWS365'];

const QuickDeployWizard = ({
  onPolicyTypesSelected,
  onBack,
  selectedVersion,
  fetchPolicyTypes,
  platforms,
  isLoadingPlatforms,
  platformError,
  onRetryPlatforms,
  allowPrerelease,
  onAllowPrereleaseChange
}) => {
  const [selectedPolicyTypes, setSelectedPolicyTypes] = useState([]);
  const [selectedOS, setSelectedOS] = useState([]);
  const [currentStep, setCurrentStep] = useState('os-selection');
  // null = not yet fetched; string[] = resolved from manifest (or fallback)
  const [availablePolicyTypes, setAvailablePolicyTypes] = useState(null);
  const [isLoadingTypes, setIsLoadingTypes] = useState(false);
  // Tenant licensing questions, used to filter out policies the tenant can't use
  const [tenantLicensing, setTenantLicensing] = useState(null); // 'business-premium' | 'e3-e5-e7'
  const [usingDefenderAV, setUsingDefenderAV] = useState(null); // true | false
  const [usingAutopatch, setUsingAutopatch] = useState(null); // true | false
  const [channelWarningPlatforms, setChannelWarningPlatforms] = useState({ unstable: [], beta: [] });
  const requiresWindowsQuestions = selectedOS.some(osType => WINDOWS_PLATFORM_FOLDERS.includes(osType));

  // Resolve the list of policy type cards from fetched manifest types (or fallback).
  // Each card is { id, name, description, icon, color }.
  const getPolicyTypeCards = () => {
    const types = availablePolicyTypes && availablePolicyTypes.length > 0
      ? availablePolicyTypes
      : FALLBACK_POLICY_TYPES;
    return types.map(typeId => ({
      id: typeId,
      ...(POLICY_TYPE_META[typeId] ?? {
        name: typeId,
        description: '',
        icon: Settings,
        color: 'gray'
      })
    }));
  };

  const toggleOS = (osId, enabled) => {
    if (!enabled) return; // Don't allow selection of disabled options
    
    setSelectedOS(prev => 
      prev.includes(osId) 
        ? prev.filter(id => id !== osId)
        : [...prev, osId]
    );
  };

  const isPolicyTypeGated = (typeId) =>
    (tenantLicensing === 'business-premium' && ENTERPRISE_ONLY_POLICY_TYPES.includes(typeId)) ||
    (usingAutopatch === true && AUTOPATCH_MANAGED_POLICY_TYPES.includes(typeId));

  const getPolicyTypeGateReason = (typeId) => {
    if (tenantLicensing === 'business-premium' && ENTERPRISE_ONLY_POLICY_TYPES.includes(typeId)) {
      return 'Requires Enterprise';
    }
    if (usingAutopatch === true && AUTOPATCH_MANAGED_POLICY_TYPES.includes(typeId)) {
      return 'Managed by Autopatch';
    }
    return null;
  };

  // Drop any previously-selected types that just became gated by a licensing answer change
  useEffect(() => {
    setSelectedPolicyTypes(prev => prev.filter(id => !isPolicyTypeGated(id)));
  }, [tenantLicensing, usingAutopatch]);

  const togglePolicyType = (typeId, gated = false) => {
    if (gated) return; // Don't allow selection of gated options

    setSelectedPolicyTypes(prev => 
      prev.includes(typeId) 
        ? prev.filter(id => id !== typeId)
        : [...prev, typeId]
    );
  };

  const selectAllPolicyTypes = () => {
    const cards = getPolicyTypeCards().filter(c => !isPolicyTypeGated(c.id));
    const allIds = cards.map(c => c.id);
    setSelectedPolicyTypes(selectedPolicyTypes.length === allIds.length ? [] : allIds);
  };

  const handleOSContinue = () => {
    if (selectedOS.length === 0) return;

    const warningPlatforms = {
      unstable: getPlatformsForChannel(platforms, selectedOS, allowPrerelease, 'unstable'),
      beta: getPlatformsForChannel(platforms, selectedOS, allowPrerelease, 'beta')
    };
    if (warningPlatforms.unstable.length > 0 || warningPlatforms.beta.length > 0) {
      setChannelWarningPlatforms(warningPlatforms);
      return;
    }

    proceedFromOSSelection();
  };

  const loadPolicyTypes = async () => {
    setCurrentStep('policy-types');
    setIsLoadingTypes(true);
    try {
      if (fetchPolicyTypes) {
        const types = await fetchPolicyTypes(selectedOS);
        setAvailablePolicyTypes(types.length > 0 ? types : FALLBACK_POLICY_TYPES);
      } else {
        setAvailablePolicyTypes(FALLBACK_POLICY_TYPES);
      }
    } catch {
      setAvailablePolicyTypes(FALLBACK_POLICY_TYPES);
    } finally {
      setIsLoadingTypes(false);
    }
  };

  const proceedFromOSSelection = () => {
    if (requiresWindowsQuestions) {
      setCurrentStep('licensing');
      return;
    }

    setTenantLicensing(null);
    setUsingDefenderAV(null);
    setUsingAutopatch(null);
    loadPolicyTypes();
  };

  const handleLicensingContinue = () => {
    if (!tenantLicensing || usingDefenderAV === null || usingAutopatch === null) return;
    loadPolicyTypes();
  };

  const handlePolicyTypesContinue = () => {
    if (selectedPolicyTypes.length > 0) {
      onPolicyTypesSelected({ policyTypes: selectedPolicyTypes, osTypes: selectedOS, tenantLicensing, usingDefenderAV, usingAutopatch });
    }
  };

  const handleStepBack = () => {
    if (currentStep === 'policy-types') {
      setCurrentStep(requiresWindowsQuestions ? 'licensing' : 'os-selection');
    } else if (currentStep === 'licensing') {
      setCurrentStep('os-selection');
    } else {
      onBack();
    }
  };

  return (
    <div className="wizard-container">
      <div className="wizard-header">
        <h2>New Deployment Setup</h2>
        {currentStep === 'os-selection' && (
          <p>Select the operating systems you want to deploy policies for</p>
        )}
        {currentStep === 'licensing' && (
          <p>Tell us about your tenant so we can show relevant policies for deployment</p>
        )}
        {currentStep === 'policy-types' && (
          <p>Select the policy types you want to deploy from the latest OpenIntuneBaseline</p>
        )}
        {selectedVersion && (
          <div className="version-info">
            <span className="version-badge">Latest Version: {selectedVersion}</span>
          </div>
        )}
      </div>

      {/* OS Selection Step */}
      {currentStep === 'os-selection' && (
        <div className="os-selection">
          <div className="selection-header">
            <h3>Choose Operating Systems</h3>
          </div>

          <ReleasePlatformCards
            platforms={platforms}
            isLoading={isLoadingPlatforms}
            error={platformError}
            onRetry={onRetryPlatforms}
            selectedOS={selectedOS}
            onToggle={toggleOS}
            allowPrerelease={allowPrerelease}
            onAllowPrereleaseChange={onAllowPrereleaseChange}
          />
        </div>
      )}

      {(channelWarningPlatforms.unstable.length > 0 || channelWarningPlatforms.beta.length > 0) && (
        <ReleaseChannelWarningModal
          unstablePlatforms={channelWarningPlatforms.unstable}
          betaPlatforms={channelWarningPlatforms.beta}
          onCancel={() => setChannelWarningPlatforms({ unstable: [], beta: [] })}
          onConfirm={() => {
            setChannelWarningPlatforms({ unstable: [], beta: [] });
            proceedFromOSSelection();
          }}
        />
      )}

      {/* Licensing Questions Step */}
      {currentStep === 'licensing' && (
        <div className="policy-types-selection">
          <div className="licensing-question">
            <h3>What is your primary tenant licensing?</h3>
            <div className="policy-types-grid">
              <div
                className={`policy-type-card ${tenantLicensing === 'business-premium' ? 'selected' : ''} blue`}
                onClick={() => setTenantLicensing('business-premium')}
              >
                <div className="card-header">
                  <div className="card-check">
                    {tenantLicensing === 'business-premium' && <CheckCircle size={20} />}
                  </div>
                </div>
                <div className="card-content">
                  <h4>Business Premium</h4>
                  <p>No Windows Enterprise entitlement</p>
                </div>
              </div>
              <div
                className={`policy-type-card ${tenantLicensing === 'e3-e5-e7' ? 'selected' : ''} green`}
                onClick={() => setTenantLicensing('e3-e5-e7')}
              >
                <div className="card-header">
                  <div className="card-check">
                    {tenantLicensing === 'e3-e5-e7' && <CheckCircle size={20} />}
                  </div>
                </div>
                <div className="card-content">
                  <h4>Microsoft 365 E3 / E5 / E7</h4>
                  <p>Includes Windows Enterprise entitlement</p>
                </div>
              </div>
            </div>
          </div>

          <div className="licensing-question">
            <h3>Will Microsoft Defender for Endpoint be your primary antivirus?</h3>
            <div className="policy-types-grid">
              <div
                className={`policy-type-card ${usingDefenderAV === true ? 'selected' : ''} red`}
                onClick={() => setUsingDefenderAV(true)}
              >
                <div className="card-header">
                  <div className="card-check">
                    {usingDefenderAV === true && <CheckCircle size={20} />}
                  </div>
                </div>
                <div className="card-content">
                  <h4>Yes</h4>
                  <p>Defender for Endpoint is the primary antivirus</p>
                </div>
              </div>
              <div
                className={`policy-type-card ${usingDefenderAV === false ? 'selected' : ''} gray`}
                onClick={() => setUsingDefenderAV(false)}
              >
                <div className="card-header">
                  <div className="card-check">
                    {usingDefenderAV === false && <CheckCircle size={20} />}
                  </div>
                </div>
                <div className="card-content">
                  <h4>No</h4>
                  <p>Using a third-party antivirus solution</p>
                </div>
              </div>
            </div>
          </div>

          <div className="licensing-question">
            <h3>Will you be managing updates via Autopatch?</h3>
            <div className="policy-types-grid">
              <div
                className={`policy-type-card ${usingAutopatch === true ? 'selected' : ''} red`}
                onClick={() => setUsingAutopatch(true)}
              >
                <div className="card-header">
                  <div className="card-check">
                    {usingAutopatch === true && <CheckCircle size={20} />}
                  </div>
                </div>
                <div className="card-content">
                  <h4>Yes</h4>
                  <p>Autopatch manages Windows Update deployment</p>
                </div>
              </div>
              <div
                className={`policy-type-card ${usingAutopatch === false ? 'selected' : ''} gray`}
                onClick={() => setUsingAutopatch(false)}
              >
                <div className="card-header">
                  <div className="card-check">
                    {usingAutopatch === false && <CheckCircle size={20} />}
                  </div>
                </div>
                <div className="card-content">
                  <h4>No</h4>
                  <p>Managing Windows Update for Business directly</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Policy Types Selection Step */}
      {currentStep === 'policy-types' && (
        <div className="policy-types-selection">
          <div className="selection-header">
            <h3>Choose Policy Types</h3>
            {!isLoadingTypes && (
              <button
                className="btn-link select-all"
                onClick={selectAllPolicyTypes}
              >
                {selectedPolicyTypes.length === getPolicyTypeCards().length ? 'Deselect All' : 'Select All'}
              </button>
            )}
          </div>

          {isLoadingTypes ? (
            <div className="loading-policy-types">
              <Loader size={28} className="spinning" />
              <p>Loading available policy types…</p>
            </div>
          ) : (
            <div className="policy-types-grid">
              {getPolicyTypeCards().map(type => {
                const IconComponent = type.icon;
                const isSelected = selectedPolicyTypes.includes(type.id);
                const isGated = isPolicyTypeGated(type.id);

                return (
                  <div
                    key={type.id}
                    className={`policy-type-card ${isSelected ? 'selected' : ''} ${type.color} ${isGated ? 'disabled' : ''}`}
                    onClick={() => togglePolicyType(type.id, isGated)}
                  >
                    <div className="card-header">
                      <div className="card-icon">
                        <IconComponent size={32} />
                      </div>
                      <div className="card-check">
                        {isSelected && <CheckCircle size={20} />}
                      </div>
                      {isGated && (
                        <div className="coming-soon-badge">
                          {getPolicyTypeGateReason(type.id)}
                        </div>
                      )}
                    </div>
                    <div className="card-content">
                      <h4>{type.name}</h4>
                      <p>{type.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="wizard-navigation">
        <button className="btn-secondary" onClick={handleStepBack}>
          <ArrowLeft size={16} />
          Back
        </button>
        
        {currentStep === 'os-selection' && (
          <button 
            className="btn-primary"
            onClick={handleOSContinue}
            disabled={selectedOS.length === 0}
          >
            Continue
            <ArrowRight size={16} />
          </button>
        )}

        {currentStep === 'licensing' && (
          <button
            className="btn-primary"
            onClick={handleLicensingContinue}
            disabled={!tenantLicensing || usingDefenderAV === null || usingAutopatch === null}
          >
            Continue
            <ArrowRight size={16} />
          </button>
        )}

        {currentStep === 'policy-types' && (
          <button
            className="btn-primary"
            onClick={handlePolicyTypesContinue}
            disabled={selectedPolicyTypes.length === 0 || isLoadingTypes}
          >
            Continue
            <ArrowRight size={16} />
          </button>
        )}
      </div>

      <div className="wizard-footer">
        {currentStep === 'os-selection' && (
          <p className="selection-summary">
            {selectedOS.length > 0 
              ? `${selectedOS.length} operating system${selectedOS.length === 1 ? '' : 's'} selected`
              : 'Select at least one operating system to continue'
            }
          </p>
        )}
        {currentStep === 'licensing' && (
          <p className="selection-summary">
            {(!tenantLicensing || usingDefenderAV === null || usingAutopatch === null)
              ? 'Answer all questions to continue'
              : 'Ready to continue'
            }
          </p>
        )}
        {currentStep === 'policy-types' && (
          <p className="selection-summary">
            {selectedPolicyTypes.length > 0 
              ? `${selectedPolicyTypes.length} policy type${selectedPolicyTypes.length === 1 ? '' : 's'} selected`
              : 'Select at least one policy type to continue'
            }
          </p>
        )}
      </div>
    </div>
  );
};

export default QuickDeployWizard;
