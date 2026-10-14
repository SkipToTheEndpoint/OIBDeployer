import React, { useState } from 'react';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import ReleasePlatformCards from './ReleasePlatformCards';
import ReleaseChannelWarningModal from './ReleaseChannelWarningModal';
import { getPlatformsForChannel } from '../utils/release-manifest';

const OSSelectionWizard = ({
  onOSSelected,
  onBack,
  selectedVersion,
  platforms,
  isLoadingPlatforms,
  platformError,
  onRetryPlatforms,
  allowPrerelease,
  onAllowPrereleaseChange
}) => {
  const [selectedOS, setSelectedOS] = useState([]);
  const [channelWarningPlatforms, setChannelWarningPlatforms] = useState({ unstable: [], beta: [] });

  const toggleOS = (osId, enabled) => {
    if (!enabled) return; // Don't allow selection of disabled options
    
    setSelectedOS(prev => 
      prev.includes(osId) 
        ? prev.filter(id => id !== osId)
        : [...prev, osId]
    );
  };

  const handleContinue = () => {
    if (selectedOS.length === 0) {
      return;
    }

    const warningPlatforms = {
      unstable: getPlatformsForChannel(platforms, selectedOS, allowPrerelease, 'unstable'),
      beta: getPlatformsForChannel(platforms, selectedOS, allowPrerelease, 'beta')
    };
    if (warningPlatforms.unstable.length > 0 || warningPlatforms.beta.length > 0) {
      setChannelWarningPlatforms(warningPlatforms);
      return;
    }

    onOSSelected(selectedOS);
  };

  return (
    <div className="wizard-container">
      <div className="wizard-header">
        <h2>Select Operating Systems</h2>
        <p>Choose which operating systems you want to scan for existing policies</p>
        {selectedVersion && (
          <div className="version-info">
            <span className="version-badge">Comparing against: {selectedVersion}</span>
          </div>
        )}
      </div>

      <div className="os-selection">
        <div className="selection-header">
          <h3>Choose Operating Systems to Scan</h3>
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

      <div className="wizard-navigation">
        <button className="btn-secondary" onClick={onBack}>
          <ArrowLeft size={16} />
          Back
        </button>
        
        <button 
          className="btn-primary"
          onClick={handleContinue}
          disabled={selectedOS.length === 0}
        >
          Continue
          <ArrowRight size={16} />
        </button>
      </div>

      <div className="wizard-footer">
        <p className="selection-summary">
          {selectedOS.length > 0 
            ? `${selectedOS.length} operating system${selectedOS.length === 1 ? '' : 's'} selected for scanning`
            : 'Select at least one operating system to continue'
          }
        </p>
      </div>

      {(channelWarningPlatforms.unstable.length > 0 || channelWarningPlatforms.beta.length > 0) && (
        <ReleaseChannelWarningModal
          unstablePlatforms={channelWarningPlatforms.unstable}
          betaPlatforms={channelWarningPlatforms.beta}
          onCancel={() => setChannelWarningPlatforms({ unstable: [], beta: [] })}
          onConfirm={() => {
            setChannelWarningPlatforms({ unstable: [], beta: [] });
            onOSSelected(selectedOS);
          }}
        />
      )}
    </div>
  );
};

export default OSSelectionWizard;
