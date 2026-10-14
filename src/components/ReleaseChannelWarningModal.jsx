import React from 'react';
import { TriangleAlert } from 'lucide-react';

const ReleaseChannelWarningModal = ({ unstablePlatforms, betaPlatforms, onCancel, onConfirm }) => (
  <div className="modal-overlay" onClick={onCancel} role="presentation">
    <div
      className="modal-content unstable-channel-warning-modal"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="unstable-channel-warning-title"
      onClick={event => event.stopPropagation()}
    >
      <div className="modal-header">
        <h2 id="unstable-channel-warning-title">
          <TriangleAlert size={22} aria-hidden="true" />
          Release Channel Warning
        </h2>
      </div>
      <div className="modal-body">
        {unstablePlatforms.length > 0 && (
          <p>
            The selected baseline(s) may be outdated. Please deploy with caution.
            <br />
            <br />
            Affected platform
            {unstablePlatforms.length === 1 ? '' : 's'}: {unstablePlatforms.map(platform => platform.name).join(', ')}.
          </p>
        )}
        {unstablePlatforms.length > 0 && betaPlatforms.length > 0 && (
          <hr className="channel-warning-divider" />
        )}
        {betaPlatforms.length > 0 && (
          <p>
            The selected baseline(s) are a Beta release and not production-ready!
            <br />
            Please log any issues identified on{' '}
            <a href="https://github.com/SkipToTheEndpoint/OpenIntuneBaseline" target="_blank" rel="noopener noreferrer">GitHub</a>.
            <br />
            <br />
            Affected platform{betaPlatforms.length === 1 ? '' : 's'}: {betaPlatforms.map(platform => platform.name).join(', ')}.
          </p>
        )}
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onCancel}>Go back</button>
        <button className="btn btn-primary" onClick={onConfirm}>Continue anyway</button>
      </div>
    </div>
  </div>
);

export default ReleaseChannelWarningModal;
