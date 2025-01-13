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
                <img src="/logo22.png" alt="Logo" className="h-[30px] w-[100px] mr-2" />
                {/* <span className="text-lg font-bold">Sprout</span> */}
            </div>
            <div className="flex items-center gap-2">
                {user?.email || user?.google || user?.wallet ? (
                    <>
                        {/* <span>Welcome, {user?.email?.address || user?.google?.name}</span> */}
                        {user?.wallet && (
                            <span className='border border-white px-4 py-1 rounded-lg'>
                                {user.wallet.address.slice(0, 6)}......{user.wallet.address.slice(-6)}
                            </span>
                        )}
                        <button
                            onClick={onLogout}
                            className="text-purple-400 hover:underline flex items-center"
                        >
                            <span>Log out</span>
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