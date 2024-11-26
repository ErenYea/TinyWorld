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

const worldContextSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  rules: z.string().min(1, "Rules are required").transform(str => 
    str.split('\n').filter(rule => rule.trim())
  ),
  initialState: z.string().default("{}").transform(str => {
    try {
      return JSON.parse(str);
    } catch {
      return {};
    }
  })
});

type WorldContextFormData = z.infer<typeof worldContextSchema>;

interface WorldContextConfigProps {
  onUpdate: (context: WorldContextFormData) => void;
}

export function WorldContextConfig({ onUpdate }: WorldContextConfigProps) {
  const form = useForm<WorldContextFormData>({
    resolver: zodResolver(worldContextSchema),
    defaultValues: {
      name: "Default World",
      description: "A simulation environment for AI agents to interact and evolve",
      rules: "Agents must collaborate to achieve goals\nAgents should respect resource constraints",
      initialState: "{}"
    },
  });

  const onSubmit = (data: WorldContextFormData) => {
    onUpdate({
      ...data,
      rules: data.rules.split('\n').filter(rule => rule.trim())
    });
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4 text-purple-400">World Context</h2>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>World Name</FormLabel>
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
            name="rules"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rules (one per line)</FormLabel>
                <FormControl>
                  <Textarea 
                    {...field}
                    className="bg-gray-800 border-purple-500/30"
                    rows={3}
                    placeholder="Enter rules, one per line"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="initialState"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Initial State (JSON)</FormLabel>
                <FormControl>
                  <Textarea 
                    {...field}
                    className="bg-gray-800 border-purple-500/30"
                    rows={3}
                    placeholder="{}"
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
            Update World Context
          </Button>
        </form>
      </Form>
    </div>
  );
}
