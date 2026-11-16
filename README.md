# OIB Deployer - Setup Guide

This document outlines the setup requirements for running OIB Deployer either locally or through self-hosting via GitHub Pages.

## Prerequisites

- Microsoft Entra ID (Azure AD) tenant with administrative access
- Microsoft Intune license
- The latest patched Node.js 22 (22.12 or later), 24, or 26 release and npm

## Azure App Registration Setup

Before running the application, you must create an Entra ID App Registration:

1. Navigate to [Entra Portal](https://entra.microsoft.com/) → **App registrations**
2. Click **New registration**
3. Configure the registration:
   - **Name**: `OIB Deployer` (or your preferred name)
   - **Supported account types**: Accounts in this organizational directory only
   - **Redirect URI**: 
     - For local development: `http://localhost:5173`
     - For GitHub Pages: `https://yourusername.github.io/your-repo-name` or your custom domain
4. Click **Register**
5. Note the **Application (client) ID** - you'll need this for configuration
6. Under **API permissions**, add:
   - **Microsoft Graph**: `DeviceManagementConfiguration.ReadWrite.All` (Delegated permission) — required for the standard policy workflow.
   - **Microsoft Graph**: `DeviceManagementApps.ReadWrite.All` (Delegated permission) — required only for App Protection policies. This can be added and granted in advance, or requested just in time by the application.
   - Grant admin consent for your organization when your tenant requires administrator approval for Intune delegated permissions.
7. Under **Authentication**, click **Add a platform** and select **Single-page application**, then add your redirect URI(s) there (this app uses the authorization code + PKCE flow via MSAL.js, not the legacy implicit grant — do not enable implicit grant tokens)

### App Protection policy permission workflow

OIB Deployer requests the minimum permissions required for the policies selected:

1. Signing in requests `DeviceManagementConfiguration.ReadWrite.All`; App Protection access is not requested at this stage.
2. Select one or more **App Protection** policies. The deployment button changes to **Prompt for Additional Permissions & Deploy**.
3. Selecting that button opens a Microsoft sign-in/consent prompt for `DeviceManagementApps.ReadWrite.All`.
4. After the administrator grants consent, the App Protection policies deploy. The consent is retained by Entra ID, so it is not normally requested again for that user and tenant.

If the tenant requires administrator approval, a user who cannot grant the permission will be shown the organization’s approval flow instead. An Entra administrator can avoid the deployment-time prompt by granting admin consent for `DeviceManagementApps.ReadWrite.All` in advance.

## Local Development Setup

### 1. Clone and Install Dependencies

```bash
git clone https://github.com/yourusername/OIBDeployer.git
cd OIBDeployer
npm install
```

### 2. Environment Configuration

Create a `.env.local` file in the project root:

```env
VITE_ENTRA_CLIENT_ID=your-app-registration-client-id-here
```

Replace `your-app-registration-client-id-here` with the Application (client) ID from your Entra ID App Registration.

Optionally, also set:

```env
VITE_GITHUB_TOKEN=your-github-personal-access-token
```

`VITE_GITHUB_TOKEN` raises the GitHub API rate limit from 60 to 5000 requests/hour (create a token at [github.com/settings/tokens](https://github.com/settings/tokens) with the `public_repo` scope).

### 3. Run Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Self-Hosting Setup (GitHub Pages)

### 1. Fork the Repository

Fork this repository to your GitHub account.

### 2. Configure GitHub Repository Variables

In your forked repository:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click the **Variables** tab
3. Add a new repository variable:
   - **Name**: `ENTRA_CLIENT_ID`
   - **Value**: Your Entra ID App Registration Application (client) ID
4. (Optional) To avoid GitHub API rate limiting during production use, click the **Secrets** tab and add a new repository secret:
   - **Name**: `GH_API_TOKEN`
   - **Value**: A [GitHub personal access token](https://github.com/settings/tokens) with the `public_repo` scope

### 3. Update Entra ID App Registration Redirect URI

Update your Entra ID App Registration redirect URI to match your deployment URL:
- GitHub Pages: `https://yourusername.github.io/repository-name`
- Custom domain: `https://your-custom-domain.com`

### 4. Enable GitHub Pages

1. Go to repository **Settings** → **Pages**
2. Under **Source**, select **GitHub Actions**
3. The deployment workflow will automatically trigger on pushes to the main branch

### 5. Custom Domain (Optional)

If using a custom domain:

1. Add a `CNAME` file to the `public` folder with your domain name
2. Configure DNS to point to GitHub Pages
3. Update the Entra ID App Registration redirect URI accordingly

## Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_ENTRA_CLIENT_ID` | Entra ID App Registration Application (client) ID | Yes |
| `VITE_GITHUB_TOKEN` | GitHub personal access token (`public_repo` scope), raises the GitHub API rate limit from 60 to 5000 requests/hour | No |