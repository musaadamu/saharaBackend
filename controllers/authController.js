const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

// Helper function to generate JWT
const generateToken = (user) => {
    return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1d" });
};

// Register User
exports.register = async (req, res) => {
    try {
        console.log("Registration Request Body:", req.body);

        // Trim inputs to remove any whitespace
        const name = req.body.name ? req.body.name.trim() : '';
        const email = req.body.email ? req.body.email.trim() : '';
        const password = req.body.password ? req.body.password.trim() : '';
        const { role } = req.body;

        console.log("Parsed Inputs:", { name, email, password, role });

        // Extensive validation with detailed error messages
        const errors = [];

        if (!name) errors.push("Name is required");
        if (name && name.length < 2) errors.push("Name must be at least 2 characters long");

        if (!email) errors.push("Email is required");
        if (email && !/\S+@\S+\.\S+/.test(email)) errors.push("Invalid email format");

        if (!password) errors.push("Password is required");
        if (password && password.length < 6) errors.push("Password must be at least 6 characters long");

        // Validate role
        const allowedRoles = ["author", "editor", "admin"];
        const assignedRole = allowedRoles.includes(role) ? role : "author";

        // If there are validation errors, return them
        if (errors.length > 0) {
            console.error("Validation Errors:", errors);
            return res.status(400).json({ 
                message: "Validation Failed", 
                errors 
            });
        }

        // Rest of the existing registration logic remains the same
        if (await User.findOne({ email })) {
            console.log("User already exists with email:", email);
            return res.status(400).json({ message: "Email already registered" });
        }

        try {
            const user = await new User({ 
                name, 
                email, 
                password, 
                role: assignedRole 
            }).save();

            const token = generateToken(user);

            res.cookie("token", token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "Strict",
                maxAge: 24 * 60 * 60 * 1000, // 1 day
            });

            res.status(201).json({
                message: "User registered successfully",
                user: { id: user._id, name: user.name, email: user.email, role: user.role },
                token,
            });

        } catch (saveError) {
            console.error("User Save Error:", saveError);
            return res.status(400).json({ 
                message: "Failed to save user", 
                error: saveError.message,
                details: saveError.errors 
            });
        }

    } catch (error) {
        console.error("Registration Error:", error);
        res.status(500).json({ 
            message: "Server error during registration", 
            error: error.message 
        });
    }
};

// Login User
exports.login = async (req, res) => {
    try {
        // Preserve original password for comparison
        const email = req.body.email ? req.body.email.trim() : '';
        const password = req.body.password || ''; // Don't trim password for login
        
        console.log("Login attempt for email:", email);

        const user = await User.findOne({ email });

        if (!user) {
            console.log("❌ User not found with email:", email);
            return res.status(401).json({ message: "Invalid email or password" });
        }

        console.log("✅ Found user:", user.email);
        
        // Compare password with the hash stored in database
        const isPasswordValid = await bcrypt.compare(password, user.password);
        
        if (!isPasswordValid) {
            console.log("❌ Password mismatch for user:", user.email);
            return res.status(401).json({ message: "Invalid email or password" });
        }

        console.log("✅ Password matched!");

        const token = generateToken(user);

        // Set token in HTTP-only cookie
        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "Strict",
            maxAge: 24 * 60 * 60 * 1000, // 1 day
        });

        // Send structured response for Redux
        res.json({
            message: "Login successful",
            user: { id: user._id, name: user.name, email: user.email, role: user.role },
            token,
        });

    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Logout User
exports.logout = (req, res) => {
    res.cookie("token", "", { expires: new Date(0), httpOnly: true });
    res.json({ message: "User logged out successfully" });
};

// Update User Profile (Admin & User)
exports.updateUser = async (req, res) => {
    try {
        // Trim inputs except password
        const name = req.body.name ? req.body.name.trim() : null;
        const email = req.body.email ? req.body.email.trim() : null;
        const password = req.body.password || null; // Password will be hashed by pre-save hook
        const { role } = req.body;
        const userId = req.params.id; 

        let user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Only admin can update role
        if (role && req.user.role !== "admin") {
            return res.status(403).json({ message: "Access denied: Only admins can update roles" });
        }

        if (name) user.name = name;
        if (email) user.email = email;
        if (password) user.password = password; // Let pre-save hook hash the password

        if (role && req.user.role === "admin") {
            user.role = role;
        }

        await user.save();
        res.json({ 
            message: "User updated successfully", 
            user: { id: user._id, name: user.name, email: user.email, role: user.role }
        });

    } catch (error) {
        console.error("Update Error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Forgot Password
exports.forgotPassword = async (req, res) => {
    try {
        const email = req.body.email ? req.body.email.trim() : '';
        
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Use the model's method to generate reset token
        user.generatePasswordReset();
        await user.save({ validateBeforeSave: false });

        // Email Configuration
        const transporter = nodemailer.createTransport({
            service: "Gmail",
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
        });

        const resetLink = `${process.env.CLIENT_URL}/reset-password/${user.resetPasswordToken}`;
        const mailOptions = {
            to: user.email,
            from: process.env.EMAIL_USER,
            subject: "Password Reset Request",
            text: `Click the following link to reset your password: ${resetLink}`,
        };

        await transporter.sendMail(mailOptions);
        res.json({ message: "Password reset link sent to email" });

    } catch (error) {
        console.error("Forgot Password Error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Reset Password
exports.resetPassword = async (req, res) => {
    try {
        const token = req.body.token ? req.body.token.trim() : '';
        const newPassword = req.body.newPassword || ''; // Don't trim password
        
        if (!token || !newPassword) {
            return res.status(400).json({ message: "Token and new password are required" });
        }
        
        // Find user with this token
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }, // Ensures token is not expired
        });

        if (!user) {
            return res.status(400).json({ message: "Invalid or expired reset token" });
        }

        // Update password - let pre-save hook handle hashing
        user.password = newPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();

        res.json({ message: "Password reset successful. You can now log in." });

    } catch (error) {
        console.error("Reset Password Error:", error);
        res.status(500).json({ message: "Server error" });
    }
};