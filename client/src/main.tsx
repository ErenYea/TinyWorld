import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { Switch, Route } from "wouter";
import "./index.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import SimulationDashboard from "./pages/SimulationDashboard";
import { Login } from "./components/Login";
import { SignUp } from "./components/SignUp";
import { UserProvider } from "./context/UserContext";
import { Header } from "./components/Header";
import PrivyProviders from "./components/PriacyLogin";


function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <SimulationDashboard />} />
      {/* <Route path={"/onboarding"} component={() => <PrivyLogin ></PrivyLogin>} /> */}
      {/* <Route path="/login" component={() => <Login />} />
      <Route path="/signup" component={() => <SignUp />} /> */}
      <Route>404 Page Not Found</Route>
    </Switch>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <PrivyProviders>
        <UserProvider>
          <Header />
          <Router />
          <Toaster />
        </UserProvider>
      </PrivyProviders>
    </QueryClientProvider>
  </StrictMode>,
);
