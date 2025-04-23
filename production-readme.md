# Sahara Journal System - Production Deployment Guide

This guide explains how to deploy the Sahara Journal System to production environments using Vercel (frontend) and Render (backend).

## Backend Deployment (Render)

1. **Create a new Web Service on Render**
   - Connect your GitHub repository
   - Select the branch to deploy
   - Set the build command: `npm install`
   - Set the start command: `node server.js`

2. **Set Environment Variables**
   Copy all variables from `.env.production` to Render's environment variables section:

   ```
   NODE_ENV=production
   MONGODB_URI=mongodb+srv://msmajemusa4:5mHVuJ8rJDs1kAU4@saharajournal.upe7l.mongodb.net/?retryWrites=true&w=majority&appName=saharajournal
   JWT_SECRET=Jx92!mN#5rQzT8vVpY7
   PORT=5000
   GOOGLE_CLIENT_ID=38551269334-krfornjs786u7qv2qv3rfv82q294i9h0.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=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
   GOOGLE_REFRESH_TOKEN=1//03V3pWNvmlPmKCgYIARAAGAMSNwF-L9IrIowUTTqUjVvPNH_ArK62xCwh6qOLFuYOfad9CC7q-euY9qDv-KmN8ZQxFVFRh6Mz_v0
   GOOGLE_DRIVE_FOLDER_ID=1zsFE8u3niAJWDXyKlq6p4tv3do7ns7f6
   DOCUMENT_STORAGE_PATH=/tmp/journals
   DOCUMENT_STORAGE_URL=https://saharabackend-v190.onrender.com/api/journals/download
   ```

3. **Important Notes for Render Deployment**
   - Render's filesystem is ephemeral, meaning files saved to the filesystem will be lost when the service restarts
   - The system is configured to use Google Drive for persistent storage
   - Temporary files are stored in `/tmp/journals` which is available but not persistent
   - The backend URL is `https://saharabackend-v190.onrender.com/api`

## Frontend Deployment (Vercel)

1. **Create a new Project on Vercel**
   - Connect your GitHub repository
   - Select the frontend directory as the root directory
   - Use the default build settings

2. **Set Environment Variables**
   - No additional environment variables are needed for the frontend
   - The frontend is configured to use `https://saharabackend-v190.onrender.com/api` as the backend URL in production

3. **Important Notes for Vercel Deployment**
   - The frontend is a static site that communicates with the backend API
   - CORS is configured to allow requests from any origin in development, but only from specific origins in production
   - File uploads and downloads are handled by the backend

## Testing the Deployment

After deploying both the frontend and backend, test the following functionality:

1. **Journal Upload**
   - Upload a journal with a DOCX file
   - Verify that the journal is saved in the database
   - Verify that the file is uploaded to Google Drive

2. **Journal Download**
   - Download a journal's DOCX and PDF files
   - Verify that the files are downloaded correctly

3. **Journal Management**
   - Create, read, update, and delete journals
   - Search for journals

## Troubleshooting

If you encounter issues with the deployment, check the following:

1. **Backend Logs**
   - Check the logs in the Render dashboard
   - Look for error messages related to Google Drive, MongoDB, or file operations

2. **Frontend Console**
   - Open the browser's developer tools
   - Check the console for error messages
   - Verify that API requests are going to the correct URL

3. **Google Drive**
   - Verify that the Google Drive API is enabled
   - Check that the credentials are correct
   - Verify that the folder ID is correct and accessible

4. **MongoDB**
   - Verify that the MongoDB connection string is correct
   - Check that the database is accessible from Render

## Maintenance

To maintain the deployment:

1. **Update Google Drive Tokens**
   - The refresh token may expire after a certain period
   - If this happens, generate a new refresh token and update it in the environment variables

2. **Monitor Disk Usage**
   - Render has limits on disk usage
   - The system is designed to clean up temporary files, but monitor disk usage to ensure it doesn't exceed limits

3. **Database Backups**
   - MongoDB Atlas provides automated backups
   - Consider setting up additional backup procedures for critical data
