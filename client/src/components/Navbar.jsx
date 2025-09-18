import React from 'react';
import { Link } from 'react-router-dom';

const Navbar = () => {
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          AI Finance Tracker
        </Link>
        <ul className="nav-menu">
          <li className="nav-item">
            <Link to="/" className="nav-links">Dashboard</Link>
          </li>
          <li className="nav-item">
            <Link to="/upload" className="nav-links">Upload Statement</Link>
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;