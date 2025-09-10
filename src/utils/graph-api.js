import { CONFIG } from './config.js';
import authService from './auth.js';
import logger from './logger.js';

class GraphAPI {
    constructor() {
        this.config = CONFIG.graph;
        this.retryAttempts = this.config.batch.maxRetries;
        this.retryDelay = this.config.batch.retryDelay;
        this.cachedPolicies = null; // Cache for existing policies
    }

    // Replace tenant-specific variables in policy content
    replaceTenantVariables(policyContent, tenantId) {
        if (!policyContent || !tenantId) {
            return policyContent;
        }

        try {
            // Convert to string for replacement if it's an object
            let contentStr = typeof policyContent === 'string' ? 
                policyContent : JSON.stringify(policyContent);
            
            // Replace %OrganizationId% with actual tenant ID (case-insensitive)
            contentStr = contentStr.replace(/%OrganizationId%/gi, tenantId);
            
            // Log if any replacements were made
            if (contentStr.includes(tenantId) && contentStr !== JSON.stringify(policyContent)) {
                logger.debug(`Tenant variable replacement: %OrganizationId% -> ${tenantId}`);
            }
            
            // Parse back to object if original was an object
            return typeof policyContent === 'string' ? 
                contentStr : JSON.parse(contentStr);
                
        } catch (error) {
            logger.error('Error during tenant variable replacement:', error);
            return policyContent; // Return original on error
        }
    }

    // Helper method to get authorization headers
    async getAuthHeaders() {
        const token = await authService.getAccessToken();
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    }

    // Make authenticated request to Microsoft Graph with pagination support
    async makeRequest(endpoint, method = 'GET', body = null) {
        try {
            const url = `${this.config.baseUrl}${endpoint}`;
            logger.debug(`Making Graph API request: ${method} ${endpoint}`);

            const options = {
                method,
                headers: await this.getAuthHeaders()
            };

            if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
                options.body = JSON.stringify(body);
            }

            const response = await this.makeRequestWithRetry(url, options);

            // Handle error responses
            if (!response.ok) {
                const errorText = await response.text();
                logger.error(`Graph API error response: ${response.status} ${response.statusText}`, errorText);
                throw new Error(`Graph API error: ${response.status} ${response.statusText} - ${errorText}`);
            }

            // Handle no content responses
            if (response.status === 204) {
                return null;
            }

            const result = await response.json();
            logger.debug(`Graph API request successful: ${method} ${url}`);
            return result;
        } catch (error) {
            logger.error('Graph API request failed:', error);
            throw error;
        }
    }

    // Make paginated request to handle large datasets
    async makePaginatedRequest(endpoint) {
        try {
            let allResults = [];
            let nextLink = `${this.config.baseUrl}${endpoint}`;
            
            while (nextLink) {
                console.log(`Making paginated Graph API request: ${nextLink}`);
                
                const options = {
                    method: 'GET',
                    headers: await this.getAuthHeaders()
                };

                const response = await this.makeRequestWithRetry(nextLink, options);

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`Graph API error response: ${response.status} ${response.statusText}`, errorText);
                    throw new Error(`Graph API error: ${response.status} ${response.statusText} - ${errorText}`);
                }

                const result = await response.json();
                
                // Add results to our collection
                if (result.value && Array.isArray(result.value)) {
                    allResults = allResults.concat(result.value);
                }

                // Check for next page
                nextLink = result['@odata.nextLink'] || null;
                
                console.log(`Retrieved ${result.value?.length || 0} items, total so far: ${allResults.length}`);
            }

            console.log(`Completed paginated request, total items: ${allResults.length}`);
            return { value: allResults };
        } catch (error) {
            console.error('Paginated Graph API request failed:', error);
            throw error;
        }
    }

    // Make request with retry logic
    async makeRequestWithRetry(url, options, attempt = 1) {
        try {
            const response = await fetch(url, options);
            
            // Handle rate limiting (429) and server errors (5xx)
            if ((response.status === 429 || response.status >= 500) && attempt <= this.retryAttempts) {
                const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
                console.log(`Request failed with status ${response.status}, retrying in ${delay}ms (attempt ${attempt}/${this.retryAttempts})`);
                
                await this.sleep(delay);
                return this.makeRequestWithRetry(url, options, attempt + 1);
            }

            return response;
        } catch (error) {
            if (attempt <= this.retryAttempts) {
                const delay = this.retryDelay * Math.pow(2, attempt - 1);
                console.log(`Request failed with error, retrying in ${delay}ms (attempt ${attempt}/${this.retryAttempts}):`, error.message);
                
                await this.sleep(delay);
                return this.makeRequestWithRetry(url, options, attempt + 1);
            }
            
            throw error;
        }
    }

    // Sleep utility for retry delays
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Get all policies from tenant for comparison
    async getAllPolicies() {
        try {
            console.log('Starting to fetch all policies from tenant...');
            
            const results = await Promise.allSettled([
                this.getDeviceCompliancePolicies(),
                this.getDeviceConfigurations(),
                this.getConfigurationPolicies(),
                this.getEndpointSecurityPolicies(),
                this.getAdministrativeTemplates(),
                this.getUpdatePolicies()
            ]);

            // Process results and log any failures
            const [
                compliancePoliciesResult,
                deviceConfigurationsResult,
                configurationPoliciesResult,
                endpointSecurityPoliciesResult,
                adminTemplatesResult,
                updatePoliciesResult
            ] = results;

            const compliancePolicies = compliancePoliciesResult.status === 'fulfilled' 
                ? compliancePoliciesResult.value 
                : [];
            const deviceConfigurations = deviceConfigurationsResult.status === 'fulfilled' 
                ? deviceConfigurationsResult.value 
                : [];
            const configurationPolicies = configurationPoliciesResult.status === 'fulfilled' 
                ? configurationPoliciesResult.value 
                : [];
            const endpointSecurityPolicies = endpointSecurityPoliciesResult.status === 'fulfilled' 
                ? endpointSecurityPoliciesResult.value 
                : [];
            const adminTemplates = adminTemplatesResult.status === 'fulfilled' 
                ? adminTemplatesResult.value 
                : [];
            const updatePolicies = updatePoliciesResult.status === 'fulfilled' 
                ? updatePoliciesResult.value 
                : [];

            // Log results for debugging
            console.log(`Policy fetch results:
                - Compliance Policies: ${compliancePoliciesResult.status === 'fulfilled' ? `${compliancePolicies.length} loaded` : `Failed: ${compliancePoliciesResult.reason}`}
                - Device Configurations: ${deviceConfigurationsResult.status === 'fulfilled' ? `${deviceConfigurations.length} loaded` : `Failed: ${deviceConfigurationsResult.reason}`}
                - Configuration Policies (Settings Catalog): ${configurationPoliciesResult.status === 'fulfilled' ? `${configurationPolicies.length} loaded` : `Failed: ${configurationPoliciesResult.reason}`}
                - Endpoint Security Policies: ${endpointSecurityPoliciesResult.status === 'fulfilled' ? `${endpointSecurityPolicies.length} loaded` : `Failed: ${endpointSecurityPoliciesResult.reason}`}
                - Administrative Templates: ${adminTemplatesResult.status === 'fulfilled' ? `${adminTemplates.length} loaded` : `Failed: ${adminTemplatesResult.reason}`}
                - Update Policies: ${updatePoliciesResult.status === 'fulfilled' ? `${updatePolicies.length} loaded` : `Failed: ${updatePoliciesResult.reason}`}`);

            // Combine all policies with consistent naming
            const allPolicies = [];
            
            // Add compliance policies
            compliancePolicies.forEach(policy => {
                allPolicies.push({
                    id: policy.id,
                    displayName: policy.displayName,
                    type: 'compliance',
                    policy: policy
                });
            });

            // Add device configurations
            deviceConfigurations.forEach(policy => {
                allPolicies.push({
                    id: policy.id,
                    displayName: policy.displayName,
                    type: 'deviceConfiguration',
                    policy: policy
                });
            });

            // Add configuration policies (Settings Catalog)
            configurationPolicies.forEach(policy => {
                allPolicies.push({
                    id: policy.id,
                    displayName: policy.name, // Settings Catalog uses 'name' instead of 'displayName'
                    type: 'configurationPolicy',
                    policy: policy
                });
            });

            // Add endpoint security policies
            endpointSecurityPolicies.forEach(policy => {
                allPolicies.push({
                    id: policy.id,
                    displayName: policy.displayName,
                    type: 'endpointSecurity',
                    policy: policy
                });
            });

            // Add administrative templates
            adminTemplates.forEach(policy => {
                allPolicies.push({
                    id: policy.id,
                    displayName: policy.displayName,
                    type: 'adminTemplate',
                    policy: policy
                });
            });

            // Add update policies
            updatePolicies.forEach(policy => {
                allPolicies.push({
                    id: policy.id,
                    displayName: policy.displayName,
                    type: 'updatePolicy',
                    policy: policy
                });
            });

            console.log(`Retrieved ${allPolicies.length} existing policies from tenant`);
            
            // Cache the results
            this.cachedPolicies = allPolicies;
            
            return allPolicies;
        } catch (error) {
            console.error('Failed to get all policies:', error);
            throw new Error('Failed to retrieve existing policies from tenant');
        }
    }

    // Check if a policy exists by name - with improved matching logic
    isPolicyDeployed(policyName, policyContent, existingPolicies) {
        if (!existingPolicies || !Array.isArray(existingPolicies)) {
            return false;
        }

        // Try multiple name sources for matching
        const namesToCheck = [
            policyName, // Name from filename
            policyContent?.displayName, // displayName from policy content
            policyContent?.name, // name from policy content (Settings Catalog)
        ].filter(name => name && typeof name === 'string');

        // Remove duplicates
        const uniqueNames = [...new Set(namesToCheck)];

        // Check against existing policies
        return existingPolicies.some(existing => {
            const existingName = existing.displayName;
            return uniqueNames.some(nameToCheck => 
                nameToCheck === existingName
            );
        });
    }

    // Check if a policy exists and return the policy object if found
    async checkPolicyExists(policyName, policyType) {
        try {
            console.log(`Checking if policy exists: ${policyName} (${policyType})`);
            
            // Get all existing policies if not already loaded
            if (!this.cachedPolicies) {
                this.cachedPolicies = await this.getAllPolicies();
            }

            // Filter policies by type and name
            const existingPolicy = this.cachedPolicies.find(policy => {
                const matchesName = policy.displayName === policyName;
                const matchesType = this.getPolicyTypeFromObject(policy) === policyType;
                return matchesName && matchesType;
            });

            if (existingPolicy) {
                console.log(`Policy exists: ${policyName}`);
                return existingPolicy;
            } else {
                console.log(`Policy not found: ${policyName}`);
                return null;
            }
        } catch (error) {
            console.error(`Error checking if policy exists: ${error.message}`);
            return null;
        }
    }

    // Helper method to determine policy type from policy object
    getPolicyTypeFromObject(policy) {
        if (policy.type) {
            // Convert our internal type naming to the expected format
            switch (policy.type) {
                case 'compliance':
                    return 'CompliancePolicies';
                case 'deviceConfiguration':
                    return 'DeviceConfigurations';
                case 'configurationPolicy':
                    return 'SettingsCatalog';
                case 'endpointSecurity':
                    return 'EndpointSecurity';
                case 'adminTemplate':
                    return 'AdminTemplates';
                case 'updatePolicy':
                    return 'UpdatePolicies';
                default:
                    return policy.type;
            }
        }
        return 'Unknown';
    }

    // Get all device compliance policies
    async getDeviceCompliancePolicies() {
        try {
            console.log('Fetching device compliance policies...');
            const response = await this.makePaginatedRequest(this.config.endpoints.deviceCompliancePolicies);
            const policies = response.value || [];
            console.log(`Successfully fetched ${policies.length} device compliance policies`);
            return policies;
        } catch (error) {
            console.error('Failed to get compliance policies:', error);
            throw new Error(`Failed to retrieve compliance policies from tenant: ${error.message}`);
        }
    }

    // Get all device configuration policies
    async getDeviceConfigurations() {
        try {
            console.log('Fetching device configuration policies...');
            const response = await this.makePaginatedRequest(this.config.endpoints.deviceConfigurations);
            const policies = response.value || [];
            console.log(`Successfully fetched ${policies.length} device configuration policies`);
            return policies;
        } catch (error) {
            console.error('Failed to get device configurations:', error);
            throw new Error(`Failed to retrieve device configurations from tenant: ${error.message}`);
        }
    }

    // Get all configuration policies (Settings Catalog)
    async getConfigurationPolicies() {
        try {
            console.log('Fetching configuration policies (Settings Catalog)...');
            const response = await this.makePaginatedRequest(this.config.endpoints.configurationPolicies);
            const policies = response.value || [];
            console.log(`Successfully fetched ${policies.length} configuration policies (Settings Catalog)`);
            return policies;
        } catch (error) {
            console.error('Failed to get configuration policies:', error);
            throw new Error(`Failed to retrieve configuration policies from tenant: ${error.message}`);
        }
    }

    // Get all endpoint security policies (intents)
    async getEndpointSecurityPolicies() {
        try {
            console.log('Fetching endpoint security policies...');
            const response = await this.makePaginatedRequest(this.config.endpoints.intents);
            const policies = response.value || [];
            console.log(`Successfully fetched ${policies.length} endpoint security policies`);
            return policies;
        } catch (error) {
            console.error('Failed to get endpoint security policies:', error);
            throw new Error(`Failed to retrieve endpoint security policies from tenant: ${error.message}`);
        }
    }

    // Get administrative templates (Group Policy)
    async getAdministrativeTemplates() {
        try {
            console.log('Fetching administrative templates...');
            const response = await this.makePaginatedRequest(this.config.endpoints.groupPolicyConfigurations);
            const policies = response.value || [];
            console.log(`Successfully fetched ${policies.length} administrative templates`);
            return policies;
        } catch (error) {
            console.error('Failed to get administrative templates:', error);
            throw new Error(`Failed to retrieve administrative templates from tenant: ${error.message}`);
        }
    }

    // Get all update policies (Windows Update for Business)
    async getUpdatePolicies() {
        try {
            console.log('Fetching update policies...');
            const [featureUpdatesResponse, qualityUpdatesResponse, driverUpdatesResponse] = await Promise.allSettled([
                this.makePaginatedRequest(this.config.endpoints.windowsFeatureUpdateProfiles),
                this.makePaginatedRequest(this.config.endpoints.windowsQualityUpdateProfiles),
                this.makePaginatedRequest(this.config.endpoints.windowsDriverUpdateProfiles)
            ]);

            const featureUpdates = featureUpdatesResponse.status === 'fulfilled' 
                ? featureUpdatesResponse.value.value || [] 
                : [];
            const qualityUpdates = qualityUpdatesResponse.status === 'fulfilled' 
                ? qualityUpdatesResponse.value.value || [] 
                : [];
            const driverUpdates = driverUpdatesResponse.status === 'fulfilled' 
                ? driverUpdatesResponse.value.value || [] 
                : [];

            const allUpdatePolicies = [...featureUpdates, ...qualityUpdates, ...driverUpdates];
            console.log(`Successfully fetched ${allUpdatePolicies.length} update policies (${featureUpdates.length} feature, ${qualityUpdates.length} quality, ${driverUpdates.length} driver)`);
            return allUpdatePolicies;
        } catch (error) {
            console.error('Failed to get update policies:', error);
            throw new Error(`Failed to retrieve update policies from tenant: ${error.message}`);
        }
    }

    // Transform policy content for import based on type
    transformPolicyForImport(policyContent, policyType, tenantId = null) {
        if (!policyContent || typeof policyContent !== 'object') {
            throw new Error('Invalid policy content provided');
        }

        // Get tenant ID if not provided
        const currentTenantId = tenantId || authService.getTenantId();

        // Create a deep copy to avoid modifying original
        const transformedPolicy = JSON.parse(JSON.stringify(policyContent));

        // Remove properties that shouldn't be included in import
        const propsToRemove = [
            'id', 'createdDateTime', 'lastModifiedDateTime', 
            'creationSource', 'version', 'supportsScopeTags',
            'roleScopeTagIds', 'isAssigned'
        ];

        propsToRemove.forEach(prop => {
            if (transformedPolicy.hasOwnProperty(prop)) {
                delete transformedPolicy[prop];
            }
        });

        // Handle different policy types
        switch (policyType) {
            case 'ConfigurationPolicies':
            case 'SettingsCatalog':
                return this.transformConfigurationPolicyForImport(transformedPolicy, currentTenantId);
            
            case 'CompliancePolicies':
                return this.transformCompliancePolicyForImport(transformedPolicy, currentTenantId);
            
            case 'DeviceConfigurations':
                return this.transformDeviceConfigurationForImport(transformedPolicy, currentTenantId);
            
            case 'EndpointSecurity':
                return this.transformEndpointSecurityPolicyForImport(transformedPolicy, currentTenantId);
            
            case 'AdminTemplates':
                return this.transformAdminTemplateForImport(transformedPolicy, currentTenantId);
            
            case 'UpdatePolicies':
                // Check if this is a legacy WUfB device configuration
                if (transformedPolicy['@odata.type'] && 
                    transformedPolicy['@odata.type'].includes('windowsUpdateForBusinessConfiguration')) {
                    // Use device configuration transformation for legacy WUfB policies
                    console.log('Using device configuration transformation for legacy WUfB policy');
                    return this.transformDeviceConfigurationForImport(transformedPolicy, currentTenantId);
                } else {
                    // Use update policy transformation for modern update profiles
                    return this.transformUpdatePolicyForImport(transformedPolicy, currentTenantId);
                }
            
            default:
                console.warn(`Unknown policy type: ${policyType}, applying generic transformation`);
                return transformedPolicy;
        }
    }

    // Transform Settings Catalog/Configuration Policies - FIXED to preserve main @odata.type
    transformConfigurationPolicyForImport(policy, tenantId = null) {
        let transformed = { ...policy };

        // Apply tenant variable replacement first
        if (tenantId) {
            transformed = this.replaceTenantVariables(transformed, tenantId);
        }

        // Remove @odata annotation properties but preserve the main @odata.type
        Object.keys(transformed).forEach(key => {
            if (key.includes('@odata') && key !== '@odata.type') {
                delete transformed[key];
            }
        });

        // Clean up settings if they exist
        if (transformed.settings && Array.isArray(transformed.settings)) {
            transformed.settings = transformed.settings.map(setting => {
                const cleanSetting = { ...setting };
                
                // Remove @odata annotation properties from settings but preserve main @odata.type
                Object.keys(cleanSetting).forEach(key => {
                    if (key.includes('@odata') && key !== '@odata.type') {
                        delete cleanSetting[key];
                    }
                });

                // Clean up settingInstance if it exists
                if (cleanSetting.settingInstance) {
                    Object.keys(cleanSetting.settingInstance).forEach(key => {
                        if (key.includes('@odata') && key !== '@odata.type') {
                            delete cleanSetting.settingInstance[key];
                        }
                    });
                }

                return cleanSetting;
            });
        }

        return transformed;
    }

    // Transform Compliance Policies
    transformCompliancePolicyForImport(policy, tenantId = null) {
        let transformed = { ...policy };

        // Apply tenant variable replacement first
        if (tenantId) {
            transformed = this.replaceTenantVariables(transformed, tenantId);
        }

        // Remove compliance-specific properties but keep scheduledActionsForRule
        const compliancePropsToRemove = [
            'deviceStatuses', 'userStatuses', 'deviceStatusOverview',
            'userStatusOverview', 'assignments'
        ];

        compliancePropsToRemove.forEach(prop => {
            if (transformed.hasOwnProperty(prop)) {
                delete transformed[prop];
            }
        });

        // Handle scheduledActionsForRule - required for compliance policies
        if (transformed.scheduledActionsForRule && Array.isArray(transformed.scheduledActionsForRule)) {
            // Clean up existing scheduledActionsForRule
            transformed.scheduledActionsForRule = transformed.scheduledActionsForRule.map(rule => {
                const cleanRule = { ...rule };
                
                // Remove @odata properties except @odata.type
                Object.keys(cleanRule).forEach(key => {
                    if (key.includes('@odata') && key !== '@odata.type') {
                        delete cleanRule[key];
                    }
                });

                // Clean up scheduledActionConfigurations
                if (cleanRule.scheduledActionConfigurations && Array.isArray(cleanRule.scheduledActionConfigurations)) {
                    cleanRule.scheduledActionConfigurations = cleanRule.scheduledActionConfigurations.map(config => {
                        const cleanConfig = { ...config };
                        
                        // Remove @odata properties except @odata.type
                        Object.keys(cleanConfig).forEach(key => {
                            if (key.includes('@odata') && key !== '@odata.type') {
                                delete cleanConfig[key];
                            }
                        });

                        // Remove id and other properties that shouldn't be in creation
                        delete cleanConfig.id;

                        return cleanConfig;
                    });
                }

                // Remove id and other properties that shouldn't be in creation
                delete cleanRule.id;

                return cleanRule;
            });
        } else {
            // Add default scheduledActionsForRule if missing - required by Microsoft Graph
            console.log('Adding default scheduledActionsForRule for compliance policy');
            transformed.scheduledActionsForRule = [
                {
                    "@odata.type": "#microsoft.graph.deviceComplianceScheduledActionForRule",
                    "ruleName": null,
                    "scheduledActionConfigurations": [
                        {
                            "@odata.type": "#microsoft.graph.deviceComplianceActionItem",
                            "gracePeriodHours": 12,
                            "actionType": "block",
                            "notificationTemplateId": "00000000-0000-0000-0000-000000000000",
                            "notificationMessageCCList": []
                        }
                    ]
                }
            ];
        }

        return transformed;
    }

    // Transform Device Configuration Policies
    transformDeviceConfigurationForImport(policy, tenantId = null) {
        let transformed = { ...policy };

        // Apply tenant variable replacement first
        if (tenantId) {
            transformed = this.replaceTenantVariables(transformed, tenantId);
        }

        // Remove device configuration specific properties
        const deviceConfigPropsToRemove = [
            'deviceStatuses', 'userStatuses', 'deviceStatusOverview',
            'userStatusOverview', 'assignments', 'deviceSettingStateSummaries'
        ];

        deviceConfigPropsToRemove.forEach(prop => {
            if (transformed.hasOwnProperty(prop)) {
                delete transformed[prop];
            }
        });

        return transformed;
    }

    // Transform Endpoint Security Policies
    transformEndpointSecurityPolicyForImport(policy, tenantId = null) {
        let transformed = { ...policy };

        // Apply tenant variable replacement first
        if (tenantId) {
            transformed = this.replaceTenantVariables(transformed, tenantId);
        }

        // Remove endpoint security specific properties
        const endpointSecurityPropsToRemove = [
            'templateId', 'intentSettings', 'assignments'
        ];

        endpointSecurityPropsToRemove.forEach(prop => {
            if (transformed.hasOwnProperty(prop)) {
                delete transformed[prop];
            }
        });

        return transformed;
    }

    // Transform Administrative Template Policies
    transformAdminTemplateForImport(policy, tenantId = null) {
        let transformed = { ...policy };

        // Apply tenant variable replacement first
        if (tenantId) {
            transformed = this.replaceTenantVariables(transformed, tenantId);
        }

        // Remove admin template specific properties
        const adminTemplatePropsToRemove = [
            'assignments', 'groupAssignments'
        ];

        adminTemplatePropsToRemove.forEach(prop => {
            if (transformed.hasOwnProperty(prop)) {
                delete transformed[prop];
            }
        });

        return transformed;
    }

    // Transform Update Policies (WUfB, Driver Updates, etc.)
    transformUpdatePolicyForImport(policy, tenantId = null) {
        let transformed = { ...policy };

        // Apply tenant variable replacement first
        if (tenantId) {
            transformed = this.replaceTenantVariables(transformed, tenantId);
        }

        // Remove update policy specific properties that shouldn't be included in creation
        const updatePropsToRemove = [
            'assignments', 'groupAssignments', 'id', 'createdDateTime', 'lastModifiedDateTime'
        ];

        updatePropsToRemove.forEach(prop => {
            if (transformed.hasOwnProperty(prop)) {
                delete transformed[prop];
            }
        });

        // Handle legacy windowsUpdateForBusinessConfiguration policies
        if (transformed['@odata.type'] && transformed['@odata.type'].includes('windowsUpdateForBusinessConfiguration')) {
            // These are device configuration policies, not the newer update profile format
            // Keep the @odata.type as-is for device configuration endpoint
            console.log('Detected legacy WUfB device configuration policy');
        }

        return transformed;
    }

    // Deploy a single policy
    async deployPolicy(policyData) {
        try {
            const { policy, type, fileName } = policyData;
            let endpoint = '';
            let transformedPolicy = this.transformPolicyForImport(policy, type);

            // Determine the correct endpoint based on policy type
            switch (type) {
                case 'CompliancePolicies':
                    endpoint = this.config.endpoints.deviceCompliancePolicies;
                    break;
                case 'SettingsCatalog':
                case 'ConfigurationPolicies':
                    endpoint = this.config.endpoints.configurationPolicies;
                    break;
                case 'DeviceConfigurations':
                    endpoint = this.config.endpoints.deviceConfigurations;
                    break;
                case 'EndpointSecurity':
                    endpoint = this.config.endpoints.intents;
                    break;
                case 'AdminTemplates':
                    endpoint = this.config.endpoints.groupPolicyConfigurations;
                    break;
                case 'UpdatePolicies':
                    // Determine the correct endpoint based on policy content and @odata.type
                    endpoint = this.determineUpdatePolicyEndpoint(transformedPolicy);
                    break;
                default:
                    throw new Error(`Unsupported policy type: ${type}`);
            }

            console.log(`Deploying ${type} policy: ${fileName}`);
            const result = await this.makeRequest(endpoint, 'POST', transformedPolicy);
            
            return {
                success: true,
                policyId: result.id,
                policyName: transformedPolicy.displayName || transformedPolicy.name || fileName,
                fileName: fileName,
                message: `Successfully deployed: ${transformedPolicy.displayName || transformedPolicy.name || fileName}`,
                result: result
            };
        } catch (error) {
            console.error(`Failed to deploy policy ${policyData.fileName}:`, error);
            return {
                success: false,
                policyName: policyData.fileName || policyData.name || 'Unknown Policy',
                fileName: policyData.fileName,
                message: `Failed to deploy ${policyData.fileName}: ${error.message}`,
                error: error
            };
        }
    }

    // Deploy policies with progress tracking
    async deployPoliciesBatchWithProgress(policiesData, progressCallback) {
        const results = [];
        const total = policiesData.length;
        console.log(`Starting deployment of ${total} policies...`);
        
        for (let i = 0; i < policiesData.length; i++) {
            const policyData = policiesData[i];
            const policyName = policyData.fileName || policyData.displayName || 'Unknown Policy';
            
            console.log(`Deploying policy ${i + 1}/${total}: ${policyName}`);
            
            // Update progress
            if (progressCallback) {
                progressCallback(i, total, policyName);
            }
            
            // Deploy policy - this function returns a result object, doesn't throw
            const result = await this.deployPolicy(policyData);
            console.log(`Policy ${policyName} deployment result:`, result);
            
            // Add the result with index for UI matching
            results.push({
                ...result,
                index: i, // Add index for DeploymentProgress component matching
                message: result.message || (result.success ? 
                    `Successfully deployed: ${result.policyName}` : 
                    `Failed to deploy: ${result.policyName || policyName}`)
            });
        }
        
        // Final progress update
        if (progressCallback) {
            progressCallback(total, total, 'Deployment complete');
        }
        
        console.log(`Deployment batch completed. Total results: ${results.length}`);
        return results;
    }

    // Deploy multiple policies using batch requests
    async deployPoliciesBatch(policies) {
        const results = [];
        const batchSize = this.config.batch.maxBatchSize;

        // Process policies in batches
        for (let i = 0; i < policies.length; i += batchSize) {
            const batch = policies.slice(i, i + batchSize);
            const batchResults = await Promise.allSettled(
                batch.map(policy => this.deployPolicy(policy))
            );

            // Process batch results
            batchResults.forEach((result, index) => {
                const originalIndex = i + index;
                if (result.status === 'fulfilled') {
                    results.push({
                        index: originalIndex,
                        ...result.value
                    });
                } else {
                    results.push({
                        index: originalIndex,
                        success: false,
                        message: `Batch deployment failed: ${result.reason?.message || 'Unknown error'}`,
                        error: result.reason
                    });
                }
            });

            // Add delay between batches to avoid rate limiting
            if (i + batchSize < policies.length) {
                await this.sleep(1000);
            }
        }

        return results;
    }

    // Helper method to determine the correct endpoint for update policies
    determineUpdatePolicyEndpoint(policy) {
        const odataType = policy['@odata.type'];
        
        if (odataType) {
            // Check for driver update profile (modern format)
            if (odataType.includes('windowsDriverUpdateProfile')) {
                console.log('Detected driver update profile - using driver endpoint');
                return this.config.endpoints.windowsDriverUpdateProfiles;
            }
            
            // Check for feature update profile (modern format)
            if (odataType.includes('windowsFeatureUpdateProfile')) {
                console.log('Detected feature update profile - using feature endpoint');
                return this.config.endpoints.windowsFeatureUpdateProfiles;
            }
            
            // Check for quality update profile (modern format)
            if (odataType.includes('windowsQualityUpdateProfile')) {
                console.log('Detected quality update profile - using quality endpoint');
                return this.config.endpoints.windowsQualityUpdateProfiles;
            }
            
            // Legacy WUfB configuration (these are device configurations, not update profiles)
            if (odataType.includes('windowsUpdateForBusinessConfiguration')) {
                console.log('Detected legacy WUfB device configuration - using device configuration endpoint');
                return this.config.endpoints.deviceConfigurations;
            }
        }
        
        // Fallback logic based on display name if @odata.type is not clear
        const displayName = (policy.displayName || policy.name || '').toLowerCase();
        
        if (displayName.includes('driver')) {
            console.log('Detected driver policy by name - using driver endpoint');
            return this.config.endpoints.windowsDriverUpdateProfiles;
        }
        
        if (displayName.includes('feature') || displayName.includes('version')) {
            console.log('Detected feature policy by name - using feature endpoint');
            return this.config.endpoints.windowsFeatureUpdateProfiles;
        }
        
        // Default to device configurations for legacy WUfB policies
        console.log('Defaulting to device configuration endpoint for update policy');
        return this.config.endpoints.deviceConfigurations;
    }
}

// Create singleton instance
export const graphAPI = new GraphAPI();
export default graphAPI;
