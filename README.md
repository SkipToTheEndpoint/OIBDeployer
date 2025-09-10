# OIB Deployer - Setup Guide

This document outlines the setup requirements for running OIB Deployer either locally or through self-hosting via GitHub Pages.

## Prerequisites

- Microsoft Entra ID (Azure AD) tenant with administrative access
- Microsoft Intune license
- Node.js 18+ and npm

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
   - **Microsoft Graph**: `DeviceManagementConfiguration.ReadWrite.All` (Delegated permission)
   - (Optional) Grant admin consent for your organization
7. Under **Authentication** → **Implicit grant and hybrid flows**:
   - Enable **Access tokens**
   - Enable **ID tokens**

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
VITE_ENTRA_TENANT_ID=your-tenant-id-here
```

Replace `your-app-registration-client-id-here` with the Application (client) ID from your Entra ID App Registration. The app is single-tenant by default, so `VITE_ENTRA_TENANT_ID` sets a tenant-specific authority endpoint. You can also set `VITE_CLIENT_ID` for backward compatibility.

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
   - **Name**: `VITE_CLIENT_ID`
   - **Value**: Your Entra ID App Registration Application (client) ID

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
| `VITE_ENTRA_TENANT_ID` | Entra tenant ID for authority (use for single-tenant apps) | Yes (if single-tenant) |
| `VITE_CLIENT_ID` | Back-compat client ID variable | Optional |