import React from 'react';
import { createRoot } from 'react-dom/client';
import { broadcastResponseToMainFrame } from '@azure/msal-browser/redirect-bridge';
import App from './App.jsx';

// Authentication responses must be handled before React mounts. For popup requests,
// this broadcasts the response to MSAL's same-origin popup relay; for redirect
// requests, it restores the original navigation.
const authParams = new URLSearchParams(
    window.location.search || window.location.hash.replace(/^#\/?/, '')
);
const isAuthResponse =
    authParams.has('state') &&
    (authParams.has('code') || authParams.has('error'));

if (isAuthResponse) {
    broadcastResponseToMainFrame().catch(error => {
        console.error('Failed to relay authentication response:', error);
    });
} else {
    const container = document.getElementById('root');
    const root = createRoot(container);

    root.render(<App />);
}
