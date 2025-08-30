// Configuration for OIB Deployer
export const CONFIG = {
    // MSAL Configuration
    msal: {
        // Prefer VITE_ENTRA_CLIENT_ID, fall back to VITE_CLIENT_ID for compatibility
        clientId: import.meta.env.VITE_ENTRA_CLIENT_ID || import.meta.env.VITE_CLIENT_ID,
        // Use tenant-specific authority when provided to support single-tenant apps
        authority: `https://login.microsoftonline.com/${import.meta.env.VITE_ENTRA_TENANT_ID || 'common'}`,
        redirectUri: window.location.origin, // Dynamic redirect URI
        scopes: [
            'https://graph.microsoft.com/DeviceManagementConfiguration.ReadWrite.All'
        ]
    },

    // GitHub API Configuration
    github: {
        owner: 'SkipToTheEndpoint',
        repo: 'OpenIntuneBaseline',
        apiUrl: 'https://api.github.com',
        // Optional: Add GitHub personal access token for higher rate limits (5000/hour vs 60/hour)
        // Create token at: https://github.com/settings/tokens with 'public_repo' scope
        token: import.meta.env.VITE_GITHUB_TOKEN || undefined, // Use environment variable if available

        // Enhanced caching to reduce API calls
        cacheEnabled: true,
        cacheDuration: 7200000, // 2 hours in milliseconds (increased from 1 hour)

        // Rate limiting configuration
        rateLimiting: {
            maxRetries: 3,
            backoffMultiplier: 2,
            baseDelay: 1000 // 1 second base delay
        }
    },

    // Microsoft Graph API Configuration
    graph: {
        baseUrl: 'https://graph.microsoft.com/beta', // Use Beta by default as Intune functionality is primarily in Beta
        betaUrl: 'https://graph.microsoft.com/beta',
        v1Url: 'https://graph.microsoft.com/v1.0',
        endpoints: {
            // Endpoints validated against IntuneManagement PowerShell module
            // Compliance Policies
            deviceCompliancePolicies: '/deviceManagement/deviceCompliancePolicies',
            compliancePoliciesV2: '/deviceManagement/compliancePolicies',
            complianceScripts: '/deviceManagement/deviceComplianceScripts',

            // Device Configuration
            deviceConfigurations: '/deviceManagement/deviceConfigurations',
            configurationPolicies: '/deviceManagement/configurationPolicies', // Settings Catalog

            // Administrative Templates
            groupPolicyConfigurations: '/deviceManagement/groupPolicyConfigurations',

            // Endpoint Security Policies
            intents: '/deviceManagement/intents',
            templates: '/deviceManagement/templates',

            // Device Compliance Scripts
            deviceHealthScripts: '/deviceManagement/deviceHealthScripts',

            // App Protection Policies
            iosManagedAppProtections: '/deviceAppManagement/iosManagedAppProtections',
            androidManagedAppProtections: '/deviceAppManagement/androidManagedAppProtections',

            // Windows Information Protection
            windowsInformationProtectionPolicies: '/deviceAppManagement/windowsInformationProtectionPolicies',
            mdmWindowsInformationProtectionPolicies: '/deviceAppManagement/mdmWindowsInformationProtectionPolicies',

            // Conditional Access
            conditionalAccessPolicies: '/identity/conditionalAccess/policies',

            // Windows Autopilot
            windowsAutopilotDeploymentProfiles: '/deviceManagement/windowsAutopilotDeploymentProfiles',

            // Apps
            mobileApps: '/deviceAppManagement/mobileApps',
            mobileAppConfigurations: '/deviceAppManagement/mobileAppConfigurations',

            // Update Policies
            windowsFeatureUpdateProfiles: '/deviceManagement/windowsFeatureUpdateProfiles',
            windowsQualityUpdateProfiles: '/deviceManagement/windowsQualityUpdateProfiles',
            windowsDriverUpdateProfiles: '/deviceManagement/windowsDriverUpdateProfiles',

            // Enrollment Configurations
            deviceEnrollmentConfigurations: '/deviceManagement/deviceEnrollmentConfigurations',

            // Terms and Conditions
            termsAndConditions: '/deviceManagement/termsAndConditions',

            // Notification Message Templates
            notificationMessageTemplates: '/deviceManagement/notificationMessageTemplates',

            // Role-based Access Control
            roleDefinitions: '/deviceManagement/roleDefinitions',
            roleAssignments: '/deviceManagement/roleAssignments',

            // Batch requests
            batch: '/$batch'
        },

        // Batch configuration
        batch: {
            maxBatchSize: 20, // Max requests per batch (Microsoft Graph limit is 20)
            maxRetries: 3,
            retryDelay: 1000 // 1 second delay between retries
        }
    },

    // Application settings
    app: {
        name: 'OIB Deployer',
        version: '1.0.0',
        maxConcurrentDeployments: 5,
        defaultPollingInterval: 2000, // 2 seconds

        // UI Configuration
        ui: {
            animationDuration: 300, // milliseconds
            notificationTimeout: 5000, // 5 seconds
            progressUpdateInterval: 100 // 100ms
        }
    }
};

export default CONFIG;
