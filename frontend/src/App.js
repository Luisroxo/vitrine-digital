import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/loading.css';

// Pages
import Home from './pages/Home';
import Admin from './pages/Admin';
import SuperAdmin from './pages/SuperAdmin';
import AcceptPartnership from './pages/AcceptPartnership';

// Contexts
import { ErrorProvider } from './contexts/ErrorContext';
import { LoadingProvider } from './contexts/LoadingContext';

// Services
import APIClient from './services/APIClient';

function App() {
  return (
    <ErrorProvider>
      <LoadingProvider>
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
      </LoadingProvider>
    </ErrorProvider>
  );
}

export default App;