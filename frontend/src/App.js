import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import Home from './pages/Home';
import Admin from './pages/Admin';
import SuperAdmin from './pages/SuperAdmin';
import AcceptPartnership from './pages/AcceptPartnership';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/super-admin" element={<SuperAdmin />} />
          <Route path="/partnership/accept/:token" element={<AcceptPartnership />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;