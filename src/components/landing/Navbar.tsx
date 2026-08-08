"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import ThemeToggle from "../ui/ThemeToggle";
import ChatlyLogo from "./ChatlyLogo";
import { useAuth } from "@/context/AuthContext";

const Navbar = () => {
    const [scrolled, setScrolled] = useState(false);
    const { user, loading } = useAuth();

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <nav
            className={`fixed left-0 right-0 top-0 z-50 border-b backdrop-blur-2xl transition-[background-color,border-color,box-shadow,padding] duration-500 ease-out ${
                scrolled
                    ? "border-border/50 bg-background/78 py-3 shadow-[0_18px_50px_rgba(15,23,42,0.08)] dark:border-white/[0.035] dark:bg-[#0b0c10]/72 dark:shadow-black/20"
                    : "border-transparent bg-transparent py-5 shadow-none"
            }`}
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4">
                <Link href="/" className="group shrink-0" aria-label="Chatly home">
                    <ChatlyLogo
                        markClassName="h-10 w-10 transition-transform duration-300 group-hover:scale-105"
                        textClassName="text-xl sm:text-2xl"
                    />
                </Link>

                <div className="hidden md:flex items-center space-x-8">
                    <Link href="#features" className="text-sm font-medium hover:text-primary transition-colors">Features</Link>
                    <Link href="#how-it-works" className="text-sm font-medium hover:text-primary transition-colors">How it Works</Link>
                    <Link href="#security" className="text-sm font-medium hover:text-primary transition-colors">Security</Link>
                </div>

                <div className="flex items-center gap-2 sm:gap-4">
                    <ThemeToggle />
                    {!loading && (
                        user ? (
                            <Link
                                href="/chat"
                                className="px-4 sm:px-6 py-2.5 bg-primary text-primary-foreground rounded-full text-sm font-bold shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-0.5 transition-all duration-300"
                            >
                                Go to Chat
                            </Link>
                        ) : (
                            <>
                                <Link
                                    href="/login"
                                    className="hidden px-5 py-2 text-sm font-semibold hover:text-primary transition-colors sm:inline-flex"
                                >
                                    Login
                                </Link>
                                <Link
                                    href="/register"
                                    className="px-4 sm:px-6 py-2.5 bg-primary text-primary-foreground rounded-full text-sm font-bold shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-0.5 transition-all duration-300"
                                >
                                    Sign Up
                                </Link>
                            </>
                        )
                    )}
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
