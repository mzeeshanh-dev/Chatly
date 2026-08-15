import { AuthProvider } from "@/context/AuthContext";
import { QueryProvider } from "@/components/ui/QueryProvider";
import { Toaster } from "sonner";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>
        {children}
        <Toaster 
          position="top-center" 
          toastOptions={{
            className: "bg-zinc-900/95 backdrop-blur-md text-white border border-zinc-800 shadow-2xl rounded-2xl",
            descriptionClassName: "text-zinc-400",
            style: { padding: '16px', gap: '12px' }
          }}
        />
      </AuthProvider>
    </QueryProvider>
  );
}
