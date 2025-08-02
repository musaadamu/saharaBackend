// Simple CORS test script
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3001;

// CORS Configuration
const corsOptions = {
    origin: [
        'http://localhost:3000',
        'http://localhost:5000',
        'https://sahara-journal-frontend.vercel.app',
        'https://sahara-journal.vercel.app',
        'https://www.sijtejournal.com.ng'
    ],
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

app.get('/test-cors', (req, res) => {
    res.json({
        message: 'CORS is working correctly!',
        origin: req.headers.origin,
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`CORS test server running on http://localhost:${PORT}`);
    console.log('Allowed origins:', corsOptions.origin);
});
