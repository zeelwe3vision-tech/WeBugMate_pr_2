import React from 'react';
import { Link } from 'react-router-dom';
import './home.css';

const Home = () => (
  <div className="ai-welcome-hero">
    <nav className="ai-navbar">
      <div className="ai-logo">webugmate</div>
      <div className="ai-nav-links">
        <Link to="/home">Home</Link>
        <a href="#features">Features</a>
        <Link to={`/signin`} className="ai-login-btn">Login</Link>
      </div>
    </nav>
    <main className="ai-hero-content">
      <h1>AI for every <span className="ai-gradient-text">developer</span></h1>
      <p className="ai-hero-desc">
        Unlock AI models to build innovative apps and transform development workflows with tools across platforms.
      </p>
      <Link to="/signin" className="ai-cta-btn">Get Started</Link>
      <div className="ai-feature-row" id="features">
        <div className="ai-feature-card">
          <h3>AI-Powered Debugging</h3>
          <p>Identify, understand, and resolve code errors quickly with our smart assistant.</p>
        </div>
        <div className="ai-feature-card">
          <h3>Dual Chatbots</h3>
          <p>One for general help, one for deep code analysis and debugging.</p>
        </div>
        <div className="ai-feature-card">
          <h3>Admin & Analytics</h3>
          <p>Manage responses, logs, and analytics with role-based access.</p>
        </div>
      </div>
    </main>
    <footer className="ai-footer">
      &copy; {new Date().getFullYear()} webugmate. All rights reserved.
    </footer>
  </div>
);

export default Home;
