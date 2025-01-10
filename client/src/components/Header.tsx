import React from 'react';
import { Link, useLocation } from 'wouter';

export const Header = () => {
    const [location, setLocation] = useLocation();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const onLogout = () => {
        localStorage.removeItem('user');
        setLocation('/login');
    }
    return (
        <header className="flex items-center justify-between p-4 bg-gray-800 text-white sticky inset-0">
            <div className="flex items-center">
                {/* Sample Logo */}
                <img src="/path/to/sample-logo.png" alt="Logo" className="h-8 w-8 mr-2" />
                <span className="text-lg font-bold">MyApp</span>
            </div>
            <div className="flex items-center gap-2">
                {user.email ? (
                    <>
                        <span>Welcome, {user.username}</span>
                        <button
                            onClick={onLogout}
                            className="text-purple-400 hover:underline"
                        >
                            Log out
                        </button>
                    </>
                ) : (
                    <Link to={location === '/login' ? '/signup' : '/login'} className="text-purple-400 hover:underline">
                        {location === '/login' ? 'Sign up' : 'Log in'}
                    </Link>
                )}
            </div>
        </header>
    );
};