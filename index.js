import express from 'express';
import { App } from '@octokit/app';
import { Webhooks } from '@octokit/webhooks';
import { Client as NotionClient } from '@notionhq/client';
import { graphql } from '@octokit/graphql';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Flag to track if schema has been initialized
let schemaInitialized = false;

// Initialize GitHub App
const githubApp = new App({
  appId: process.env.GITHUB_APP_ID,
  privateKey: process.env.GITHUB_APP_PRIVATE_KEY,
});

// Initialize Notion client
const notion = new NotionClient({
  auth: process.env.NOTION_API_KEY,
});

// Initialize webhooks
const webhooks = new Webhooks({
  secret: process.env.GITHUB_WEBHOOK_SECRET || 'optional-secret',
});

// Middleware
app.use(express.json());

// Webhook endpoint
app.post('/webhook', async (req, res) => {
  console.log('Received webhook:', {
    event: req.headers['x-github-event'],
    delivery: req.headers['x-github-delivery'],
    signature: req.headers['x-hub-signature-256'] ? 'present' : 'missing'
  });
  
  const signature = req.headers['x-hub-signature-256'];
  
  if (!signature) {
    console.error('Missing signature header');
    return res.status(401).send('Missing signature');
  }

  try {
    await webhooks.verifyAndReceive({
      id: req.headers['x-github-delivery'],
      name: req.headers['x-github-event'],
      signature: signature,
      payload: JSON.stringify(req.body),
    });
    
    console.log('Webhook processed successfully');
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook verification failed:', error);
    res.status(401).send('Unauthorized');
  }
});

// Handle project_card events
webhooks.on(['project_card.created', 'project_card.moved', 'project_card.deleted'], async ({ payload }) => {
  console.log(`Received ${payload.action} event for project card`);
  
  try {
    // For Projects v2, we need to use GraphQL API
    const installation = await githubApp.getInstallationOctokit(payload.installation.id);
    
    // Sync the project item
    await syncProjectItem(installation, payload);
  } catch (error) {
    console.error('Error handling webhook:', error);
  }
});

// Handle projects_v2_item events
webhooks.on(['projects_v2_item.created', 'projects_v2_item.edited', 'projects_v2_item.deleted'], async ({ payload }) => {
  console.log(`Received ${payload.action} event for project v2 item`);
  console.log('Installation ID:', payload.installation?.id);
  console.log('Project ID:', payload.projects_v2_item?.project_node_id);
  
  try {
    const installation = await githubApp.getInstallationOctokit(payload.installation.id);
    
    // Initialize schema on first webhook if not done yet
    if (!schemaInitialized) {
      console.log('First webhook received, initializing schema...');
      const projectFields = await fetchProjectFields(installation, process.env.GITHUB_PROJECT_ID);
      await ensureNotionSchema(projectFields);
      schemaInitialized = true;
    }
    
    await syncProjectItem(installation, payload);
  } catch (error) {
    console.error('Error handling webhook:', error);
  }
});

// Function to fetch project fields schema
async function fetchProjectFields(octokit, projectId) {
  const query = `
    query($projectId: ID!) {
      node(id: $projectId) {
        ... on ProjectV2 {
          fields(first: 50) {
            nodes {
              ... on ProjectV2Field {
                id
                name
                dataType
              }
              ... on ProjectV2SingleSelectField {
                id
                name
                dataType
                options {
                  id
                  name
                }
              }
            }
          }
        }
      }
    }
  `;
  
  const result = await octokit.graphql(query, { projectId });
  return result.node.fields.nodes;
}

// Map GitHub field types to Notion property types
function mapGitHubTypeToNotion(githubType) {
  const typeMap = {
    'SINGLE_SELECT': 'select',
    'DATE': 'date',
    'NUMBER': 'number',
    'TITLE': 'title',
    'TEXT': 'rich_text',
  };
  return typeMap[githubType] || 'rich_text';
}

// Function to ensure Notion database has all required fields
async function ensureNotionSchema(projectFields) {
  try {
    // Get existing Notion database schema
    const database = await notion.databases.retrieve({
      database_id: process.env.NOTION_DATABASE_ID,
    });
    
    const existingProperties = Object.keys(database.properties);
    console.log('Existing Notion properties:', existingProperties);
    
    // Fields to create
    const fieldsToCreate = {};
    
    // Add our custom fields that are always needed
    const customFields = {
      'Issue Number': { type: 'number', number: {} },
      'Project Status': { type: 'select', select: { options: [] } },
      'Added to Project': { type: 'date', date: {} },
      'Status Updated': { type: 'date', date: {} },
      'Repository': { type: 'rich_text', rich_text: {} },
      'Project Name': { type: 'rich_text', rich_text: {} },
      'GitHub URL': { type: 'url', url: {} },
      'GitHub ID': { type: 'rich_text', rich_text: {} },
    };
    
    // Check custom fields
    for (const [fieldName, fieldConfig] of Object.entries(customFields)) {
      if (!existingProperties.includes(fieldName)) {
        fieldsToCreate[fieldName] = fieldConfig;
      }
    }
    
    // Check GitHub project fields
    for (const field of projectFields) {
      if (field.name && field.dataType && !existingProperties.includes(field.name)) {
        const notionType = mapGitHubTypeToNotion(field.dataType);
        
        if (notionType === 'select' && field.options) {
          fieldsToCreate[field.name] = {
            type: 'select',
            select: {
              options: field.options.map(opt => ({
                name: opt.name,
                color: 'default'
              }))
            }
          };
        } else if (notionType !== 'title') { // Skip title as it already exists
          fieldsToCreate[field.name] = { 
            type: notionType,
            [notionType]: {} 
          };
        }
      }
    }
    
    // Create missing fields
    if (Object.keys(fieldsToCreate).length > 0) {
      console.log('Creating missing fields:', Object.keys(fieldsToCreate));
      
      await notion.databases.update({
        database_id: process.env.NOTION_DATABASE_ID,
        properties: fieldsToCreate,
      });
      
      console.log('Successfully created missing fields');
    } else {
      console.log('All required fields already exist');
    }
    
  } catch (error) {
    console.error('Error ensuring Notion schema:', error);
  }
}

// Function to fetch project item details using GraphQL
async function fetchProjectItem(octokit, itemId) {
  const query = `
    query($itemId: ID!) {
      node(id: $itemId) {
        ... on ProjectV2Item {
          id
          content {
            ... on Issue {
              number
              title
              body
              url
              repository {
                name
                owner {
                  login
                }
              }
            }
          }
          project {
            title
            number
          }
          fieldValues(first: 20) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field {
                  ... on ProjectV2SingleSelectField {
                    name
                  }
                }
              }
              ... on ProjectV2ItemFieldDateValue {
                date
                field {
                  ... on ProjectV2Field {
                    name
                  }
                }
              }
            }
          }
          createdAt
          updatedAt
        }
      }
    }
  `;
  
  const result = await octokit.graphql(query, { itemId });
  return result.node;
}

// Function to get item status from field values
function getItemStatus(item) {
  if (!item.fieldValues || !item.fieldValues.nodes) {
    return 'No Status';
  }
  
  for (const fieldValue of item.fieldValues.nodes) {
    if (fieldValue.field && fieldValue.field.name === 'Status' && fieldValue.name) {
      return fieldValue.name;
    }
  }
  
  return 'No Status';
}

// Function to sync project item to Notion
async function syncProjectItem(octokit, payload) {
  try {
    let itemId;
    
    // Handle different payload structures
    if (payload.projects_v2_item) {
      itemId = payload.projects_v2_item.node_id;
    } else if (payload.project_card) {
      // For legacy project cards, we need to handle differently
      console.log('Legacy project card events are not fully supported');
      return;
    }
    
    if (!itemId) {
      console.error('No item ID found in payload');
      return;
    }
    
    // Fetch full item details
    const item = await fetchProjectItem(octokit, itemId);
    
    if (!item || !item.content) {
      console.log('No content found for item');
      return;
    }
    
    // Extract data
    const status = getItemStatus(item);
    const githubId = `${item.content.repository.owner.login}/${item.content.repository.name}#${item.content.number}`;
    
    const notionData = {
      'Title': {
        title: [
          {
            text: {
              content: item.content.title || 'Untitled',
            },
          },
        ],
      },
      'Issue Number': {
        number: item.content.number,
      },
      'Project Status': {
        select: {
          name: status,
        },
      },
      'Added to Project': {
        date: {
          start: item.createdAt,
        },
      },
      'Status Updated': {
        date: {
          start: item.updatedAt,
        },
      },
      'Repository': {
        rich_text: [
          {
            text: {
              content: item.content.repository.name,
            },
          },
        ],
      },
      'Project Name': {
        rich_text: [
          {
            text: {
              content: item.project.title,
            },
          },
        ],
      },
      'GitHub URL': {
        url: item.content.url,
      },
      'GitHub ID': {
        rich_text: [
          {
            text: {
              content: githubId,
            },
          },
        ],
      },
    };
    
    // Check if item exists in Notion
    const existingPages = await notion.databases.query({
      database_id: process.env.NOTION_DATABASE_ID,
      filter: {
        property: 'GitHub ID',
        rich_text: {
          equals: githubId,
        },
      },
    });
    
    if (payload.action === 'deleted') {
      // Delete from Notion if exists
      if (existingPages.results.length > 0) {
        await notion.pages.update({
          page_id: existingPages.results[0].id,
          archived: true,
        });
        console.log(`Deleted item ${githubId} from Notion`);
      }
    } else {
      if (existingPages.results.length > 0) {
        // Update existing page
        await notion.pages.update({
          page_id: existingPages.results[0].id,
          properties: notionData,
        });
        console.log(`Updated item ${githubId} in Notion`);
      } else {
        // Create new page
        await notion.pages.create({
          parent: { database_id: process.env.NOTION_DATABASE_ID },
          properties: notionData,
        });
        console.log(`Created item ${githubId} in Notion`);
      }
    }
  } catch (error) {
    console.error('Error syncing to Notion:', error);
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});


// Start server
app.listen(port, () => {
  console.log(`GitHub-Notion sync app listening on port ${port}`);
});