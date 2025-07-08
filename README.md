# GitHub Projects → Notion Sync

A GitHub App that synchronizes tasks from GitHub Projects (v2) to a Notion database.

## Features

- Real-time synchronization of GitHub Project items to Notion
- Tracks project-specific status (not issue state)
- Webhook support for automatic updates
- Manual sync capability
- Support for GitHub Projects v2 GraphQL API

## Prerequisites

1. A GitHub App with the following permissions:
   - Issues: Read
   - Projects: Read
   
2. Webhook events configured:
   - `projects_v2_item` (created, edited, deleted)
   - `project_card` (created, moved, deleted) - for legacy support

3. A Notion integration and database with these properties:
   - **Title** (title) - Issue title
   - **Issue Number** (number) - Issue number
   - **Project Status** (select) - Status from project columns
   - **Added to Project** (date) - When added to project
   - **Status Updated** (date) - Last status change
   - **Repository** (rich_text) - Repository name
   - **Project Name** (rich_text) - Project name
   - **GitHub URL** (url) - Link to issue
   - **GitHub ID** (rich_text) - Unique identifier

## Installation

1. Clone the repository:
```bash
git clone git@github.com:anastasiabusygina/github-notion-app.git
cd github-notion-app
```

2. Install dependencies:
```bash
npm install
```

3. Copy `.env.example` to `.env` and fill in your credentials:
```bash
cp .env.example .env
```

4. Configure environment variables:
   - `GITHUB_APP_ID` - Your GitHub App ID
   - `GITHUB_APP_PRIVATE_KEY` - Your GitHub App private key
   - `GITHUB_WEBHOOK_SECRET` - Your webhook secret
   - `NOTION_API_KEY` - Your Notion integration token
   - `NOTION_DATABASE_ID` - Your Notion database ID
   - `GITHUB_PROJECT_ID` - The node ID of your GitHub Project (v2)
   - `PORT` - Server port (default: 3000)

## Usage

### Start the webhook server:
```bash
npm start
```

### Development mode (with auto-reload):
```bash
npm run dev
```

### Manual sync:
```bash
node sync-project.js <installation-id>
```

## How it works

1. The app listens for GitHub webhook events on `/webhook`
2. When a project item is created, moved, or deleted:
   - Fetches full item details using GitHub GraphQL API
   - Extracts the project-specific status (from project columns)
   - Creates or updates the corresponding entry in Notion
3. Supports pagination for large projects
4. Handles both creation and updates based on GitHub ID

## API Endpoints

- `POST /webhook` - GitHub webhook endpoint
- `GET /health` - Health check endpoint

## Architecture

- `index.js` - Main application with webhook handlers
- `sync-project.js` - Manual sync utility
- Uses GitHub Projects v2 GraphQL API
- Notion API for database operations

## Important Notes

- This app specifically syncs **project column status**, not issue state
- Designed for GitHub Projects v2 (not classic projects)
- Uses GraphQL for efficient data fetching
- Supports real-time updates via webhooks
