import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser';
import { CONFIG } from './config.js';

class AuthService {
    constructor() {
        this.msalInstance = null;
        this.account = null;
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;

        try {
            this.msalInstance = new PublicClientApplication({
                auth: {
                    clientId: CONFIG.msal.clientId,
                    authority: CONFIG.msal.authority,
                    redirectUri: CONFIG.msal.redirectUri,
                    popupRelayUri: CONFIG.msal.popupRelayUri
                },
                cache: {
                    cacheLocation: 'sessionStorage',
                    storeAuthStateInCookie: false
                }
            });

            await this.msalInstance.initialize();
            this.isInitialized = true;
            
            // Handle redirect response
            // In MSAL v5, handleRedirectPromise throws no_token_request_cache_error
            // on normal page loads (no redirect in progress) — treat this as null response.
            let response = null;
            try {
                response = await this.msalInstance.handleRedirectPromise();
            } catch (redirectError) {
                if (redirectError?.errorCode !== 'no_token_request_cache_error') {
                    throw redirectError;
                }
            }

            if (response && response.account) {
                this.account = response.account;
                console.log('Authentication successful after redirect');
            } else {
                // Try to get account from cache
                const accounts = this.msalInstance.getAllAccounts();
                if (accounts.length > 0) {
                    this.account = accounts[0];
                    this.msalInstance.setActiveAccount(this.account);
                    console.log('Account found in cache');
                }
            }
        } catch (error) {
            console.error('Error initializing MSAL:', error);
            throw new Error('Failed to initialize authentication');
        }
    }

    async login() {
        if (!this.isInitialized) {
            throw new Error('Auth service not initialized');
        }

        try {
            // Use redirect flow instead of popup to avoid popup issues
            await this.msalInstance.loginRedirect({
                scopes: CONFIG.msal.scopes
            });
        } catch (error) {
            console.error('Login failed:', error);
            throw new Error('Login failed: ' + error.message);
        }
    }

    async logout() {
        if (!this.isInitialized) return;

        try {
            await this.msalInstance.logoutRedirect({
                account: this.account
            });
            this.account = null;
        } catch (error) {
            console.error('Logout failed:', error);
            throw new Error('Logout failed: ' + error.message);
        }
    }

    // The interactive path must be called directly from a user gesture so browsers
    // allow its popup; otherwise first attempt to use the cached consent silently.
    async ensureScopes(scopes, interactive = false) {
        if (!this.account) {
            throw new Error('No account available');
        }

        const request = { scopes, account: this.account };
        if (interactive) {
            await this.msalInstance.acquireTokenPopup(request);
            return;
        }

        try {
            await this.msalInstance.acquireTokenSilent(request);
        } catch (error) {
            if (!(error instanceof InteractionRequiredAuthError)) {
                throw error;
            }
            await this.msalInstance.acquireTokenPopup(request);
        }
    }

    async getAccessToken(scopes = CONFIG.msal.scopes) {
        if (!this.account) {
            throw new Error('No account available');
        }

        try {
            const response = await this.msalInstance.acquireTokenSilent({
                scopes,
                account: this.account
            });
            
            return response.accessToken;
        } catch (error) {
            // Try interactive token acquisition using redirect
            try {
                await this.msalInstance.acquireTokenRedirect({
                    scopes,
                    account: this.account
                });
                // After redirect, this will be handled by handleRedirectPromise
                return null;
            } catch (interactiveError) {
                console.error('Token acquisition failed:', interactiveError);
                throw new Error('Failed to acquire access token');
            }
        }
    }

    isAuthenticated() {
        return this.account !== null;
    }

    getAccount() {
        return this.account;
    }

    getTenantId() {
        if (!this.account) {
            return null;
        }
        return this.account.tenantId;
    }

    getTenantInfo() {
        if (!this.account) {
            return null;
        }
        
        return {
            tenantId: this.account.tenantId,
            homeAccountId: this.account.homeAccountId,
            username: this.account.username,
            name: this.account.name,
            environment: this.account.environment
        };
    }
}

// Create singleton instance
export const authService = new AuthService();
export default authService;
