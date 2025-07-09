# GitHub Projects → Notion Sync

A GitHub App that synchronizes tasks from GitHub Projects (v2) to a Notion database.

## Features

- Real-time synchronization of GitHub Project items to Notion
- Tracks project-specific status (not issue state)
- Webhook support for automatic updates
- Manual sync capability
- Support for GitHub Projects v2 GraphQL API
- **Auto-creates Notion database schema** from GitHub Project structure
- **Syncs ALL project fields** including custom fields:
  - Date fields (Start date, End date, any custom dates)
  - Select fields (Priority, Size, custom dropdowns)
  - Number fields (Estimate, custom numbers)
  - Text fields (custom text)
- Fields are synced by name - no special naming required

## Prerequisites

1. A GitHub App with the following permissions:
   - Issues: Read
   - Projects: Read
   
2. Webhook events configured:
   - `projects_v2_item` (created, edited, deleted)
   - `project_card` (created, moved, deleted) - for legacy support

3. A Notion integration and database:
   - Start with an empty database (just the default "Name" field)
   - The app automatically creates ALL fields from your GitHub Project
   - No specific field names required - it syncs whatever you have!

## How Fields Are Synced

The app creates different types of fields in your Notion database:

### 1. System Fields (Always Created)
These fields are created by the app for tracking:
- **Name** - Issue title
- **Issue Number** - GitHub issue number
- **GitHub ID** - Unique identifier (owner/repo#number)
- **GitHub URL** - Direct link to the issue
- **Repository** - Repository name
- **Project Name** - GitHub Project name
- **Added to Project** - When the issue was added to the project
- **Status Updated** - Last status change timestamp
- **Project Status** - Current project column/status

### 2. Default GitHub Project Fields
These fields exist in every GitHub Project by default:
- **Status** - Project columns (Todo, In Progress, Done, etc.)
- **Assignees** - Who the issue is assigned to
- **Labels** - Issue labels
- **Milestone** - Issue milestone
- **Linked pull requests** - Associated PRs
- **Title** - Issue title (mapped to Name)

### 3. Common Custom Fields
These are popular fields often added to projects (optional):
- **Priority** (select) - P0, P1, P2, etc.
- **Size** (select) - XS, S, M, L, XL
- **Start date** (date) - Planned start date
- **End date** (date) - Planned end date
- **Estimate** (number) - Time/effort estimation

### 4. Your Custom Fields
Any custom fields you add to your GitHub Project are automatically synced:
- Date fields (any name)
- Select fields with custom options
- Number fields
- Text fields

All fields from categories 2, 3, and 4 are dynamically pulled from your GitHub Project configuration!

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
