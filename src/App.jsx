import React, { useState, useEffect } from 'react';
import { Upload, Settings, CheckCircle, AlertCircle, Loader, BookOpen, ArrowLeft } from 'lucide-react';
import Homepage from './components/Homepage';
import AuthComponent from './components/AuthComponent';
import PolicySelector from './components/PolicySelector';
import FilteredPolicySelector from './components/FilteredPolicySelector';
import DeploymentProgress from './components/DeploymentProgress';
import StatusPanel from './components/StatusPanel';
import Documentation from './components/Documentation';
import DeploymentResultsModal from './components/DeploymentResultsModal';
import DeploymentTypeWizard from './components/DeploymentTypeWizard';
import QuickDeployWizard from './components/QuickDeployWizard';
import ComparisonDashboard from './components/ComparisonDashboard';
import OSSelectionWizard from './components/OSSelectionWizard';
import authService from './utils/auth';
import graphAPI from './utils/graph-api';
import githubAPI from './utils/github-api';
import { getTenantDisplayName, isValidTenantId } from './utils/tenant';
import { applyTenantVariablesToPolicy } from './utils/tenant-variables';
import oibLogo from '../assets/oib-logo.svg';
import './styles/App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [account, setAccount] = useState(null);
  const [tenantId, setTenantId] = useState(null);
  const [tenantInfo, setTenantInfo] = useState(null);
  const [existingPolicies, setExistingPolicies] = useState([]);
  const [selectedPolicies, setSelectedPolicies] = useState([]);
  const [deploymentResults, setDeploymentResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentStep, setCurrentStep] = useState('homepage');
  const [showDocumentation, setShowDocumentation] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [deploymentProgress, setDeploymentProgress] = useState({
    isDeploying: false,
    currentPolicy: '',
    completed: 0,
    total: 0,
    currentStep: 'preparing'
  });

  // New wizard state variables
  const [deploymentType, setDeploymentType] = useState(null); // 'new' or 'existing'
  const [selectedPolicyTypes, setSelectedPolicyTypes] = useState([]); // ['compliance', 'endpoint-security', etc.]
  const [selectedOSTypes, setSelectedOSTypes] = useState([]); // ['WINDOWS', 'MACOS']
  const [wizardStep, setWizardStep] = useState('deployment-type'); // wizard sub-steps
  const [availablePolicies, setAvailablePolicies] = useState({});
  const [latestVersion, setLatestVersion] = useState(null);

  useEffect(() => {
    initializeApp();
  }, []);

  // Update page title based on current step
  useEffect(() => {
    switch (currentStep) {
      case 'homepage':
        document.title = 'OIB Deployer - Deploy OpenIntuneBaseline Security Policies to Microsoft Intune';
        break;
      case 'auth':
        document.title = 'OIB Deployer - Sign In to Microsoft Intune';
        break;
      case 'wizard':
        document.title = 'OIB Deployer - OpenIntuneBaseline Policy Deployment Wizard';
        break;
      default:
        document.title = 'OIB Deployer - OpenIntuneBaseline Policy Deployment Tool';
    }
  }, [currentStep]);

  const initializeApp = async () => {
    try {
      setIsLoading(true);
      await authService.initialize();
      
      if (authService.isAuthenticated()) {
        const account = authService.getAccount();
        const tenantId = authService.getTenantId();
        const tenantInfo = authService.getTenantInfo();
        
        setIsAuthenticated(true);
        setAccount(account);
        setTenantId(tenantId);
        setTenantInfo(tenantInfo);
        setCurrentStep('wizard');
        setWizardStep('deployment-type');
        
        console.log('Already connected to tenant:', tenantId);
        
        await loadExistingPolicies();
        await loadLatestVersionAndPolicies();
      }
    } catch (error) {
      console.error('Failed to initialize app:', error);
      setError('Failed to initialize application');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // With redirect flow, this will redirect the page
      await authService.login();
      
      // The following code will only execute if there's an error
      // On successful redirect, the page will reload and initialization will handle auth state
    } catch (error) {
      console.error('Login failed:', error);
      setError('Login failed: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetStarted = () => {
    setCurrentStep('auth');
  };

  const handleBackToHomepage = () => {
    setCurrentStep('homepage');
    setShowDocumentation(false);
  };

  const handleLogout = async () => {
    try {
      // With redirect flow, this will redirect the page and clear all state
      await authService.logout();
      
      // The following code will only execute if there's an error
      // On successful redirect, the page will reload to initial state
    } catch (error) {
      console.error('Logout failed:', error);
      setError('Logout failed: ' + error.message);
    }
  };

  const loadExistingPolicies = async () => {
    try {
      setIsLoading(true);
      console.log('Loading existing policies from tenant...');
      
      const policies = await graphAPI.getAllPolicies();
      setExistingPolicies(policies);
      
      console.log(`Loaded ${policies.length} existing policies from tenant`);
    } catch (error) {
      console.error('Failed to load existing policies:', error);
      setError('Failed to load existing policies from tenant');
    } finally {
      setIsLoading(false);
    }
  };

  const loadLatestVersionAndPolicies = async () => {
    try {
      console.log('Loading latest OIB version and policies...');
      
      // Check session storage first
      const sessionKey = 'oib-latest-data';
      const cachedData = sessionStorage.getItem(sessionKey);
      
      if (cachedData) {
        try {
          const { version, policies, timestamp } = JSON.parse(cachedData);
          const cacheAge = Date.now() - timestamp;
          const maxAge = 30 * 60 * 1000; // 30 minutes
          
          if (cacheAge < maxAge) {
            console.log(`Using cached data (age: ${Math.round(cacheAge / 1000)}s)`);
            setLatestVersion(version);
            setAvailablePolicies(policies);
            return;
          } else {
            console.log('Cached data expired, fetching fresh data');
            sessionStorage.removeItem(sessionKey);
          }
        } catch (error) {
          console.warn('Failed to parse cached data, fetching fresh:', error);
          sessionStorage.removeItem(sessionKey);
        }
      }
      
      // Fetch fresh data
      console.log('Fetching fresh data from GitHub API...');
      
      // Use main branch instead of releases for latest code
      const latest = 'main';
      setLatestVersion('Latest (main branch)');
      
      // Load policies for all OS types from main branch
      const policies = {};
      const osTypes = ['WINDOWS', 'MACOS'];
      
      for (const os of osTypes) {
        try {
          const osPolicies = await githubAPI.getPoliciesForOS(os, latest);
          if (osPolicies && Object.keys(osPolicies).length > 0) {
            policies[os] = osPolicies;
          }
        } catch (error) {
          console.warn(`Failed to load ${os} policies from main branch:`, error);
        }
      }
      
      setAvailablePolicies(policies);
      
      // Cache the data in session storage
      const dataToCache = {
        version: 'Latest (main branch)',
        policies: policies,
        timestamp: Date.now()
      };
      sessionStorage.setItem(sessionKey, JSON.stringify(dataToCache));
      
      console.log(`Loaded and cached policies from main branch:`, Object.keys(policies));
    } catch (error) {
      console.error('Failed to load latest version and policies:', error);
      setError('Failed to load latest version information');
    }
  };

  // Wizard handler functions
  const handleDeploymentTypeSelection = (type) => {
    setDeploymentType(type);
    if (type === 'new') {
      setWizardStep('policy-types');
    } else if (type === 'existing') {
      setWizardStep('os-selection');
    }
  };

  const handleOSSelection = (osTypes) => {
    setSelectedOSTypes(osTypes);
    setWizardStep('comparison-dashboard');
    // Load policies only for selected OS types
    loadPoliciesForSelectedOS(osTypes);
  };

  const loadPoliciesForSelectedOS = async (osTypes) => {
    try {
      console.log(`Loading policies for selected OS types: ${osTypes.join(', ')}`);
      
      // Filter existing available policies or load fresh data for selected OS
      const filteredPolicies = {};
      
      if (availablePolicies && Object.keys(availablePolicies).length > 0) {
        // Use cached data, filter by selected OS
        osTypes.forEach(os => {
          if (availablePolicies[os]) {
            filteredPolicies[os] = availablePolicies[os];
          }
        });
      } else {
        // Load fresh data for selected OS only
        for (const os of osTypes) {
          try {
            const osPolicies = await githubAPI.getPoliciesForOS(os, 'main');
            if (osPolicies && Object.keys(osPolicies).length > 0) {
              filteredPolicies[os] = osPolicies;
            }
          } catch (error) {
            console.warn(`Failed to load ${os} policies:`, error);
          }
        }
      }
      
      setAvailablePolicies(filteredPolicies);
      console.log(`Loaded policies for selected OS types:`, Object.keys(filteredPolicies));
    } catch (error) {
      console.error('Failed to load policies for selected OS:', error);
      setError('Failed to load policies for selected operating systems');
    }
  };

  const handlePolicyTypesSelection = (selection) => {
    setSelectedPolicyTypes(selection.policyTypes);
    setSelectedOSTypes(selection.osTypes);
    setWizardStep('policy-selection');
    // Filter available policies based on selected types and OS
    filterPoliciesByTypesAndOS(selection.policyTypes, selection.osTypes);
  };

  const filterPoliciesByTypesAndOS = (policyTypes, osTypes) => {
    // Set wizard step to policy selection to stay in wizard flow
    setWizardStep('policy-selection');
    // Filter available policies based on selected types and OS
    // Load only the policies for the selected OS types
    loadPoliciesForSelectedOS(osTypes);
  };

  const handleComparisonPolicySelection = (policies) => {
    console.warn('handleComparisonPolicySelection called with:', policies);
    setSelectedPolicies(policies);
    setCurrentStep('deploy');
    // Actually start the deployment
    handleDeployment(policies);
  };

  const handleWizardBack = () => {
    if (wizardStep === 'policy-types') {
      setWizardStep('deployment-type');
      setDeploymentType(null);
    } else if (wizardStep === 'policy-selection') {
      setWizardStep('policy-types');
      setSelectedPolicyTypes([]);
    } else if (wizardStep === 'os-selection') {
      setWizardStep('deployment-type');
      setDeploymentType(null);
    } else if (wizardStep === 'comparison-dashboard') {
      if (deploymentType === 'existing') {
        setWizardStep('os-selection');
        setSelectedOSTypes([]);
      } else {
        setWizardStep('deployment-type');
        setDeploymentType(null);
      }
    }
  };

  const handlePolicySelection = (policies) => {
    setSelectedPolicies(policies);
  };

  const handleDeployment = async (policiesToDeploy = null) => {
    console.warn('handleDeployment called with:', policiesToDeploy);
    const policies = policiesToDeploy || selectedPolicies;
    
    console.warn('Starting deployment with policies:', policies);
    console.warn('Number of policies to deploy:', policies.length);
    
    if (policies.length === 0) {
      console.warn('No policies selected, returning early');
      setError('Please select at least one policy to deploy');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      // Change step to 'deploy' to show deployment progress
      setCurrentStep('deploy');
      setDeploymentResults([]);

      // Initialize deployment progress
      setDeploymentProgress({
        isDeploying: true,
        currentPolicy: '',
        completed: 0,
        total: policies.length,
        currentStep: 'preparing'
      });

      console.log(`Starting deployment of ${policies.length} policies...`);

      // Update progress for policy preparation
      setDeploymentProgress(prev => ({
        ...prev,
        currentStep: 'loading-content',
        currentPolicy: 'Loading policy content...'
      }));

      // Prepare policies for deployment with content and check existing status
      const policiesWithContent = await Promise.all(
        policies.map(async (policy, index) => {
          try {
            // Update progress for current policy being loaded
            setDeploymentProgress(prev => ({
              ...prev,
              currentPolicy: `Loading: ${policy.name}`,
              completed: index,
              currentStep: 'loading-content'
            }));

            // Check if policy already has content (from new deployment) or needs to be loaded (from existing deployment)
            let content;
            if (policy.policy) {
              // Policy already has content loaded (from new deployment flow)
              content = policy.policy;
            } else {
              // Policy needs content loaded from GitHub (from existing deployment flow)
              content = await githubAPI.getPolicyContent(policy);
            }
            
            // Check if policy is already deployed using improved matching
            const existingPolicy = await graphAPI.checkPolicyExists(
              policy.name,
              policy.policyType
            );
            const isDeployed = !!existingPolicy;

            return {
              policy: content,
              type: policy.policyType,
              fileName: policy.fileName,
              name: policy.name,
              originalPolicy: policy,
              isAlreadyDeployed: isDeployed
            };
          } catch (error) {
            console.error(`Failed to get content for ${policy.fileName}:`, error);
            throw new Error(`Failed to prepare policy ${policy.fileName}: ${error.message}`);
          }
        })
      );

      // Check if any selected policies are already deployed and warn user
      const alreadyDeployedPolicies = policiesWithContent.filter(p => p.isAlreadyDeployed);
      if (alreadyDeployedPolicies.length > 0) {
        const deployedNames = alreadyDeployedPolicies.map(p => p.name).join(', ');
        console.warn(`The following policies are already deployed: ${deployedNames}`);
        // Still proceed with deployment but note this in results
      }

      // Apply tenant variable replacement to all policies before deployment
      if (tenantId) {
        console.log(`Applying tenant variable replacement for tenant: ${tenantId}`);
        setDeploymentProgress(prev => ({
          ...prev,
          currentStep: 'preparing-variables',
          currentPolicy: 'Applying tenant variables...'
        }));
        
        policiesWithContent.forEach((policyData, index) => {
          policiesWithContent[index] = applyTenantVariablesToPolicy(policyData, tenantId);
        });
      } else {
        console.warn('No tenant ID available for variable replacement');
      }

      // Update progress for deployment phase
      setDeploymentProgress(prev => ({
        ...prev,
        currentStep: 'deploying',
        currentPolicy: 'Starting deployment...',
        completed: 0
      }));

      // Deploy policies with progress tracking
      const results = await graphAPI.deployPoliciesBatchWithProgress(
        policiesWithContent,
        (completed, total, currentPolicyName) => {
          console.log(`Deployment progress: ${completed}/${total} - ${currentPolicyName}`);
          setDeploymentProgress(prev => ({
            ...prev,
            currentStep: 'deploying',
            currentPolicy: currentPolicyName || 'Deploying policies...',
            completed: completed,
            total: total
          }));
        }
      );
      console.log('Deployment completed, results:', results);
      setDeploymentResults(results);

      // Reset deployment progress
      setDeploymentProgress({
        isDeploying: false,
        currentStep: '',
        currentPolicy: '',
        completed: 0,
        total: 0
      });

      // Update existing policies list to reflect new deployments
      await loadExistingPolicies();

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      console.log(`Deployment completed: ${successCount} successful, ${failureCount} failed`);
      
      if (failureCount > 0) {
        setError(`Deployment completed with ${failureCount} failures. See results for details.`);
      }

      // Keep step as 'deploy' to show results in DeploymentProgress component
      // The component will show actions to go back when showActions is true
    } catch (error) {
      console.error('Deployment failed:', error);
      setError('Deployment failed: ' + error.message);
      setCurrentStep('select');
      
      // Reset deployment progress on error
      setDeploymentProgress({
        isDeploying: false,
        currentStep: '',
        currentPolicy: '',
        completed: 0,
        total: 0
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewDeployment = () => {
    setSelectedPolicies([]);
    setDeploymentResults([]);
    setError(null);
    setShowResultsModal(false);
    setDeploymentType(null);
    setSelectedPolicyTypes([]);
    setSelectedOSTypes([]);
    setCurrentStep('wizard');
    setWizardStep('deployment-type');
  };

  const handleRefreshPolicies = async () => {
    await loadExistingPolicies();
  };

  const handleRefreshGitHubData = async () => {
    // Clear session cache and reload
    sessionStorage.removeItem('oib-latest-data');
    await loadLatestVersionAndPolicies();
  };

  // Debug current state
  console.warn('App render state:', {
    currentStep,
    wizardStep,
    deploymentType,
    isAuthenticated,
    showDocumentation,
    selectedPolicyTypes,
    selectedOSTypes
  });

  return (
    <div className={`app app-step-${currentStep}`}>
      <header className="app-header">
        <div className="header-content">
          <div className="logo">
            <img src={oibLogo} alt="OIB Logo" className="logo-icon" />
            <h1>OIB Deployer</h1>
          </div>
          
          {currentStep === 'homepage' && !isAuthenticated && (
            <div className="nav-buttons">
              <button 
                onClick={() => setShowDocumentation(!showDocumentation)} 
                className="nav-btn"
                title="Documentation & FAQ"
              >
                <BookOpen size={16} />
                {showDocumentation ? 'Back to Home' : 'Help & FAQ'}
              </button>
            </div>
          )}
          
          {!isAuthenticated && currentStep !== 'homepage' && (
            <div className="nav-buttons">
              <button 
                onClick={handleBackToHomepage}
                className="nav-btn"
                title="Back to Homepage"
              >
                <ArrowLeft size={16} />
                Home
              </button>
              <button 
                onClick={() => setShowDocumentation(!showDocumentation)} 
                className="nav-btn"
                title="Documentation & FAQ"
              >
                <BookOpen size={16} />
                {showDocumentation ? 'Back to Login' : 'Help & FAQ'}
              </button>
            </div>
          )}
          
          {isAuthenticated && (
            <div className="user-info">
              <div className="nav-buttons">
                <button 
                  onClick={() => setShowDocumentation(!showDocumentation)} 
                  className="nav-btn"
                  title="Documentation & FAQ"
                >
                  <BookOpen size={16} />
                  {showDocumentation ? 'Back to App' : 'Help & FAQ'}
                </button>
              </div>
              <div className="user-details">
                <span className="user-name">Welcome, {account?.name || account?.username}</span>
                {tenantId && (
                  <span className="tenant-id">
                    Tenant: {getTenantDisplayName(tenantInfo)} 
                    {isValidTenantId(tenantId) && (
                      <span className="tenant-id-full"> ({tenantId})</span>
                    )}
                  </span>
                )}
              </div>
              <button onClick={handleLogout} className="btn btn-secondary">
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="app-main">
        {error && (
          <div className="error-banner">
            <AlertCircle className="error-icon" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="error-dismiss">
              ×
            </button>
          </div>
        )}

        {/* Homepage */}
        {currentStep === 'homepage' && !showDocumentation && (
          <Homepage 
            onGetStarted={handleGetStarted}
            onViewDocumentation={() => setShowDocumentation(true)}
          />
        )}

        {isLoading && currentStep === 'auth' && (
          <div className="loading-screen">
            <Loader className="spinner" />
            <p>Initializing application...</p>
          </div>
        )}

        {currentStep === 'auth' && !isAuthenticated && !isLoading && !showDocumentation && (
          <AuthComponent 
            onLogin={handleLogin} 
            isLoading={isLoading} 
            tenantInfo={tenantInfo}
          />
        )}

        {showDocumentation && (
          <Documentation 
            onBack={() => {
              setShowDocumentation(false);
              if (currentStep === 'homepage') {
                // Stay on homepage when coming from homepage
              }
            }} 
          />
        )}

        {/* Wizard Components */}
        {isAuthenticated && !showDocumentation && currentStep === 'wizard' && wizardStep === 'deployment-type' && (
          <DeploymentTypeWizard 
            onSelectType={handleDeploymentTypeSelection}
          />
        )}

        {isAuthenticated && !showDocumentation && currentStep === 'wizard' && wizardStep === 'policy-types' && (
          <QuickDeployWizard 
            onPolicyTypesSelected={handlePolicyTypesSelection}
            onBack={handleWizardBack}
            selectedVersion={latestVersion}
          />
        )}

        {isAuthenticated && !showDocumentation && currentStep === 'wizard' && wizardStep === 'os-selection' && (
          <OSSelectionWizard 
            onOSSelected={handleOSSelection}
            onBack={handleWizardBack}
            selectedVersion={latestVersion}
          />
        )}

        {isAuthenticated && !showDocumentation && currentStep === 'wizard' && wizardStep === 'comparison-dashboard' && (
          <ComparisonDashboard 
            existingPolicies={existingPolicies}
            availablePolicies={availablePolicies}
            onSelectPolicies={handleComparisonPolicySelection}
            onBack={handleWizardBack}
            onRefresh={handleRefreshGitHubData}
            isLoading={isLoading}
            selectedVersion={latestVersion}
          />
        )}

        {isAuthenticated && !showDocumentation && currentStep === 'wizard' && wizardStep === 'policy-selection' && (
          <div className="main-content">
            <div className="wizard-container">
              <div className="wizard-header">
                <h2>Select Policies to Deploy</h2>
                <p>Choose individual policies from your selected types: {selectedPolicyTypes.join(', ')}</p>
                <p>For OS types: {selectedOSTypes.join(', ')}</p>
                {latestVersion && (
                  <div className="version-info">
                    <span className="version-badge">Version: {latestVersion}</span>
                  </div>
                )}
              </div>
              
              <FilteredPolicySelector
                existingPolicies={existingPolicies}
                onPolicySelection={handlePolicySelection}
                availablePolicies={availablePolicies}
                selectedPolicyTypes={selectedPolicyTypes}
                selectedOSTypes={selectedOSTypes}
                selectedVersion={latestVersion}
                onBack={handleWizardBack}
                onDeploy={handleDeployment}
                isLoading={isLoading}
              />
            </div>
          </div>
        )}

        {isAuthenticated && !showDocumentation && currentStep === 'select' && (
          <div className="main-content">
            <StatusPanel 
              existingPoliciesCount={existingPolicies.length}
              selectedPoliciesCount={selectedPolicies.length}
              onRefresh={handleRefreshPolicies}
              isLoading={isLoading}
            />
            
            <PolicySelector
              existingPolicies={existingPolicies}
              onPolicySelection={handlePolicySelection}
              onDeploy={handleDeployment}
              isLoading={isLoading}
              tenantId={tenantId}
              tenantInfo={tenantInfo}
            />
          </div>
        )}

        {isAuthenticated && !showDocumentation && currentStep === 'deploy' && (
          <DeploymentProgress
            selectedPolicies={selectedPolicies}
            results={deploymentResults}
            isLoading={isLoading}
            showActions={!isLoading && deploymentResults.length > 0}
            onNewDeployment={handleNewDeployment}
          />
        )}
      </main>

      {/* Deployment Results Modal */}
      <DeploymentResultsModal
        isOpen={showResultsModal}
        onClose={() => setShowResultsModal(false)}
        results={deploymentResults}
        selectedPolicies={selectedPolicies}
        onNewDeployment={handleNewDeployment}
      />

      {/* Deployment Progress Overlay */}
      {deploymentProgress.isDeploying && (
        <div className="deployment-progress-overlay">
          <div className="deployment-progress-modal">
            <div className="progress-header">
              <h3>Deploying Policies</h3>
              <div className="progress-stats">
                {deploymentProgress.completed} of {deploymentProgress.total} policies
              </div>
            </div>
            
            <div className="progress-content">
              <div className="progress-bar-container">
                <div 
                  className="progress-bar" 
                  style={{ 
                    width: `${deploymentProgress.total > 0 ? (deploymentProgress.completed / deploymentProgress.total) * 100 : 0}%` 
                  }}
                ></div>
              </div>
              
              <div className="progress-percentage">
                {deploymentProgress.total > 0 ? Math.round((deploymentProgress.completed / deploymentProgress.total) * 100) : 0}%
              </div>
              
              <div className="current-step">
                <strong>
                  {deploymentProgress.currentStep === 'loading' && 'Loading policies...'}
                  {deploymentProgress.currentStep === 'preparing-variables' && 'Preparing tenant variables...'}
                  {deploymentProgress.currentStep === 'deploying' && 'Deploying policies...'}
                </strong>
              </div>
              
              <div className="current-policy">
                {deploymentProgress.currentPolicy}
              </div>
            </div>
            
            <div className="progress-spinner">
              <Loader className="spinner" />
            </div>
          </div>
        </div>
      )}

      <footer className="app-footer">
        <div className="footer-content">
          <p>
            OpenIntuneBaseline Deployer - Deploy standardized Intune policies with ease
          </p>
          <div className="footer-links">
            <a 
              href="https://github.com/SkipToTheEndpoint/OpenIntuneBaseline" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              GitHub Repository
            </a>
            <a 
              href="https://openintunebaseline.com" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              OIB Website
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
