import { usePrivy } from '@privy-io/react-auth';
import React from 'react';
import { Link, useLocation } from 'wouter';

export const Header = () => {
    const [location, setLocation] = useLocation();
    const { user, logout, login } = usePrivy();
    // const user = JSON.parse(localStorage.getItem('user') || '{}');
    const onLogout = () => {
        // localStorage.removeItem('user');
        logout();
        setLocation('/');
        // setLocation('/login');
    }

    return (
        <header className="flex items-center justify-between p-4 bg-gray-800 text-white sticky inset-0 z-50">
            <div className="flex items-center">
                {/* Sample Logo */}
                <img src="/path/to/sample-logo.png" alt="Logo" className="h-8 w-8 mr-2" />
                <span className="text-lg font-bold">MyApp</span>
            </div>
            <div className="flex items-center gap-2">
                {user?.email || user?.google ? (
                    <>
                        <span>Welcome, {user?.email?.address || user?.google?.name}</span>
                        <button
                            onClick={onLogout}
                            className="text-purple-400 hover:underline"
                        >
                            Log out
                        </button>
                    </>
                ) : (
                    <button
                        onClick={() => login()}
                        className="text-white bg-purple-500 px-2 py-1 rounded-lg"
                    >
                        {'Log in'}
                    </button>
                )}
            </div>
        </header>
    );
};