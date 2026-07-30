import React from 'react';
import { Package, Search, ShieldCheck, ArrowRight, HelpCircle } from 'lucide-react';

const DeploymentTypeWizard = ({ onSelectType, onBack }) => {
  return (
    <div className="wizard-container">
      <div className="wizard-header">
        <h2>Choose Your Deployment Type</h2>
        <p>Select the type of deployment you want to perform</p>
      </div>

      <div className="deployment-type-options">
        <div 
          className="deployment-type-card new-deployment"
          onClick={() => onSelectType('new')}
        >
          <div className="card-icon">
            <Package size={48} />
          </div>
          <div className="card-content">
            <h3>New Deployment</h3>
            <p>Deploy OpenIntuneBaseline policies for the first time to your tenant</p>
            <div className="card-features">
              <span>• Latest OIB version</span>
              <span>• Licensing-aware policy filtering</span>
              <span>• Guided deployment</span>
            </div>
          </div>
          <div className="card-action">
            <ArrowRight size={24} />
          </div>
        </div>

        <div 
          className="deployment-type-card existing-deployment"
          onClick={() => onSelectType('existing')}
        >
          <div className="card-icon">
            <Search size={48} />
          </div>
          <div className="card-content">
            <h3>Existing Deployment</h3>
            <p>Compare your current OIB deployment with the latest version</p>
            <div className="card-features">
              <span>• Policy comparison</span>
              <span>• Version analysis</span>
              <span>• Deploy missing or outdated policies</span>
            </div>
          </div>
          <div className="card-action">
            <ArrowRight size={24} />
          </div>
        </div>

        <div 
          className="deployment-type-card validate-deployment"
          onClick={() => onSelectType('validate')}
        >
          <div className="card-icon">
            <ShieldCheck size={48} />
          </div>
          <div className="card-content">
            <h3>Policy Validation</h3>
            <p>Check your deployed OIB policies for setting-level drift against the baseline</p>
            <div className="card-features">
              <span>• Per-setting drift check</span>
              <span>• Settings Catalog, Endpoint Security & Compliance</span>
              <span>• No changes made to your tenant</span>
            </div>
          </div>
          <div className="card-action">
            <ArrowRight size={24} />
          </div>
        </div>
      </div>

      <div className="wizard-help">
        <div className="help-item">
          <HelpCircle size={16} />
          <span>Not sure which option to choose? Select "New Deployment" if this is your first time using OIBDeployer, "Existing Deployment" to compare and update previously deployed policies, or "Policy Validation" to check deployed policies for configuration drift.</span>
        </div>
      </div>

      {onBack && (
        <div className="wizard-navigation">
          <button className="btn-secondary" onClick={onBack}>
            Back
          </button>
        </div>
      )}
    </div>
  );
};

export default DeploymentTypeWizard;
