console.log('=== RESTARTING SERVER ===');
console.log('This script will restart the server with the latest code.');
console.log('Make sure to stop any existing server processes before running this script.');

// Import required modules
const { spawn } = require('child_process');
const path = require('path');

// Get the path to server.js
const serverPath = path.join(__dirname, 'server.js');
console.log('Server path:', serverPath);

// Start the server
console.log('Starting server...');
const server = spawn('node', [serverPath], {
  stdio: 'inherit',
  detached: true
});

// Log server process ID
console.log('Server started with PID:', server.pid);

// Unref the child process to allow the parent to exit
server.unref();
