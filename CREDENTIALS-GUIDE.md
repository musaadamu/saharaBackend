# Credentials Management Guide for Sahara Journal System

This guide explains how to properly manage credentials for the Sahara Journal System.

## Important: Never Commit Credentials to Git

Credentials and secrets should never be committed to your Git repository. This includes:

- API keys
- OAuth tokens
- Database passwords
- JWT secrets
- Any other sensitive information

## How to Handle Credentials

### Local Development

1. **Use Environment Variables**:
   - Copy `.env.sample` to `.env` (which is gitignored)
   - Fill in your actual credentials in the `.env` file
   - The application will load these variables at runtime

   ```bash
   # Example of creating your .env file
   cp .env.sample .env
   # Then edit .env with your actual credentials
   ```

2. **Keep `.env` Local**:
   - Never commit your `.env` file
   - It's already added to `.gitignore`

### Production Deployment

1. **Set Environment Variables in Render Dashboard**:
   - Go to your service in the Render dashboard
   - Navigate to the "Environment" tab
   - Add each variable from your `.env` file
   - Click "Save Changes"

2. **Secure Your Credentials**:
   - Use strong, unique values for secrets
   - Regularly rotate credentials
   - Limit access to who can view these credentials

## Google Drive API Credentials

The Sahara Journal System uses Google Drive for file storage. To set up the Google Drive API:

1. **Create a Project in Google Cloud Console**:
   - Go to https://console.cloud.google.com/
   - Create a new project or select an existing one

2. **Enable the Google Drive API**:
   - In the API Library, search for "Google Drive API"
   - Click "Enable"

3. **Create OAuth Credentials**:
   - Go to "Credentials" in the left sidebar
   - Click "Create Credentials" and select "OAuth client ID"
   - Set up the OAuth consent screen
   - For application type, select "Web application"
   - Add authorized redirect URIs (including `https://developers.google.com/oauthplayground` for testing)

4. **Get a Refresh Token**:
   - Go to https://developers.google.com/oauthplayground/
   - Click the gear icon and check "Use your own OAuth credentials"
   - Enter your Client ID and Client Secret
   - Select the Drive API scopes: `https://www.googleapis.com/auth/drive` and `https://www.googleapis.com/auth/drive.file`
   - Click "Authorize APIs" and follow the prompts
   - Click "Exchange authorization code for tokens"
   - Copy the refresh token

5. **Create a Folder in Google Drive**:
   - Create a folder in Google Drive to store the journal files
   - Copy the folder ID from the URL (the long string after `/folders/` in the URL)

6. **Add Credentials to Environment Variables**:
   - Add the Client ID, Client Secret, Refresh Token, and Folder ID to your environment variables

## Credential Rotation

For security, you should regularly rotate your credentials:

1. **JWT Secret**:
   - Generate a new random string
   - Update the `JWT_SECRET` environment variable

2. **Google Drive API**:
   - Generate new OAuth credentials in the Google Cloud Console
   - Get a new refresh token
   - Update the environment variables

3. **MongoDB**:
   - Update your database user password in MongoDB Atlas
   - Update the connection string in your environment variables

## If Credentials Are Exposed

If you accidentally expose credentials:

1. **Revoke and Rotate Immediately**:
   - Consider the exposed credentials compromised
   - Generate new credentials and revoke the old ones
   - Update all services using these credentials

2. **Check for Unauthorized Access**:
   - Monitor your services for any unusual activity
   - Check access logs in Google Cloud Console and MongoDB Atlas

3. **Review Your Security Practices**:
   - Ensure `.env` is in your `.gitignore`
   - Consider using a secrets manager for production
   - Add pre-commit hooks to prevent committing secrets

Remember: Security is an ongoing process. Regularly review and update your security practices.
