import React from 'react';
import { CheckCircle, Construction, Laptop, Monitor, Shield, Smartphone, Tablet, TestTube, TriangleAlert } from 'lucide-react';
import { getReleaseForPlatform } from '../utils/release-manifest';

const PLATFORM_META = {
  windows: { description: 'Windows 11 Devices deployed by Autopilot', icon: Monitor, color: 'blue' },
  windows365: { description: 'Windows 365 devices', icon: Monitor, color: 'blue' },
  macos: { description: 'Apple macOS devices deployed by ABM', icon: Laptop, color: 'gray' },
  byod: { description: 'App Protection Policies', icon: Shield, color: 'green' },
  ios: { description: 'Fully-managed iOS devices', icon: Smartphone, color: 'orange' },
  android: { description: 'Fully-managed Android Enterprise devices', icon: Tablet, color: 'purple' }
};

const STATUS_ICONS = {
  stable: CheckCircle,
  unstable: TriangleAlert,
  beta: TestTube,
  'in-development': Construction
};

const getStatusLabel = (platform, release) => {
  if (platform.status !== 'available') {
    return platform.status.replace(/-/g, ' ');
  }

  return release?.channel;
};

const ReleasePlatformCards = ({
  platforms,
  isLoading,
  error,
  onRetry,
  selectedOS,
  onToggle,
  allowPrerelease,
  onAllowPrereleaseChange
}) => {
  if (isLoading) {
    return <div className="loading-policy-types">Loading supported operating systems...</div>;
  }

  if (error) {
    return (
      <div className="release-manifest-error" role="alert">
        <p>{error}</p>
        <button className="btn-secondary" onClick={onRetry}>Retry</button>
      </div>
    );
  }

  return (
    <>
      <label className="prerelease-toggle">
        <input
          type="checkbox"
          checked={allowPrerelease}
          onChange={event => onAllowPrereleaseChange(event.target.checked)}
        />
        Allow Beta/Pre-Release Versions
      </label>
      <div className="policy-types-grid">
        {platforms.map(platform => {
          const meta = PLATFORM_META[platform.id] ?? { description: '', icon: Monitor, color: 'gray' };
          const IconComponent = meta.icon;
          const release = getReleaseForPlatform(platform, allowPrerelease);
          const isEnabled = platform.status === 'available' && Boolean(release?.branch);
          const isSelected = selectedOS.includes(platform.folder);
          const statusLabel = getStatusLabel(platform, release);
          const statusClass = platform.status !== 'available' ? platform.status : release?.channel;
          const StatusIcon = STATUS_ICONS[statusClass];

          return (
            <div
              key={platform.id}
              className={`policy-type-card ${isSelected ? 'selected' : ''} ${meta.color} ${isEnabled ? '' : 'disabled'}`}
              onClick={() => onToggle(platform.folder, isEnabled)}
            >
              <div className="card-header">
                <div className="card-icon">
                  <IconComponent size={32} />
                </div>
                <div className="card-check">
                  {isSelected && <CheckCircle size={20} />}
                </div>
                {statusLabel && (
                  <div className={`coming-soon-badge release-channel-${statusClass}`}>
                    {StatusIcon && <StatusIcon size={12} aria-hidden="true" />}
                    {statusLabel}
                  </div>
                )}
              </div>
              <div className="card-content">
                <h4>{platform.name}</h4>
                <p>{meta.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

export default ReleasePlatformCards;
