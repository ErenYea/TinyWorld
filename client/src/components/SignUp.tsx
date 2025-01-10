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
import { useSignup } from "@/hooks/use-signup";
import { useUser } from "@/context/UserContext";
import { useLocation } from "wouter";
import { useState } from "react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

// Assume you have a similar hook for signup

const signUpSchema = z.object({
    username: z.string().min(3, "Username must be at least 3 characters"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
}).refine(data => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});

type SignUpFormData = z.infer<typeof signUpSchema>;

export function SignUp() {
    const { toast } = useToast();
    const [, setLocation] = useLocation();
    const form = useForm<SignUpFormData>({
        resolver: zodResolver(signUpSchema),
        defaultValues: {
            username: "",
            email: "",
            password: "",
            confirmPassword: "",
        },
    });

    const signUpMutation = useSignup();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const onSubmit = (data: SignUpFormData) => {
        setErrorMessage(null); // Reset error message on new submit
        signUpMutation.mutate(data, {
            onSuccess: (response: { message: string; user?: any; error?: string }) => {
                if (response.error === "signup_failed") {
                    toast({
                        title: "Signup Error",
                        description: "Signup failed. Please check your details and try again.",
                        variant: "destructive",
                    });
                    setErrorMessage(response.message);
                } else {
                    toast({
                        title: "Signup Success",
                        description: "You are now signed up. Please login to continue.",
                        variant: "default",
                    });
                    if (response.user) {
                        localStorage.setItem('user', JSON.stringify(response.user));
                        setLocation("/");
                    } else {
                        toast({
                            title: "Signup Error",
                            description: "Signup failed. User data is missing.",
                            variant: "destructive",
                        });
                    }
                }
            },
            onError: (error: any) => {
                toast({
                    title: "Signup Error",
                    description: "Signup failed. Please check your details and try again.",
                    variant: "destructive",
                });
                if (error.response && error.response.data && error.response.data.message) {
                    setErrorMessage(error.response.data.message);
                } else {
                    setErrorMessage('Signup failed. Please check your details and try again.');
                }
            },
        });
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-black text-white p-4">
            <div className="w-full max-w-lg mx-auto">

                <div className="col-span-5 space-y-6">
                    <Card className="p-6 bg-gray-900/50 border-purple-500/30">
                        <div>
                            <h2 className="text-xl font-semibold mb-4 text-purple-400">Sign Up</h2>

                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="username"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Username</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        {...field}
                                                        className="bg-gray-800 border-purple-500/30"
                                                        type="text"
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

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

                                    <FormField
                                        control={form.control}
                                        name="confirmPassword"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Confirm Password</FormLabel>
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

                                    {/* Login Link */}
                                    <div className="text-center mb-4">
                                        <span className="text-gray-400">Already have an account? </span>
                                        <Link to="/login" className="text-purple-400 hover:underline">
                                            Log in
                                        </Link>
                                    </div>

                                    <Button
                                        type="submit"
                                        className="w-full bg-purple-600 hover:bg-purple-700"
                                        disabled={signUpMutation.status === 'pending'}
                                    >
                                        {signUpMutation.status === 'pending' ? 'Signing up...' : 'Sign Up'}
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
