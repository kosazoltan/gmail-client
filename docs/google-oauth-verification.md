# ZMail - Google OAuth App Verification Guide

## Overview

This document contains all the information needed to submit ZMail for Google OAuth verification.

## Application Information

- **App Name:** ZMail
- **Project ID:** zmail-485804
- **Client ID:** 694501523042-oc18ung7lebd9nsg7bf6vlc77lth3kte.apps.googleusercontent.com
- **Application Type:** Web Application
- **Homepage URL:** https://mail.mindenes.org

## OAuth Consent Screen Configuration

### Basic Information

| Field | Value |
|-------|-------|
| App name | ZMail |
| User support email | support@mindenes.org |
| App logo | (upload ZMail logo) |
| Application home page | https://mail.mindenes.org |
| Application privacy policy link | https://mail.mindenes.org/privacy |
| Application terms of service link | https://mail.mindenes.org/terms |
| Authorized domains | mindenes.org |
| Developer contact email | developer@mindenes.org |

### Scopes Requested

The application requests the following OAuth scopes:

| Scope | Purpose | Sensitivity |
|-------|---------|-------------|
| `https://www.googleapis.com/auth/gmail.readonly` | Read email messages and metadata | Sensitive |
| `https://www.googleapis.com/auth/gmail.send` | Send email messages | Sensitive |
| `https://www.googleapis.com/auth/gmail.modify` | Modify email labels and status | Sensitive |
| `https://www.googleapis.com/auth/gmail.labels` | Manage email labels | Sensitive |
| `https://www.googleapis.com/auth/userinfo.email` | Get user email address | Non-sensitive |
| `https://www.googleapis.com/auth/userinfo.profile` | Get user profile information | Non-sensitive |

## App Description (for Google Review)

### Short Description (max 100 characters)
```
ZMail is a personal Gmail client with smart email organization and productivity features.
```

### Full Description
```
ZMail is a modern, responsive web application that serves as a personal Gmail client.
It provides an enhanced email experience with features like:

- Smart email organization by sender, topic, time period, and category
- Advanced search capabilities with saved searches
- Email reminders and follow-up tracking
- Newsletter management
- Attachment browser
- Multi-account support
- Dark mode support
- Responsive design for desktop and mobile

ZMail uses Gmail API to access and manage user emails. All data is stored locally
and is never shared with third parties. Users can revoke access at any time through
their Google Account settings.

The application is designed for personal use and does not collect, analyze, or sell
user data for advertising or any commercial purposes.
```

## Justification for Sensitive Scopes

### gmail.readonly
**Justification:** Required to display user's emails in the application. ZMail reads email content, metadata (sender, subject, date), labels, and attachments to provide the core email viewing functionality.

### gmail.send
**Justification:** Required to allow users to compose and send new emails, reply to existing emails, and forward emails to other recipients.

### gmail.modify
**Justification:** Required to manage email status (read/unread), star emails, move emails between folders, and delete emails. These are core email management features.

### gmail.labels
**Justification:** Required to read and display Gmail labels/folders, and to organize emails into categories for the smart organization features.

## Data Handling Declaration

### Data Collection
- Email content and metadata (for display purposes)
- User profile information (email, name, profile picture)
- OAuth tokens (for authentication)

### Data Storage
- All data is stored locally on our secure server
- OAuth tokens are encrypted using AES-256
- Data is retained only while the user has an active account
- Users can request data deletion at any time

### Data Sharing
- **We do NOT share any user data with third parties**
- Data is only transmitted between the user's browser, our server, and Google APIs
- No data is sold, rented, or transferred to advertisers

### Data Usage
- Email data is used solely to provide email viewing and management features
- No automated analysis or profiling of email content
- No advertising based on email content

## Security Measures

1. **HTTPS only** - All connections are encrypted
2. **Token encryption** - OAuth refresh tokens are encrypted at rest using AES-256
3. **Secure sessions** - HTTP-only cookies with secure flag
4. **Input validation** - All user inputs are validated and sanitized
5. **Rate limiting** - API calls are rate-limited to prevent abuse
6. **Access controls** - Users can only access their own data

## Verification Checklist

### Before Submitting

- [x] Privacy Policy page created: https://mail.mindenes.org/privacy
- [x] Terms of Service page created: https://mail.mindenes.org/terms
- [ ] App logo uploaded to OAuth consent screen (minimum 120x120px)
- [ ] Support email configured and monitored
- [ ] All authorized domains verified in Google Search Console
- [ ] Test users removed or app set to production mode

### OAuth Consent Screen Settings in Google Cloud Console

1. Go to: https://console.cloud.google.com/apis/credentials/consent?project=zmail-485804
2. Click "Edit App"
3. Fill in all required fields as specified above
4. Add all scopes listed above
5. Add authorized domain: mindenes.org
6. Save and proceed to verification

### Submitting for Verification

1. Complete OAuth consent screen configuration
2. Click "Submit for Verification"
3. Provide the justification texts above when prompted
4. Upload any requested documentation
5. Respond promptly to any questions from Google

## Video Demonstration (if required)

Google may request a video demonstration showing:
1. User authentication flow (OAuth consent screen)
2. How the app uses Gmail data
3. Where user data is displayed in the app
4. How users can revoke access

### Suggested Video Script
```
1. Open ZMail at https://mail.mindenes.org
2. Click "Sign in with Google"
3. Show the OAuth consent screen with permissions
4. After login, show the inbox with emails
5. Demonstrate email viewing, composing, and sending
6. Show the different views (by sender, by topic, etc.)
7. Show settings and explain data handling
8. Demonstrate account removal/logout
```

## Contact Information for Google Review

| Contact Type | Email |
|--------------|-------|
| Developer contact | developer@mindenes.org |
| Support email | support@mindenes.org |
| Privacy inquiries | privacy@mindenes.org |

## Timeline

- Verification typically takes 3-5 business days for apps with sensitive scopes
- May take longer if additional documentation is requested
- Keep support email monitored during verification period

## Post-Verification

After verification is approved:
1. Remove any "unverified app" warnings from documentation
2. Update app status to "Production"
3. Consider applying for "Verified App" badge if applicable
4. Set up monitoring for OAuth consent rate and errors
