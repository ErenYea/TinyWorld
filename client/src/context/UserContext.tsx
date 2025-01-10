import React, { createContext, useState, useContext, ReactNode } from 'react';

interface User {
    username: string;
    email: string;
    // Add other user properties as needed
}

interface UserContextType {
    user: User | null;
    login: (user: User) => void;
    logout: () => void;
    loader: boolean;
    loadLoader: () => void;
    stopLoader: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loader, setLoader] = useState(false);

    const login = (user: User) => {
        // console.log('Login successful:', user);
        setUser(user);
    };

    const logout = () => {
        setUser(null);
    };

    const loadLoader = () => {
        setLoader(true);
    };

    const stopLoader = () => {
        setLoader(false);
    };

    return (
        <UserContext.Provider value={{ user, login, logout, loader, loadLoader, stopLoader }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = (): UserContextType => {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
}; 