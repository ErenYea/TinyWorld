import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Card } from "./ui/card";
import { useLogin } from '../hooks/use-login';
import { useUser } from "@/context/UserContext";
import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { usePrivy } from "@privy-io/react-auth";


const loginSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormData = z.infer<typeof loginSchema>;


export function Login() {
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const form = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: "",
            password: "",
        },
    });
    const { user, login } = usePrivy();

    const loginMutation = useLogin();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const onSubmit = (data: LoginFormData) => {
        setErrorMessage(null); // Reset error message on new submit
        loginMutation.mutate(data, {
            onSuccess: (response) => {
                console.log('Login success:', response);
                toast({
                    title: "Login Success",
                    description: "You are now logged in",
                    variant: "default",
                });
                localStorage.setItem('user', JSON.stringify(response.user));
                setLocation("/");
            },
            onError: (error) => {
                console.error('Login error:', error);
                toast({
                    title: "Login Error",
                    description: "Login failed. Please check your credentials and try again.",
                    variant: "destructive",
                });
                setErrorMessage('Login failed. Please check your credentials and try again.');
            },
        });
    };
    useEffect(() => {
        login();
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center bg-black text-white p-4">
            <div className="w-full max-w-lg mx-auto">



                {/* Left Column - Wider */}
                <div className="col-span-5 space-y-6">
                    <Card className="p-6 bg-gray-900/50 border-purple-500/30">
                        <div>
                            <h2 className="text-xl font-semibold mb-4 text-purple-400">Login</h2>

                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="email"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Email</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        {...field}
                                                        className="bg-gray-800 border-purple-500/30"
                                                        type="email"
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="password"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Password</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        {...field}
                                                        className="bg-gray-800 border-purple-500/30"
                                                        type="password"
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <div className="text-center mb-4">
                                        <p className="text-sm text-gray-400">
                                            Don't have an account? <Link href="/signup" className="text-purple-400 hover:underline">Sign up</Link>
                                        </p>
                                    </div>

                                    <Button
                                        type="submit"
                                        className="w-full bg-purple-600 hover:bg-purple-700"
                                        disabled={loginMutation.status === 'pending'}
                                    >
                                        {loginMutation.status === 'pending' ? 'Logging in...' : 'Login'}
                                    </Button>

                                    {/* Error Message */}
                                    {errorMessage && (
                                        <div className="mt-4 text-center text-red-500">
                                            {errorMessage}
                                        </div>
                                    )}
                                </form>
                            </Form>
                        </div>
                    </Card>
                </div>




            </div>
        </div>
    );
}
