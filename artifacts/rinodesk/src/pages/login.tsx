import { GoogleLogin } from "@react-oauth/google";
import { useLocation } from "wouter";
import { Headset } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const { loginWithCredential } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  return (
    <div className="dark min-h-screen flex items-center justify-center bg-background text-foreground p-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-xl">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-lg shadow-primary/20 mb-4">
            <Headset className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">RinoDesk</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to your support workspace</p>
        </div>
        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={async (cred) => {
              try {
                if (!cred.credential) throw new Error("No credential");
                await loginWithCredential(cred.credential);
                navigate("/");
              } catch {
                toast({ title: "Sign-in failed", description: "Please try again.", variant: "destructive" });
              }
            }}
            onError={() =>
              toast({ title: "Sign-in failed", description: "Google sign-in was cancelled or blocked.", variant: "destructive" })
            }
            theme="filled_black"
            shape="pill"
            text="signin_with"
          />
        </div>
      </div>
    </div>
  );
}
