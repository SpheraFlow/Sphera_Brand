
import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import CommandPalette from '../components/CommandPalette';
import { Toaster } from 'react-hot-toast';

export default function RootLayout() {
    const location = useLocation();

    // Persistence Logic
    useEffect(() => {
        // Save last route
        if (location.pathname !== '/' && !location.pathname.includes('/login')) {
            localStorage.setItem('lastRoute', location.pathname);
        }

        // Save last clientId if present
        // Note: useParams might be empty here because RootLayout is at top. 
        // But we can parse pathname.
        const match = location.pathname.match(/\/client\/([^/]+)/);
        if (match && match[1]) {
            localStorage.setItem('lastClientId', match[1]);
        }

    }, [location]);

    return (
        <>
            <CommandPalette />
            <Toaster position="top-right" />
            <Outlet />
        </>
    );
}
