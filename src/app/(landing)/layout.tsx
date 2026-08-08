import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { AuthProvider } from "@/context/AuthContext";
import React from "react";

export default function LandingGroupLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <div className="relative min-h-screen bg-background transition-colors duration-300 flex flex-col justify-between">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[400px] bg-gradient-to-b from-primary/5 to-transparent blur-[100px] pointer-events-none" />
                <div>
                    <Navbar />
                    <main>{children}</main>
                </div>
                <Footer />
            </div>
        </AuthProvider>
    );
}