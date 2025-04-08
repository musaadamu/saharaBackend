import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import "./Sidebar.css";

const Sidebar = () => {
  const [userName, setUserName] = useState("John Doe");
  const [userJournals, setUserJournals] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) setIsSidebarOpen(false);
    };

    window.addEventListener('resize', handleResize);

    const fetchUserData = async () => {
      try {
        // Get user data
        const userResponse = await api.get('/auth/me');
        setUserName(userResponse.data.name || "User");

        // Get user journals
        const journalsResponse = await api.get('/journals/user');
        setUserJournals(journalsResponse.data || []);
      } catch (error) {
        console.error("Error fetching data:", error);
        if (error.response?.status === 401) {
          localStorage.removeItem('authToken');
        }
      }
    };

    fetchUserData();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => setIsSidebarOpen(prev => !prev);
  const closeSidebar = () => isMobile && setIsSidebarOpen(false);

  return (
    <>
      {isMobile && (
        <button className="sidebar-toggle" onClick={toggleSidebar} aria-label="Toggle Sidebar">
          {isSidebarOpen ? "✖" : "☰"}
        </button>
      )}

      <div className={`site-sidebar ${isSidebarOpen ? "open" : ""} ${isMobile ? "mobile" : ""}`}>
        <div className="sidebar-profile">
          <img src="/path/to/avatar.jpg" alt="Avatar" className="avatar" onClick={closeSidebar} />
          <div className="user-info">
            <p className="user-name">{userName}</p>
            <p className="user-role">Researcher</p>
          </div>
        </div>

        <div className="user-journals">
          <h3>Your Journals</h3>
          {userJournals.length > 0 ? (
            <ul>
              {userJournals.map(journal => (
                <li key={journal._id}>
                  <Link to={`/journals/${journal._id}`} onClick={closeSidebar}>
                    {journal.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="no-journals-message">
              You haven't submitted any journals yet.
            </p>
          )}
        </div>

        <nav className="sidebar-nav">
          <ul>
            <li><Link to="/" onClick={closeSidebar}>Home</Link></li>
            <li><Link to="/dashboard" onClick={closeSidebar}>Dashboard</Link></li>
            <li><Link to="/journals" onClick={closeSidebar}>View Journals</Link></li>
            <li><Link to="/journals/uploads" onClick={closeSidebar}>Upload Journal</Link></li>
            <li><Link to="/submission" onClick={closeSidebar}>Submit Journal</Link></li>
            <li><Link to="/updateprofile" onClick={closeSidebar}>Update Profile</Link></li>
            <li><Link to="/manage-journals" onClick={closeSidebar}>Manage Journals</Link></li>
            <li><Link to="/register" onClick={closeSidebar}>Register</Link></li>
            <li><Link to="/login" onClick={closeSidebar}>Login</Link></li>
            <li><Link to="/logout" onClick={closeSidebar}>Logout</Link></li>
          </ul>
        </nav>

        <div className="sidebar-utilities">
          <input className="sidebar-search" type="text" placeholder="Search..." />
          <Link to="/journals/uploads" className="create-action" onClick={closeSidebar}>
            Create New Journal
          </Link>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
