// [34] HOME PAGE - what EcoForge does, its main modules (each links to its page) and headline facts.
import React from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Leaf, Recycle, Calculator, GitCompare, FlaskConical, MapPin, FileText, ArrowRight } from "lucide-react";
import { PROBLEM_STATEMENT } from "../data/project";

const MODULES = [
  { to: "/calculator", icon: <Calculator className="h-7 w-7 text-green-600" />, title: "LCA Calculator",
    text: "ISO-structured LCA with hotspots, AI gap-filling and a CO₂ target planner." },
  { to: "/calculator?tab=precheck", icon: <Recycle className="h-7 w-7 text-emerald-600" />, title: "Circularity Pre-check",
    text: "Predict before processing if scrap stays in a closed loop, with a fix plan." },
  { to: "/compare", icon: <GitCompare className="h-7 w-7 text-blue-600" />, title: "Conventional vs Circular",
    text: "Ore vs mixed vs scrap, side by side." },
  { to: "/india", icon: <MapPin className="h-7 w-7 text-red-600" />, title: "India",
    text: "National footprint and a map of 44 plants and mines." },
  { to: "/ai-validation", icon: <FlaskConical className="h-7 w-7 text-purple-600" />, title: "AI & Validation",
    text: "Comparison with published data and 7 ML models benchmarked." },
  { to: "/reports", icon: <FileText className="h-7 w-7 text-gray-700" />, title: "Reports & Tracking",
    text: "Save assessments, track CO₂ per tonne over time and download PDF or CSV reports." },
];

const Home = () => (
  <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-gray-50">
    <section className="pt-16 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto text-center">
        <div className="relative inline-block mb-6 ef-float">
          <Leaf className="h-16 w-16 text-green-600" />
          <Recycle className="h-8 w-8 text-blue-500 absolute -top-2 -right-2 ef-spin" />
        </div>
        <p className="text-4xl md:text-5xl font-bold text-gray-900 mb-5"><span className="ef-shine">Eco</span>Forge</p>
        <h1 className="text-2xl md:text-3xl font-semibold text-gray-800 leading-snug mb-5 max-w-4xl mx-auto">{PROBLEM_STATEMENT}</h1>
        <p className="text-base md:text-lg text-gray-600 mb-8 max-w-3xl mx-auto">
          Measure the footprint of a tonne of metal, fill missing data with AI, and check if scrap will stay circular. Made for India.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/calculator"><Button size="lg" className="bg-green-600 hover:bg-green-700 px-8 ef-pulse">Start an assessment</Button></Link>
          <Link to="/compare"><Button variant="outline" size="lg" className="border-green-600 text-green-700 hover:bg-green-50 px-8">See conventional vs circular</Button></Link>
        </div>
      </div>
    </section>

    <section className="px-4 sm:px-6 lg:px-8 pb-16">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 text-center mb-8">What you can do</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {MODULES.map((m) => (
            <Link key={m.title} to={m.to} className="group">
              <Card className="h-full bg-white/90 border border-gray-200 shadow-sm group-hover:shadow-md group-hover:-translate-y-1 transition-all">
                <CardContent className="p-6">
                  <div className="mb-3 inline-block transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">{m.icon}</div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-1">{m.title}
                    <ArrowRight className="h-4 w-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" /></h3>
                  <p className="text-sm text-gray-600">{m.text}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  </div>
);

export default Home;
