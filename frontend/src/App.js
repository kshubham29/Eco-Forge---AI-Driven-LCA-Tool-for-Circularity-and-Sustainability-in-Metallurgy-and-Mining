// [8] ROUTER - entry component; decides which page (Home, Calculator, Reports, ...) is shown.
import React, { Suspense, lazy } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Header from "./components/Header";
import Calculator from "./pages/Calculator";
import Home from "./pages/Home";
import About from "./pages/About";

// chart-heavy pages load only when opened
const ModelLab = lazy(() => import("./pages/ModelLab"));
const India = lazy(() => import("./pages/India"));
const Compare = lazy(() => import("./pages/Compare"));
const Reports = lazy(() => import("./pages/Reports"));

function App() {
  return (
    <div className="App min-h-screen bg-gray-50">
      <BrowserRouter>
        <Header />
        <main className="pt-16">
          <Suspense fallback={<div className="p-8 text-gray-500">Loading...</div>}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/calculator" element={<Calculator />} />
              <Route path="/compare" element={<Compare />} />
              <Route path="/india" element={<India />} />
              <Route path="/ai-validation" element={<ModelLab />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/about" element={<About />} />
              {/* old addresses still work */}
              <Route path="/model-lab" element={<Navigate to="/ai-validation" replace />} />
              <Route path="/india-map" element={<Navigate to="/india" replace />} />
              <Route path="/insights" element={<Navigate to="/india" replace />} />            </Routes>
          </Suspense>
        </main>
      </BrowserRouter>
    </div>
  );
}

export default App;
