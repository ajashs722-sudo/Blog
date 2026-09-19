/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Home } from "./pages/Home";
import { Post } from "./pages/Post";
import { About } from "./pages/About";
import { Photography } from "./pages/Photography";
import { ScrollToTop } from "./components/ScrollToTop";
import { ThemeProvider } from "./context/ThemeContext";

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/photography" element={<Photography />} />
          <Route path="/post/:slug" element={<Post />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
