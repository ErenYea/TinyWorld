import { useMutation } from '@tanstack/react-query';

async function signup(username: string, email: string, password: string): Promise<{ message: string }> {
    const response = await fetch('/api/signup', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, email, password }),
    });

    if (!response.ok) {
        throw new Error('Signup failed');
    }

    return response.json();
}

export function useSignup() {
    return useMutation<{ message: string }, Error, { username: string; email: string; password: string }>({
        mutationFn: (data) => signup(data.username, data.email, data.password)
    });
}
