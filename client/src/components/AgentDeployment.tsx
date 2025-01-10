import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { usePrivy } from "@privy-io/react-auth";

const agentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  goals: z.string().min(1, "Goals are required"),
});

type AgentFormData = z.infer<typeof agentSchema>;

interface AgentDeploymentProps {
  onDeploy: (agent: AgentFormData & { userId: string }) => void;
}

export function AgentDeployment({ onDeploy }: AgentDeploymentProps) {
  const { user } = usePrivy();
  const form = useForm<AgentFormData>({
    resolver: zodResolver(agentSchema),
    defaultValues: {
      name: "",
      description: "",
      goals: "",
    },
  });
  // const user = JSON.parse(localStorage.getItem('user') || '{}');
  const onSubmit = (data: AgentFormData) => {
    if (user) {

      onDeploy({ ...data, userId: user?.id });
      form.reset();
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4 text-purple-400">Deploy Agent</h2>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Agent Name</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    className="bg-gray-800 border-purple-500/30"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    className="bg-gray-800 border-purple-500/30"
                    rows={3}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="goals"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Goals</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    className="bg-gray-800 border-purple-500/30"
                    rows={3}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            Deploy Agent
          </Button>
        </form>
      </Form>
    </div>
  );
}
