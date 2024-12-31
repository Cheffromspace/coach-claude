"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface HeaderProps {
  className?: string;
}

export function Header({ className = "" }: HeaderProps) {
  const [scrolled, set_scrolled] = useState(false);

  // Handle scroll effect
  useEffect(() => {
    const handle_scroll = () => {
      set_scrolled(window.scrollY > 0);
    };

    window.addEventListener("scroll", handle_scroll);
    return () => window.removeEventListener("scroll", handle_scroll);
  }, []);

  return (
    <motion.header
      className={`fixed top-0 left-0 right-0 z-40 ${className}`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div
        className={`h-16 px-4 transition-all duration-200 ${
          scrolled
            ? "bg-background/80 backdrop-blur-sm shadow-sm"
            : "bg-transparent"
        }`}
      >
        <div className="flex h-full items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-4">
            <span className="text-xl font-bold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent">
              Nexus
            </span>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            <a
              href="#"
              className="text-sm font-medium text-foreground/60 hover:text-foreground transition-colors"
            >
              Dashboard
            </a>
            <a
              href="#"
              className="text-sm font-medium text-foreground/60 hover:text-foreground transition-colors"
            >
              Notes
            </a>
            <a
              href="#"
              className="text-sm font-medium text-foreground/60 hover:text-foreground transition-colors"
            >
              Goals
            </a>
          </nav>

          {/* Actions */}
          <div className="flex items-center space-x-4">
            <button
              type="button"
              className="p-2 rounded-md hover:bg-primary-100 dark:hover:bg-primary-800 transition-colors"
              aria-label="Toggle theme"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </motion.header>
  );
}
