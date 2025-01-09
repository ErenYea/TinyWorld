import { useMutation } from '@tanstack/react-query';

async function login(email: string, password: string): Promise<{ token: string }> {
    const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
        throw new Error('Login failed');
    }

    return response.json();
}

import { UseMutationOptions } from '@tanstack/react-query';

export function useLogin() {
    const mutationOptions: UseMutationOptions<{ token: string }, Error, { email: string; password: string }> = {
        mutationFn: ({ email, password }: { email: string; password: string }) => login(email, password),
    };

    return useMutation(mutationOptions);
}
