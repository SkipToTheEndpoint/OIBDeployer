import { CONFIG } from './config.js';

class GitHubAPI {
    constructor() {
        this.config = CONFIG.github;
        this.cache = new Map();
        this.rateLimitInfo = {
            remaining: 60, // GitHub allows 60 requests/hour for unauthenticated
            resetTime: null,
            isRateLimited: false
        };
        
        // Lazy loading cache - only load what's needed
        this.lazyCache = {
            directories: new Map(),
            policyFiles: new Map(),
            policies: new Map()
        };
        
        // Policy content cache for downloaded policy JSON data
        this.policyContentCache = new Map();
    }

    // Get cache key for storing API responses
    getCacheKey(endpoint, params = {}) {
        const paramString = Object.keys(params)
            .sort()
            .map(key => `${key}=${params[key]}`)
            .join('&');
        return `${endpoint}${paramString ? '?' + paramString : ''}`;
    }

    // Check if cached data is still valid
    isCacheValid(cacheEntry) {
        if (!this.config.cacheEnabled) return false;
        return Date.now() - cacheEntry.timestamp < this.config.cacheDuration;
    }

    // Wait for rate limit reset if needed
    async waitForRateLimit() {
        if (this.rateLimitInfo.isRateLimited && this.rateLimitInfo.resetTime) {
            const waitTime = this.rateLimitInfo.resetTime - Date.now();
            if (waitTime > 0) {
                console.log(`Rate limited. Waiting ${Math.ceil(waitTime / 1000)} seconds...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                this.rateLimitInfo.isRateLimited = false;
            }
        }
    }

    // Make API request with enhanced rate limiting and error handling
    async makeRequest(endpoint, options = {}) {
        await this.waitForRateLimit();
        
        const cacheKey = this.getCacheKey(endpoint, options.params || {});
        
        // Check cache first
        if (this.config.cacheEnabled) {
            const cached = this.cache.get(cacheKey);
            if (cached && this.isCacheValid(cached)) {
                console.log(`Cache hit for: ${endpoint}`);
                return cached.data;
            }
        }

        const url = `${this.config.apiUrl}${endpoint}`;
        const requestOptions = {
            method: options.method || 'GET',
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'OIBDeployer/1.0',
                ...(this.config.token && { 'Authorization': `token ${this.config.token}` })
            }
        };

        try {
            console.log(`Making GitHub API request: ${url}`);
            const response = await fetch(url, requestOptions);
            
            // Update rate limit info from headers
            this.updateRateLimitInfo(response.headers);
            
            if (!response.ok) {
                if (response.status === 403) {
                    const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
                    if (rateLimitRemaining === '0') {
                        const resetTime = parseInt(response.headers.get('X-RateLimit-Reset')) * 1000;
                        this.rateLimitInfo.isRateLimited = true;
                        this.rateLimitInfo.resetTime = resetTime;
                        throw new Error(`GitHub API rate limit exceeded. Reset at: ${new Date(resetTime).toLocaleTimeString()}`);
                    }
                }
                throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Cache the response
            if (this.config.cacheEnabled) {
                this.cache.set(cacheKey, {
                    data,
                    timestamp: Date.now()
                });
            }
            
            return data;
        } catch (error) {
            console.error(`GitHub API request failed: ${url}`, error);
            throw error;
        }
    }

    // Update rate limit information from response headers
    updateRateLimitInfo(headers) {
        const remaining = headers.get('X-RateLimit-Remaining');
        const reset = headers.get('X-RateLimit-Reset');
        
        if (remaining !== null) {
            this.rateLimitInfo.remaining = parseInt(remaining);
        }
        
        if (reset !== null) {
            this.rateLimitInfo.resetTime = parseInt(reset) * 1000;
        }
    }

    // Get available releases/tags
    async getReleases() {
        try {
            const releases = await this.makeRequest(`/repos/${this.config.owner}/${this.config.repo}/releases`);
            
            // Also get tags for any releases that might not be in the releases API
            const tags = await this.makeRequest(`/repos/${this.config.owner}/${this.config.repo}/tags`);
            
            // Combine and deduplicate
            const allVersions = new Map();
            
            // Add releases
            releases.forEach(release => {
                allVersions.set(release.tag_name, {
                    name: release.tag_name,
                    displayName: release.name || release.tag_name,
                    publishedAt: release.published_at,
                    prerelease: release.prerelease,
                    type: 'release'
                });
            });
            
            // Add tags that aren't already in releases
            tags.forEach(tag => {
                if (!allVersions.has(tag.name)) {
                    allVersions.set(tag.name, {
                        name: tag.name,
                        displayName: tag.name,
                        publishedAt: null,
                        prerelease: false,
                        type: 'tag'
                    });
                }
            });
            
            // Convert to array and sort by name (newest first)
            const sortedVersions = Array.from(allVersions.values())
                .sort((a, b) => {
                    // Try to sort by version number if possible
                    const aVersion = a.name.replace(/^v/, '');
                    const bVersion = b.name.replace(/^v/, '');
                    
                    // Simple version comparison - this could be enhanced
                    return bVersion.localeCompare(aVersion, undefined, { numeric: true });
                });
            
            console.log(`Found ${sortedVersions.length} versions`);
            return sortedVersions;
        } catch (error) {
            console.error('Failed to get releases:', error);
            throw new Error('Failed to fetch available versions from OpenIntuneBaseline repository');
        }
    }

    // Get repository structure for a specific version
    async getRepositoryStructure(version = 'main') {
        const cacheKey = `structure_${version}`;
        
        try {
            const tree = await this.makeRequest(`/repos/${this.config.owner}/${this.config.repo}/git/trees/${version}?recursive=1`);
            
            // Filter and organize by OS
            const structure = {
                WINDOWS: { directories: [], files: [] },
                MACOS: { directories: [], files: [] },
                BYOD: { directories: [], files: [] }
            };
            
            tree.tree.forEach(item => {
                const pathParts = item.path.split('/');
                const osType = pathParts[0];
                
                if (structure[osType]) {
                    if (item.type === 'tree') {
                        structure[osType].directories.push({
                            name: pathParts[pathParts.length - 1],
                            path: item.path,
                            type: this.determinePolicyType(item.path)
                        });
                    } else if (item.path.endsWith('.json')) {
                        structure[osType].files.push({
                            name: pathParts[pathParts.length - 1],
                            path: item.path,
                            download_url: `https://raw.githubusercontent.com/${this.config.owner}/${this.config.repo}/${version}/${item.path}`,
                            type: this.determinePolicyType(item.path)
                        });
                    }
                }
            });
            
            return structure;
        } catch (error) {
            console.error('Failed to get repository structure:', error);
            throw new Error('Failed to load repository structure');
        }
    }

    // Determine policy type from path
    determinePolicyType(path) {
        const pathLower = path.toLowerCase();
        
        // Handle BYOD-specific policies
        if (pathLower.includes('byod')) {
            if (pathLower.includes('appprotection') || pathLower.includes('app-protection')) return 'AppProtectionPolicies';
            return 'BYODPolicies';
        }
        
        if (pathLower.includes('compliancepolicies')) return 'CompliancePolicies';
        if (pathLower.includes('settingscatalog')) return 'SettingsCatalog';
        if (pathLower.includes('configurationpolicies')) return 'ConfigurationPolicies';
        if (pathLower.includes('deviceconfigurations')) return 'DeviceConfigurations';
        if (pathLower.includes('endpointsecurity')) return 'EndpointSecurity';
        if (pathLower.includes('admintemplates')) return 'AdminTemplates';
        if (pathLower.includes('powershellscripts')) return 'PowerShellScripts';
        
        // Handle Update policies (WUfB and WUfB Drivers)
        if (pathLower.includes('driverupdateprofiles')) return 'DriverUpdateProfiles';
        if (pathLower.includes('updatepolicies')) return 'UpdatePolicies';
        
        // Check for Health Monitoring/Endpoint Analytics (Telemetry Policies)
        if (pathLower.includes('health') || pathLower.includes('analytics') || pathLower.includes('telemetry')) return 'TelemetryPolicies';
        
        // Default catch-all for anything under IntuneManagement that doesn't match above
        if (pathLower.includes('intunemanagement')) return 'IntuneManagement';
        
        return 'Unknown';
    }

    // Get policies for a specific OS and version - Enhanced with policy content loading
    async getPoliciesForOS(osType, version = 'main') {
        try {
            // Fetch manifest and repository structure in parallel
            const [structure, manifestData] = await Promise.all([
                this.getRepositoryStructure(version),
                this.getPolicyManifest(osType, version)
            ]);
            const osStructure = structure[osType.toUpperCase()];
            
            if (!osStructure) {
                throw new Error(`Unsupported OS type: ${osType}`);
            }

            // Get all policy files and organize by type
            const policiesByType = {};
            const processedPaths = new Set(); // Track processed paths to avoid duplicates
            
            // Process directories first
            for (const directory of osStructure.directories) {
                if (!policiesByType[directory.type]) {
                    policiesByType[directory.type] = [];
                }
                
                // Get files in this directory
                const dirFiles = await this.getPolicyFilesInDirectory(directory.path, version);
                dirFiles.forEach(file => {
                    const fullPath = `${directory.path}/${file.fileName}`;
                    
                    // Filter out manifest metadata file
                    if (file.fileName === 'PolicyManifest.json') {
                        return;
                    }
                    
                    if (!processedPaths.has(fullPath)) {
                        processedPaths.add(fullPath);
                        policiesByType[directory.type].push({
                            ...file,
                            policyType: directory.type,
                            osType: osType,
                            version: version,
                            path: fullPath // Use the full path from directory
                        });
                    }
                });
            }
            
            // Process individual files (only if not already processed from directories)
            osStructure.files.forEach(file => {
                // Filter out manifest metadata file
                if (file.name === 'PolicyManifest.json') {
                    return;
                }
                
                if (!processedPaths.has(file.path)) {
                    if (!policiesByType[file.type]) {
                        policiesByType[file.type] = [];
                    }
                    
                    processedPaths.add(file.path);
                    policiesByType[file.type].push({
                        name: file.name.replace('.json', ''),
                        fileName: file.name,
                        path: file.path,
                        downloadUrl: file.download_url,
                        policyType: file.type,
                        osType: osType,
                        version: version,
                        isDirectory: false
                    });
                }
            });
            
            // Enrich policies with manifest metadata (oibId, previousVersions, scope, etc.)
            // Enrich with manifest metadata; the manifest policyType is authoritative
            // for categorisation, so also re-bucket policies that the path heuristic
            // placed under the wrong key (e.g. TelemetryPolicies → DeviceConfiguration).
            if (manifestData) {
                const rebucket = {}; // newType → [policy]

                Object.entries(policiesByType).forEach(([currentType, policies]) => {
                    policies.forEach(policy => {
                        const entry = manifestData.byName.get(policy.name);
                        if (entry) {
                            policy.oibId = entry.oibId.toUpperCase();
                            policy.previousVersions = (entry.previousVersions || []).map(id => id.toUpperCase());
                            policy.scope = entry.scope || null;
                            policy.addedIn = entry.addedIn || null;
                            policy.skuRequirements = entry.skuRequirements || null;
                            policy.licenseRequirements = entry.licenseRequirements || null;

                            // Override policyType when the manifest disagrees with the path heuristic
                            if (entry.policyType && entry.policyType !== currentType) {
                                policy.policyType = entry.policyType;
                                if (!rebucket[entry.policyType]) rebucket[entry.policyType] = [];
                                rebucket[entry.policyType].push({ policy, fromType: currentType });
                            }
                        }
                    });
                });

                // Move re-bucketed policies to their correct type keys
                Object.entries(rebucket).forEach(([newType, items]) => {
                    if (!policiesByType[newType]) policiesByType[newType] = [];
                    items.forEach(({ policy, fromType }) => {
                        policiesByType[fromType] = policiesByType[fromType].filter(p => p !== policy);
                        policiesByType[newType].push(policy);
                    });
                });

                // Remove any type buckets that are now empty
                Object.keys(policiesByType).forEach(k => {
                    if (policiesByType[k].length === 0) delete policiesByType[k];
                });
            }

            // Log the results for debugging
            const totalPolicies = Object.values(policiesByType).reduce((sum, policies) => sum + policies.length, 0);
            console.log(`Loaded ${totalPolicies} policies for ${osType} ${version}:`, 
                Object.entries(policiesByType).map(([type, policies]) => `${type}: ${policies.length}`).join(', '));
            
            return policiesByType;
        } catch (error) {
            console.error(`Failed to get policies for ${osType}:`, error);
            throw new Error(`Failed to load policies for ${osType}`);
        }
    }

    // Fetch and cache the PolicyManifest.json for an OS/version (introduced in v3.8)
    // Returns { manifest, byOibId: Map, byName: Map } or null for pre-3.8 branches
    async getPolicyManifest(osType, version = 'main') {
        const cacheKey = `manifest_${osType.toUpperCase()}_${version}`;

        if (this.config.cacheEnabled) {
            const cached = this.policyContentCache.get(cacheKey);
            if (cached && this.isCacheValid(cached)) {
                return cached.data;
            }
        }

        const url = `https://raw.githubusercontent.com/${this.config.owner}/${this.config.repo}/${version}/${osType.toUpperCase()}/PolicyManifest.json`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                console.log(`No PolicyManifest found for ${osType} ${version} (pre-3.8 branch)`);
                return null;
            }

            const manifest = await response.json();

            // Build lookup Maps for O(1) access
            const byOibId = new Map();
            const byName = new Map();
            (manifest.policies || []).forEach(entry => {
                byOibId.set(entry.oibId.toUpperCase(), entry);
                byName.set(entry.name, entry);
            });

            const result = { manifest, byOibId, byName };

            if (this.config.cacheEnabled) {
                this.policyContentCache.set(cacheKey, { data: result, timestamp: Date.now() });
            }

            console.log(`Loaded PolicyManifest for ${osType} ${version}: ${manifest.policies?.length || 0} entries`);
            return result;
        } catch (error) {
            console.warn(`Failed to load PolicyManifest for ${osType} ${version}:`, error);
            return null;
        }
    }

    // Get policy files in a specific directory
    async getPolicyFilesInDirectory(directoryPath, version = 'main') {
        try {
            const tree = await this.makeRequest(`/repos/${this.config.owner}/${this.config.repo}/contents/${directoryPath}?ref=${version}`);
            
            return tree
                .filter(item => item.type === 'file' && item.name.endsWith('.json'))
                .map(file => ({
                    name: file.name.replace('.json', ''),
                    fileName: file.name,
                    path: file.path,
                    downloadUrl: file.download_url,
                    sha: file.sha,
                    isDirectory: false
                }));
        } catch (error) {
            console.error(`Failed to get files in directory ${directoryPath}:`, error);
            return [];
        }
    }

    // Download and cache policy content
    async getPolicyContent(policy) {
        const cacheKey = `content_${policy.path}_${policy.version}`;
        
        // Check cache first
        if (this.config.cacheEnabled) {
            const cached = this.policyContentCache.get(cacheKey);
            if (cached && this.isCacheValid(cached)) {
                console.log(`Cache hit for policy content: ${policy.fileName}`);
                return cached.data;
            }
        }

        try {
            const downloadUrl = new URL(policy.downloadUrl);
            if (!['raw.githubusercontent.com', 'github.com'].includes(downloadUrl.hostname)) {
                throw new Error(`Untrusted download URL for policy: ${policy.fileName}`);
            }
            const response = await fetch(policy.downloadUrl);
            if (!response.ok) {
                throw new Error(`Failed to download policy: ${response.status} ${response.statusText}`);
            }
            
            const content = await response.json();
            
            // Cache the content
            if (this.config.cacheEnabled) {
                this.policyContentCache.set(cacheKey, {
                    data: content,
                    timestamp: Date.now()
                });
            }
            
            console.log(`Downloaded policy content: ${policy.fileName}`);
            return content;
        } catch (error) {
            console.error(`Failed to download policy content for ${policy.fileName}:`, error);
            throw new Error(`Failed to download policy: ${policy.fileName}`);
        }
    }

    // Get policy content with metadata
    async getPolicyWithContent(policy) {
        try {
            const content = await this.getPolicyContent(policy);
            
            return {
                ...policy,
                content: content,
                // Extract the actual policy name from content for better matching
                actualDisplayName: content.displayName || content.name || policy.name,
                hasContent: true
            };
        } catch (error) {
            console.error(`Failed to get content for policy ${policy.fileName}:`, error);
            return {
                ...policy,
                content: null,
                actualDisplayName: policy.name,
                hasContent: false,
                error: error.message
            };
        }
    }

    // Batch download policy contents
    async getPoliciesWithContent(policies, maxConcurrent = 5) {
        const results = [];
        const batches = [];
        
        // Create batches to limit concurrent downloads
        for (let i = 0; i < policies.length; i += maxConcurrent) {
            batches.push(policies.slice(i, i + maxConcurrent));
        }
        
        // Process batches sequentially, but policies within each batch concurrently
        for (const batch of batches) {
            const batchResults = await Promise.allSettled(
                batch.map(policy => this.getPolicyWithContent(policy))
            );
            
            batchResults.forEach(result => {
                if (result.status === 'fulfilled') {
                    results.push(result.value);
                } else {
                    console.error('Failed to get policy with content:', result.reason);
                    // Add placeholder for failed policies
                    results.push({
                        ...batch[batchResults.indexOf(result)],
                        content: null,
                        hasContent: false,
                        error: result.reason?.message || 'Unknown error'
                    });
                }
            });
            
            // Small delay between batches to be nice to the API
            if (batches.indexOf(batch) < batches.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        return results;
    }

    // Get rate limit status
    getRateLimitStatus() {
        return {
            remaining: this.rateLimitInfo.remaining,
            resetTime: this.rateLimitInfo.resetTime,
            isRateLimited: this.rateLimitInfo.isRateLimited,
            resetTimeFormatted: this.rateLimitInfo.resetTime 
                ? new Date(this.rateLimitInfo.resetTime).toLocaleTimeString()
                : null
        };
    }

    // Clear all caches
    clearCache() {
        this.cache.clear();
        this.policyContentCache.clear();
        this.lazyCache.directories.clear();
        this.lazyCache.policyFiles.clear();
        this.lazyCache.policies.clear();
        console.log('GitHub API cache cleared');
    }
}

// Create singleton instance
export const githubAPI = new GitHubAPI();
export default githubAPI;
