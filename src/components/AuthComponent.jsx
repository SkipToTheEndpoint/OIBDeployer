import React from 'react';
import { Shield, Lock } from 'lucide-react';

const AuthComponent = ({ onLogin, isLoading, tenantInfo }) => {
  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <Shield className="auth-icon" />
          <h2>Microsoft Intune Authentication</h2>
          <p>Sign in with your work or school account to deploy OpenIntuneBaseline policies</p>
          {tenantInfo && (
            <div className="current-tenant">
              <p><strong>Current Tenant:</strong> {tenantInfo.tenantId}</p>
              <p><strong>User:</strong> {tenantInfo.username}</p>
            </div>
          )}
        </div>

        <div className="auth-content">
          <div className="auth-info">
            <div className="info-item">
              <Lock className="info-icon" />
              <div>
                <h4>Secure Authentication</h4>
                <p>Uses Microsoft Authentication Library (MSAL) for secure OAuth 2.0 authentication</p>
              </div>
            </div>
            
            <div className="required-permissions">
              <h4>Required Permissions:</h4>
              <ul>
                <li>DeviceManagementConfiguration.ReadWrite.All</li>
                <li>DeviceManagementApps.ReadWrite.All (Requested separatelywhen deploying App Protection policies)</li>
              </ul>
            </div>
          </div>

          <button 
            onClick={onLogin} 
            disabled={isLoading}
            className="ms-signin-btn"
          >
            <img 
              src="/ms-symbol_signin_light.svg" 
              alt="Sign in with Microsoft" 
              className="ms-signin-svg"
            />
          </button>

          <div className="auth-footer">
            <p className="disclaimer">
              This application will request permissions to read and write Intune configuration policies. 
              Your credentials are handled securely by Microsoft's authentication service.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthComponent;
