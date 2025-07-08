import express from 'express';
import { App } from '@octokit/app';
import { Webhooks } from '@octokit/webhooks';
import { Client as NotionClient } from '@notionhq/client';
import { graphql } from '@octokit/graphql';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

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
    await syncProjectItem(installation, payload);
  } catch (error) {
    console.error('Error handling webhook:', error);
  }
});

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