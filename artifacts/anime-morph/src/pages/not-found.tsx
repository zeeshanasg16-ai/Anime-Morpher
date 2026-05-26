import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-5xl font-extrabold text-foreground mb-3">404</h1>
        <p className="text-muted-foreground text-lg mb-8">Page not found</p>
        <Link href="/">
          <Button className="bg-primary hover:bg-primary/90" data-testid="button-go-home">
            Go home
          </Button>
        </Link>
      </div>
    </div>
  );
}
