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

        // For security, only allow 'author' role during registration
        // Admin roles can only be assigned by existing admins
        const assignedRole = "author";

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

// Create Admin User (Only accessible by existing admins)
exports.createAdmin = async (req, res) => {
    try {
        // Check if the requesting user is an admin
        if (req.user.role !== "admin") {
            return res.status(403).json({ message: "Access denied. Only admins can create admin accounts." });
        }

        const { name, email, password } = req.body;

        // Validate inputs
        if (!name || !email || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }

        // Check if user already exists
        if (await User.findOne({ email })) {
            return res.status(400).json({ message: "Email already registered" });
        }

        // Create the admin user
        const user = await new User({
            name,
            email,
            password,
            role: "admin"
        }).save();

        res.status(201).json({
            message: "Admin user created successfully",
            user: { id: user._id, name: user.name, email: user.email, role: user.role }
        });

    } catch (error) {
        console.error("Admin Creation Error:", error);
        res.status(500).json({
            message: "Server error during admin creation",
            error: error.message
        });
    }
};

// Forgot Password
exports.forgotPassword = async (req, res) => {
    try {
        const email = req.body.email ? req.body.email.trim() : '';

        // Validate email
        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        console.log(`Processing forgot password request for email: ${email}`);

        const user = await User.findOne({ email });

        if (!user) {
            console.log(`User not found for email: ${email}`);
            return res.status(404).json({ message: "User not found" });
        }

        console.log(`User found: ${user._id}. Generating reset token...`);

        // Use the model's method to generate reset token
        user.generatePasswordReset();
        await user.save({ validateBeforeSave: false });

        console.log(`Reset token generated: ${user.resetPasswordToken}`);

        // Check if email configuration exists
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.error("Email configuration missing. Check EMAIL_USER and EMAIL_PASS in .env file");
            return res.status(500).json({
                message: "Server configuration error. Please contact administrator.",
                details: "Email configuration is missing"
            });
        }

        // Check if client URL is configured
        if (!process.env.CLIENT_URL) {
            console.error("CLIENT_URL is missing in .env file");
            return res.status(500).json({
                message: "Server configuration error. Please contact administrator.",
                details: "Client URL configuration is missing"
            });
        }

        // Email Configuration
        console.log("Setting up email transport with nodemailer...");
        const transporter = nodemailer.createTransport({
            service: "Gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        const resetLink = `${process.env.CLIENT_URL}/resetpassword/${user.resetPasswordToken}`;
        console.log(`Reset link generated: ${resetLink}`);

        const mailOptions = {
            to: user.email,
            from: process.env.EMAIL_USER,
            subject: "Sahara Journal - Password Reset Request",
            text: `Hello ${user.name},\n\nYou requested a password reset for your Sahara Journal account.\n\nClick the following link to reset your password: ${resetLink}\n\nThis link will expire in 1 hour.\n\nIf you did not request this, please ignore this email and your password will remain unchanged.\n\nRegards,\nThe Sahara Journal Team`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                    <h2 style="color: #2563eb;">Sahara Journal Password Reset</h2>
                    <p>Hello ${user.name},</p>
                    <p>You requested a password reset for your Sahara Journal account.</p>
                    <p>Click the button below to reset your password:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Reset Password</a>
                    </div>
                    <p>Or copy and paste this link in your browser:</p>
                    <p style="word-break: break-all; color: #4b5563;"><a href="${resetLink}">${resetLink}</a></p>
                    <p>This link will expire in 1 hour.</p>
                    <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
                    <p>Regards,<br>The Sahara Journal Team</p>
                </div>
            `
        };

        console.log("Attempting to send email...");
        try {
            const info = await transporter.sendMail(mailOptions);
            console.log("Email sent successfully:", info.messageId);
            res.json({
                message: "Password reset link sent to email",
                details: "Please check your inbox and spam folder"
            });
        } catch (emailError) {
            console.error("Email sending failed:", emailError);
            // Save the token anyway so we can manually provide it if needed
            res.status(500).json({
                message: "Failed to send email. Please try again later or contact support.",
                error: emailError.message
            });
        }

    } catch (error) {
        console.error("Forgot Password Error:", error);
        res.status(500).json({
            message: "Server error during password reset process",
            error: error.message
        });
    }
};

// Reset Password
exports.resetPassword = async (req, res) => {
    try {
        console.log("Reset password request received:", req.params, req.body);

        // Get token from params or body
        const token = req.params.token || req.body.token || '';
        const password = req.body.password || ''; // Don't trim password

        console.log(`Processing reset password with token: ${token.substring(0, 10)}...`);

        if (!token || !password) {
            console.log("Missing required fields:", { hasToken: !!token, hasPassword: !!password });
            return res.status(400).json({ message: "Token and password are required" });
        }

        // Find user with this token
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }, // Ensures token is not expired
        });

        if (!user) {
            console.log("Invalid or expired token");
            return res.status(400).json({ message: "Invalid or expired reset token" });
        }

        console.log(`Valid token found for user: ${user._id}`);

        // Update password - let pre-save hook handle hashing
        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();
        console.log("Password reset successful");

        res.json({ message: "Password reset successful. You can now log in." });

    } catch (error) {
        console.error("Reset Password Error:", error);
        res.status(500).json({
            message: "Server error during password reset",
            error: error.message
        });
    }
};

// Get User Profile
exports.getProfile = async (req, res) => {
    try {
        // The user ID comes from the protect middleware
        const userId = req.user.id;

        if (!userId) {
            return res.status(401).json({ message: "Not authenticated" });
        }

        // Find user by ID but don't return the password
        const user = await User.findById(userId).select('-password');

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Return user data
        res.json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        console.error("Get Profile Error:", error);
        res.status(500).json({ message: "Server error" });
    }
};