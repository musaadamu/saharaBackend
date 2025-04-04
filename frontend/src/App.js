import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import UpdateProfile from "./pages/UpdateProfilePage";
import NotFound from "./pages/NotFound"; // Handle 404
import ProtectedRoute from "./components/ProtectedRoute"; // Wrapper for protected routes
import JournalUpload from './components/JournalUpload';
import JournalList from './components/JournalList';
import JournalDetail from './components/JournalDetail'; 
import Home from "./pages/Home";
import ManageJournal from "./pages/ManageJournal";
import LogoutPage from "./pages/LogoutPage"; // Import the new Logout page
import JournalSubmission from "./components/JournalSubmission";

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgotpassword" element={<ForgotPassword />} />
                <Route path="/resetpassword/:token" element={<ResetPassword />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/updateprofile" element={<UpdateProfile />} />
                <Route path="/journals/uploads" element={<JournalUpload />} />
                <Route path="/journals" element={<JournalList />} />
                <Route path="/journals/:id" element={<JournalDetail />} />
                <Route path="/submision" element={<JournalSubmission />} />

                <Route path="/" element={<Home />} />
                <Route path="/logout" element={<LogoutPage />} />
                <Route path="/manage-journals" element={<ManageJournal />} />
                <Route path="*" element={<NotFound />} />
            </Routes>
        </Router>
    );
}

export default App;
