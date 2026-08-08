"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, CheckCheck, MessageCircle, Plus, Search, Send, ShieldCheck, Sparkles, Users, Zap } from "lucide-react";
import ChatlyLogo from "./ChatlyLogo";
import { motion } from "framer-motion";

const Hero = () => {
    return (
        <section className="relative overflow-hidden px-4 pb-16 pt-28 sm:px-6 sm:pt-32 lg:min-h-screen lg:pb-20">
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_20%,rgba(16,185,129,0.14),transparent_28%),linear-gradient(135deg,rgba(16,185,129,0.08),transparent_32%),linear-gradient(to_bottom,var(--background),var(--background))]" />
            <div className="absolute inset-0 -z-10 bg-[linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:linear-gradient(to_bottom,transparent,black_14%,black_78%,transparent)]" />

            <div className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-10 lg:grid-cols-[0.92fr_1.08fr] xl:gap-14">
                <div className="max-w-2xl text-left">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25 }}
                        className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-2 text-xs font-bold uppercase tracking-[0.18em] text-primary shadow-sm shadow-primary/10"
                    >
                        <Sparkles className="h-3.5 w-3.5" />
                        Private real-time chat
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, x: -80 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.35, type: "spring", bounce: 0.4 }}
                        className="max-w-[12ch] text-4xl font-black leading-[1.02] tracking-normal text-foreground sm:text-6xl lg:text-7xl"
                    >
                        Chat that feels instant, private, and human.
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, x: -40 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.35, delay: 0.05, type: "spring", bounce: 0.3 }}
                        className="mt-6 max-w-xl text-base leading-8 text-muted-foreground sm:text-lg"
                    >
                        Chatly brings OTP login, live delivery status, and smooth group conversations into one clean workspace built for everyday messaging.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: 0.15 }}
                        className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row"
                    >
                        <Link href="/chat" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-primary px-7 text-base font-bold text-primary-foreground shadow-xl shadow-emerald-500/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-emerald-500/35">
                            Start Chatting
                            <ArrowRight className="h-4.5 w-4.5" />
                        </Link>

                        <Link href="#how-it-works" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full border border-border bg-background/70 px-7 text-base font-bold text-foreground backdrop-blur-xl transition-all duration-300 hover:border-primary/35 hover:bg-secondary">
                            <MessageCircle className="h-4.5 w-4.5 text-primary" />
                            See how it works
                        </Link>
                    </motion.div>

                    <motion.div
                        initial="hidden"
                        animate="visible"
                        variants={{
                            hidden: {},
                            visible: {
                                transition: {
                                    staggerChildren: 0.05,
                                    delayChildren: 0.2
                                }
                            }
                        }}
                        className="mt-9 grid max-w-xl grid-cols-1 gap-3 text-sm sm:grid-cols-3"
                    >
                        {[
                            { label: "OTP secured", icon: ShieldCheck },
                            { label: "Live sync", icon: Zap },
                            { label: "Group ready", icon: Users },
                        ].map((item) => (
                            <motion.div
                                variants={{
                                    hidden: { opacity: 0, y: 15 },
                                    visible: { opacity: 1, y: 0 }
                                }}
                                key={item.label}
                                className="flex min-h-14 items-center gap-2.5 rounded-lg border border-border bg-background/55 px-3.5 backdrop-blur sm:min-h-16"
                            >
                                <item.icon className="h-4.5 w-4.5 shrink-0 text-primary" />
                                <span className="font-semibold text-foreground/85">{item.label}</span>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>

                <motion.div
                    initial={{ opacity: 0, filter: "blur(20px)", scale: 0.9 }}
                    animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
                    transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="relative mx-auto w-full max-w-[720px]"
                >
                    <div className="absolute -left-5 top-8 h-28 w-28 rounded-[2rem] border border-primary/15 bg-primary/10 blur-2xl" />
                    <div className="absolute -right-5 bottom-10 h-32 w-32 rounded-[2rem] border border-cyan-400/15 bg-cyan-400/10 blur-2xl" />

                    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#080a0f] shadow-2xl shadow-black/30 ring-1 ring-white/10">
                        <div className="flex h-[470px] min-h-[470px] text-white sm:h-[520px]">
                            <aside className="hidden w-[70px] shrink-0 flex-col items-center border-r border-white/10 bg-black/30 py-5 sm:flex">
                                <ChatlyLogo showText={false} markClassName="h-10 w-10" />
                                <div className="mt-12 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                                    <MessageCircle className="h-5 w-5 fill-primary" />
                                </div>
                                <div className="mt-5 flex h-12 w-12 items-center justify-center rounded-2xl text-slate-500">
                                    <Users className="h-5 w-5" />
                                </div>
                                <div className="mt-auto h-10 w-10 rounded-full border border-white/10 bg-gradient-to-br from-slate-600 to-slate-900" />
                            </aside>

                            <aside className="hidden w-[250px] shrink-0 border-r border-white/10 bg-[#11131a] p-5 md:block">
                                <div className="mb-7 flex items-center justify-between">
                                    <h3 className="text-lg font-black">Messages</h3>
                                    <button className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary" aria-label="New chat">
                                        <Plus className="h-5 w-5" />
                                    </button>
                                </div>
                                <div className="mb-3 flex h-12 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-500">
                                    <Search className="h-4 w-4" />
                                    Search messages...
                                </div>
                                <div className="mb-6 grid grid-cols-2 rounded-2xl border border-white/10 bg-white/[0.02] p-1 text-xs font-bold text-slate-400">
                                    <span className="rounded-xl bg-white/10 py-2 text-center text-white">All</span>
                                    <span className="py-2 text-center">Pending</span>
                                </div>
                                <div className="space-y-3">
                                    <div className="rounded-2xl bg-white/10 p-3">
                                        <div className="flex items-center gap-3">
                                            <div className="relative h-10 w-10 rounded-full bg-gradient-to-br from-slate-500 to-slate-800">
                                                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#24242a] bg-primary" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-bold">Zeeshan Haider</p>
                                                <p className="truncate text-xs text-slate-400">PR looks good</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 px-3 py-2">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-900/70 text-sm font-bold text-primary">Z</div>
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-bold">Zain Ali</p>
                                            <p className="truncate text-xs text-slate-400">Merged the fix</p>
                                        </div>
                                    </div>
                                </div>
                            </aside>

                            <div className="flex min-w-0 flex-1 flex-col bg-[#090b11]">
                                <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-white/10 px-4 sm:px-6">
                                    <div className="flex items-center gap-3">
                                        <div className="relative h-10 w-10 rounded-full bg-gradient-to-br from-slate-500 to-slate-900">
                                            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#090b11] bg-primary shadow-lg shadow-primary/40" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black sm:text-base">Zeeshan Haider</p>
                                            <p className="text-[11px] font-black uppercase text-primary">Online</p>
                                        </div>
                                    </div>
                                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-400">OTP verified</span>
                                </div>

                                <div className="relative flex-1 overflow-hidden px-4 py-5 sm:px-6">
                                    <div className="ml-auto mb-2.5 max-w-[68%] rounded-2xl rounded-tr-md bg-primary px-4 py-2.5 text-sm leading-5 shadow-lg shadow-emerald-500/15">
                                        Morning, pushed the build.
                                        <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] font-bold text-white/60">
                                            02:45 PM <CheckCheck className="h-3.5 w-3.5" />
                                        </div>
                                    </div>
                                    <div className="ml-auto mb-5 max-w-[76%] rounded-2xl rounded-tr-md bg-primary px-4 py-2.5 text-sm leading-5 shadow-lg shadow-emerald-500/15">
                                        Can you do a quick review before we merge?
                                        <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] font-bold text-white/60">
                                            02:45 PM <CheckCheck className="h-3.5 w-3.5" />
                                        </div>
                                    </div>
                                    <div className="mb-2.5 max-w-[72%] rounded-2xl rounded-tl-md border border-white/10 bg-[#181b26] px-4 py-2.5 text-sm leading-5">
                                        Looks good. Tests are green and the auth edge case is covered.
                                        <div className="mt-0.5 text-right text-[10px] font-bold text-slate-500">02:45 PM</div>
                                    </div>
                                    <div className="ml-auto mb-2.5 max-w-[70%] rounded-2xl rounded-tr-md bg-primary px-4 py-2.5 text-sm leading-5 shadow-lg shadow-emerald-500/15">
                                        Perfect. I&apos;ll tag the release now.
                                        <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] font-bold text-white/60">
                                            02:46 PM <CheckCheck className="h-3.5 w-3.5" />
                                        </div>
                                    </div>
                                    <div className="max-w-[68%] rounded-2xl rounded-tl-md border border-white/10 bg-[#181b26] px-4 py-2.5 text-sm leading-5">
                                        Nice. I&apos;ll keep an eye on logs for a few minutes.
                                        <div className="mt-0.5 text-right text-[10px] font-bold text-slate-500">02:46 PM</div>
                                    </div>
                                </div>

                                <div className="shrink-0 border-t border-white/10 p-4">
                                    <div className="flex h-14 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4">
                                        <MessageCircle className="h-4.5 w-4.5 text-slate-500" />
                                        <span className="min-w-0 flex-1 truncate text-sm text-slate-500">Type a message...</span>
                                        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/70 text-white">
                                            <Send className="h-4.5 w-4.5 fill-current" />
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
};

export default Hero;
