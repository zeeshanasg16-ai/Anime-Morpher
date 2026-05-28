import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Home from "@/pages/home";
import Dashboard from "@/pages/dashboard";
import History from "@/pages/history";
import UploadVideo from "@/pages/upload-video";
import UploadPhoto from "@/pages/upload-photo";
import JobDetail from "@/pages/job-detail";
import { Layout } from "@/components/layout/layout";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function App() {
  return (
    <WouterRouter base={basePath}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/sign-in"><Redirect to="/dashboard" /></Route>
            <Route path="/sign-up"><Redirect to="/dashboard" /></Route>

            <Route path="/dashboard">
              <Layout><Dashboard /></Layout>
            </Route>
            <Route path="/upload/video">
              <Layout><UploadVideo /></Layout>
            </Route>
            <Route path="/upload/photo">
              <Layout><UploadPhoto /></Layout>
            </Route>
            <Route path="/jobs/:id">
              <Layout><JobDetail /></Layout>
            </Route>
            <Route path="/history">
              <Layout><History /></Layout>
            </Route>

            <Route component={NotFound} />
          </Switch>
        </TooltipProvider>
      </QueryClientProvider>
      <Toaster />
    </WouterRouter>
  );
}

export default App;
