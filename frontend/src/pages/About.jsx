// [33] ABOUT PAGE - the project, the problem it solves, the team, methods, technology and data sources.
import React from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Leaf, Recycle, Brain, Target, ShieldCheck, Database, GraduationCap, Code2 } from "lucide-react";
import { PROBLEM_STATEMENT } from "../data/project";

const TEAM = [
  { name: "Shubham Kumar", roll: "23CSU388" },
  { name: "Nitin Sharma", roll: "23CSU224" },
  { name: "Nikhil Kaushik", roll: "23CSU213" },
  { name: "Nitish", roll: "23CSU225" },
];

const PILLARS = [
  { icon: <Target className="h-7 w-7 text-green-600" />, title: "Life Cycle Assessment",
    text: "ISO-structured LCA for aluminium, copper, steel and magnesium, gate or grave." },
  { icon: <Brain className="h-7 w-7 text-purple-600" />, title: "AI / ML",
    text: "SVR predicts CO₂ with a range, Random Forests fill missing data, a classifier pre-checks scrap. Trained on generated data." },
  { icon: <Recycle className="h-7 w-7 text-blue-600" />, title: "Circularity",
    text: "MCI score, recycling credit and a CO₂ target planner." },
  { icon: <ShieldCheck className="h-7 w-7 text-amber-600" />, title: "Built for India",
    text: "Indian grid factor (CEA); 8.8% average gap vs published company averages." },
];

const STACK = [
  ["Frontend", "React 19, Tailwind CSS, Radix UI, Plotly, D3 (India map), jsPDF"],
  ["Backend", "Python, FastAPI, Uvicorn"],
  ["Machine learning", "scikit-learn (SVR, Random Forest, Logistic Regression, Gradient Boosting, KNN, Decision Tree), XGBoost"],
  ["Data", "CSV datasets from Government of India and industry bodies, JSON store for saved assessments"],
];

const SOURCES = [
  "IAI, worldsteel, International Copper Association: emission factors",
  "Central Electricity Authority (CEA) CO₂ Baseline Database v21.0: India grid factor 0.7117 t CO₂/MWh",
  "Ministry of Steel and Ministry of Mines / Indian Bureau of Mines: national production FY2016-26",
  "Tata Steel, Vedanta, Hindalco reports: benchmarks",
  "UNEP International Resource Panel (2011): end-of-life recycling rates",
  "DataMeet (Survey of India based): India state boundaries",
];

const About = () => (
  <div className="min-h-screen bg-gray-50">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="text-center mb-12">
        <div className="relative inline-block mb-5">
          <Leaf className="h-14 w-14 text-green-600" />
          <Recycle className="h-7 w-7 text-blue-500 absolute -top-2 -right-2" />
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-3">About <span className="text-green-600">Eco</span>Forge</h1>
        <p className="text-lg text-gray-600 max-w-3xl mx-auto">
          Final year project, B.Tech CSE, The NorthCap University
        </p>
      </div>

      <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-0 shadow-sm mb-10">
        <CardContent className="p-7">
          <p className="text-sm font-medium text-green-700 mb-1">Problem statement</p>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{PROBLEM_STATEMENT}</h2>
          <p className="text-gray-700">
            Measure the footprint of a tonne of metal, fill missing data with AI, check circularity before processing, and get an ISO-structured report.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        {PILLARS.map((p) => (
          <Card key={p.title} className="bg-white shadow-sm border border-gray-200">
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-3 text-gray-900">{p.icon}{p.title}</CardTitle></CardHeader>
            <CardContent><p className="text-gray-600">{p.text}</p></CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-white shadow-sm border border-gray-200 mb-10">
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-gray-900"><GraduationCap className="h-5 w-5 text-green-600" />Team X INNOVATORS</CardTitle></CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-5">B.Tech Computer Science & Engineering, The NorthCap University, Gurugram · Final-year project 2026</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            {TEAM.map((m) => (
              <div key={m.roll} className="rounded-xl border border-gray-200 p-4 text-center">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-500 to-blue-500 text-white font-semibold flex items-center justify-center mx-auto mb-3">
                  {m.name.split(" ").map((x) => x[0]).join("")}
                </div>
                <p className="font-medium text-gray-900">{m.name}</p>
                <p className="text-sm text-gray-500">{m.roll}</p>
              </div>
            ))}
          </div>
          <p className="text-gray-700"><span className="text-gray-500">Supervisor:</span> Mr. Sumit Kumar, Assistant Professor, Department of CSE</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        <Card className="bg-white shadow-sm border border-gray-200">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-gray-900"><Code2 className="h-5 w-5 text-blue-600" />Technology</CardTitle></CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              {STACK.map(([k, v]) => <div key={k}><dt className="text-gray-500">{k}</dt><dd className="text-gray-800">{v}</dd></div>)}
            </dl>
          </CardContent>
        </Card>
        <Card className="bg-white shadow-sm border border-gray-200">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-gray-900"><Database className="h-5 w-5 text-amber-600" />Data sources</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-gray-700 list-disc pl-5">{SOURCES.map((s) => <li key={s}>{s}</li>)}</ul>
          </CardContent>
        </Card>
      </div>

      <div className="text-center">
        <Link to="/calculator"><Button size="lg" className="bg-green-600 hover:bg-green-700 px-8">Start an assessment</Button></Link>
      </div>
    </div>
  </div>
);

export default About;
