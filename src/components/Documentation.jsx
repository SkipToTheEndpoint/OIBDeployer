import React from 'react';
import { CheckCircle, AlertTriangle, Info, ExternalLink, ArrowLeft, Rocket, HelpCircle, Wrench, Settings, BookOpen } from 'lucide-react';

const Documentation = ({ onBack }) => {
  return (
    <div className="documentation">
      <div className="documentation-header">
        <button onClick={onBack} className="btn btn-secondary back-btn">
          <ArrowLeft size={16} />
          Back to Main
        </button>
        <h1>OIB Deployer - Documentation & FAQ</h1>
      </div>

      <div className="documentation-content">
        {/* Quick Start Guide */}
        <section className="doc-section">
          <h2><Rocket size={22} className="section-icon" /> Quick Start Guide</h2>
          <div className="steps">
            <div className="step">
              <span className="step-number">1</span>
              <div className="step-content">
                <h3>Authentication</h3>
                <p>Click "Sign in with Microsoft" to authenticate with your Entra ID tenant using your Microsoft account.</p>
              </div>
            </div>
            <div className="step">
              <span className="step-number">2</span>
              <div className="step-content">
                <h3>Choose Deployment Type</h3>
                <p>Select "New Deployment" if you're deploying the OIB for the first time.</p>
                <p>Select "Existing Deployment" if you've already deployed the OIB and want to compare it against the latest version, then deploy any missing or outdated policies.</p>
                <p>Select "Policy Validation" to check your already-deployed OIB policies for per-setting configuration drift against the baseline &mdash; this is read-only and makes no changes to your tenant.</p>
              </div>
            </div>
            <div className="step">
              <span className="step-number">3</span>
              <div className="step-content">
                <h3>Select Operating System(s)</h3>
                <p>Select the operating system(s) you want to deploy (e.g., Windows, macOS).</p>
              </div>
            </div>
            <div className="step">
              <span className="step-number">4</span>
              <div className="step-content">
                <h3>Deploy, Compare, or Validate</h3>
                <p><strong>New:</strong> Answer a couple of quick questions about your tenant's licensing and Windows Update strategy (so irrelevant policies can be filtered out), then select and deploy the policies you want.</p>
                <p><strong>Existing:</strong> Compare your tenant against the latest OIB version, then deploy any missing or outdated policies.</p>
                <p><strong>Validation:</strong> Review a per-setting drift report for each matched policy against the OIB baseline.</p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="doc-section">
          <h2><HelpCircle size={22} className="section-icon" /> Frequently Asked Questions</h2>
          
          <div className="faq-item">
            <h3>What is OIB Deployer?</h3>
            <p>
              OIB Deployer is a web-based tool that simplifies the deployment of OpenIntuneBaseline policies to Microsoft Intune tenants. 
              It provides a user-friendly interface to select and deploy standardized security policies without manual configuration.
            </p>
          </div>

          <div className="faq-item">
            <h3>What policies can I deploy?</h3>
            <p>You can deploy various types of policies including:</p>
            <ul>
              <li><strong>Compliance Policies:</strong> Device health, security, and password requirements</li>
              <li><strong>Settings Catalog:</strong> Advanced device configurations and security settings</li>
              <li><strong>Endpoint Security:</strong> Antivirus, firewall, encryption, and attack surface reduction</li>
              <li><strong>Windows Update:</strong> Feature and driver update policies</li>
              <li><strong>Device Configuration:</strong> Basic device settings and restrictions</li>
            </ul>
          </div>

          <div className="faq-item">
            <h3>What permissions do I need?</h3>
            <p>The OIB Deployer Enterprise Application only requires you to have access to the following Graph scope via Delegated permissions:</p>
            <ul>
              <li><code>DeviceManagementConfiguration.ReadWrite.All</code></li>
            </ul>
            <p>If your account has Intune Administrator role (or higher), this will allow the above.</p>
          </div>

          <div className="faq-item">
            <h3>Will this duplicate existing policies?</h3>
            <p>
              The tool primarily matches existing tenant policies using a hidden OIBID reference embedded in the policy description (available on OIB v3.8+ baselines), 
              falling back to name-based matching for older baselines without this metadata. If no match is found and you select the policy anyway, a policy with a 
              duplicate name could be created.
            </p>
          </div>

          <div className="faq-item">
            <h3>Why are some policy types missing or greyed out during New Deployment?</h3>
            <p>
              New Deployment asks a few quick questions about your tenant (Business Premium vs Microsoft 365 E3/E5/E7 licensing, whether Defender for Endpoint is your 
              primary antivirus, and whether you use Autopatch) so it can filter out policies you can't use or that would conflict with your setup:
            </p>
            <ul>
              <li>Policies requiring a Windows Enterprise entitlement (e.g. Driver Update Policies) are greyed out on Business Premium tenants</li>
              <li>Policies requiring Defender for Endpoint are hidden by default if it isn't your primary antivirus</li>
              <li>Update Policies and Driver Update Policies are greyed out if you're using Autopatch, since it manages Windows Update itself</li>
            </ul>
            <p>Individually-gated policies (not whole categories) can still be revealed via the "Show them anyway" toggle if you want to override the recommendation.</p>
          </div>

          <div className="faq-item">
            <h3>What is Policy Validation?</h3>
            <p>
              Policy Validation is a read-only flow that compares each matched policy's individual settings against the OIB baseline, highlighting any drift: 
              mismatched values, settings present in the baseline but missing from the tenant, or extra settings present in the tenant but not the baseline. 
              It currently supports Settings Catalog, Endpoint Security, and Compliance policies. No changes are ever made to your tenant during validation.
            </p>
          </div>

          <div className="faq-item">
            <h3>Will it assign any policies deployed?</h3>
            <p>
              OIB Deployer does not assign any policies after deployment. You will need to manually assign the policies as per OIB guidance
              to appropriate groups in Intune.
            </p>
          </div>

          <div className="faq-item">
            <h3>Can I deploy to production tenants?</h3>
            <div className="warning-box">
              <AlertTriangle size={16} />
              <div>
                <strong>Use with caution:</strong>
                <ul>
                  <li>Always test policies in a development or test tenant first.</li>
                  <li>These are baseline security policies that may impact user experience and device functionality.</li>
                  <li>The OIB was not designed to be assigned to devices previously managed in other ways (e.g. GPO, or using other baseline configurations)</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="faq-item">
            <h3>What happens if deployment fails?</h3>
            <p>
              If a policy fails to deploy, you'll see detailed error information in the results section. 
              Common causes include:
            </p>
            <ul>
              <li>Insufficient permissions</li>
              <li>Policy conflicts with existing configurations</li>
              <li>Network connectivity issues</li>
              <li>Invalid policy content or format</li>
            </ul>
          </div>

          <div className="faq-item">
            <h3>How do I customize policies before deployment?</h3>
            <p>
              Currently, the tool deploys policies as-is from the OpenIntuneBaseline repository. 
              For customization, you can:
            </p>
            <ul>
              <li>Deploy the baseline policies first</li>
              <li>Duplicate the policies in Intune, giving them a customised name</li>
              <li>Modify the duplicated policies as needed</li>
            </ul>
          </div>
        </section>

        {/* Troubleshooting */}
        <section className="doc-section">
          <h2><Wrench size={22} className="section-icon" /> Troubleshooting</h2>
          
          <div className="troubleshoot-item">
            <h3>Authentication Issues</h3>
            <ul>
              <li>Ensure your account has the necessary permissions</li>
              <li>Try logging out and logging back in</li>
              <li>Check if your tenant allows the required Graph API permissions</li>
              <li>Verify that pop-ups are not blocked in your browser</li>
            </ul>
          </div>

          <div className="troubleshoot-item">
            <h3>Policy Deployment Errors</h3>
            <ul>
              <li>Check the browser console for detailed error messages</li>
              <li>Verify your account has write permissions to Intune</li>
              <li>Ensure the policy doesn't conflict with existing configurations</li>
              <li>Try deploying policies one at a time to isolate issues</li>
            </ul>
          </div>

          <div className="troubleshoot-item">
            <h3>Network/Loading Issues</h3>
            <ul>
              <li>Check your internet connection</li>
              <li>Disable VPN if experiencing connection issues</li>
              <li>Clear browser cache and cookies</li>
              <li>Try using a different browser or incognito mode</li>
            </ul>
          </div>
        </section>

        {/* Technical Information */}
        <section className="doc-section">
          <h2><Settings size={22} className="section-icon" /> Technical Information</h2>
          
          <div className="tech-info">
            <h3>Policy Sources</h3>
            <p>
              All policies are loaded automatically from the&nbsp;
              <a href="https://github.com/SkipToTheEndpoint/OpenIntuneBaseline" target="_blank" rel="noopener noreferrer">
                OpenIntuneBaseline GitHub Repo<ExternalLink size={14} /></a> via the GitHub API.
            </p>
          </div>

          <div className="tech-info">
            <h3>Compatibility</h3>
            <p>
              The import functionality is designed to match the behavior of the&nbsp;
              <a href="https://github.com/Micke-K/IntuneManagement" target="_blank" rel="noopener noreferrer">
                IntuneManagement PowerShell module <ExternalLink size={14} />
              </a>, 
              ensuring compatibility with existing workflows and policy formats. Enhanced matching (via OIBID) and licensing-based filtering require a 
              <code>PolicyManifest.json</code> file, only present on OIB v3.8+ branches &mdash; older branches still work via name-based matching, without licensing filters.
            </p>
          </div>

          <div className="tech-info">
            <h3>Data Privacy</h3>
            <p>
              This application runs entirely in your browser. No policy data or tenant information is stored on external servers. 
              Authentication is handled directly through Microsoft's MSAL library, and all API calls go directly to Microsoft Graph.
            </p>
          </div>
        </section>

        {/* Support & Resources */}
        <section className="doc-section">
          <h2><BookOpen size={22} className="section-icon" /> Resources & Support</h2>
          
          <div className="resources">
            <div className="resource-item">
              <h3>Official Documentation</h3>
              <ul>
                <li>
                  <a href="https://github.com/SkipToTheEndpoint/OpenIntuneBaseline" target="_blank" rel="noopener noreferrer">
                    OpenIntuneBaseline Documentation <ExternalLink size={14} />
                  </a>
                </li>
                <li>
                  <a href="https://docs.microsoft.com/en-us/mem/intune/" target="_blank" rel="noopener noreferrer">
                    Microsoft Intune Documentation <ExternalLink size={14} />
                  </a>
                </li>
                <li>
                  <a href="https://docs.microsoft.com/en-us/graph/api/resources/intune-graph-overview" target="_blank" rel="noopener noreferrer">
                    Microsoft Graph Intune API <ExternalLink size={14} />
                  </a>
                </li>
              </ul>
            </div>

            <div className="resource-item">
              <h3>Community</h3>
              <ul>
                <li>
                  <a href="https://discord.com/invite/winadmins" target="_blank" rel="noopener noreferrer">
                    WinAdmins Discord <ExternalLink size={14} />
                  </a>
                </li>
                <li>
                  <a href="https://www.reddit.com/r/Intune/" target="_blank" rel="noopener noreferrer">
                    r/Intune on Reddit <ExternalLink size={14} />
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Version Info */}
        <section className="doc-section version-info">
          <h2><Info size={22} className="section-icon" /> Version Information</h2>
          <div className="info-box">
            <Info size={16} />
            <div>
              <p><strong>OIB Deployer Version:</strong> 1.2.2</p>
              <p><strong>Last Updated:</strong> September 2026</p>
              <p><strong>Compatible with:</strong> OpenIntuneBaseline v3.0+ (OIBID matching and licensing-based filtering require v3.8+)</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Documentation;
