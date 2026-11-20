import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Leaf, Recycle, Menu, X } from "lucide-react";
import { Button } from "./ui/button";
import { PROBLEM_STATEMENT } from "../data/project";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  const navItems = [
    { path: "/", label: "Home" },
    { path: "/calculator", label: "Calculator" },
    { path: "/compare", label: "Compare" },
    { path: "/india", label: "India" },
    { path: "/ai-validation", label: "AI & Validation" },
    { path: "/reports", label: "Reports" },
    { path: "/about", label: "About" },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="relative">
              <Leaf className="h-8 w-8 text-green-600 group-hover:text-green-700 transition-colors" />
              <Recycle className="h-4 w-4 text-blue-500 absolute -top-1 -right-1 group-hover:text-blue-600 transition-colors" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold text-gray-900 group-hover:text-green-700 transition-colors">
                EcoForge
              </span>
              <span className="text-[11px] leading-tight text-gray-600 hidden xl:block max-w-[19rem]">
                {PROBLEM_STATEMENT}
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-4 xl:space-x-6">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`text-[13px] xl:text-sm font-medium whitespace-nowrap transition-colors hover:text-green-600 ${
                  isActive(item.path)
                    ? "text-green-600 border-b-2 border-green-600 pb-1"
                    : "ef-nav text-gray-700"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="lg:hidden py-4 border-t border-gray-200">
            <nav className="flex flex-col space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`text-sm font-medium px-3 py-2 rounded-md transition-colors ${
                    isActive(item.path)
                      ? "text-green-600 bg-green-50"
                      : "text-gray-700 hover:text-green-600 hover:bg-gray-50"
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;