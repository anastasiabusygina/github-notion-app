import { App } from '@octokit/app';
import { Client as NotionClient } from '@notionhq/client';
import dotenv from 'dotenv';
import logger from './logger.js';

dotenv.config();

const githubApp = new App({
  appId: process.env.GITHUB_APP_ID,
  privateKey: process.env.GITHUB_APP_PRIVATE_KEY,
});

const notion = new NotionClient({
  auth: process.env.NOTION_API_KEY,
});

// Function to fetch all items from a project
async function fetchAllProjectItems(octokit, projectId) {
  const query = `
    query($projectId: ID!, $cursor: String) {
      node(id: $projectId) {
        ... on ProjectV2 {
          title
          items(first: 100, after: $cursor) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
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
      }
    }
  `;
  
  let allItems = [];
  let hasNextPage = true;
  let cursor = null;
  
  while (hasNextPage) {
    const result = await octokit.graphql(query, { 
      projectId, 
      cursor 
    });
    
    const project = result.node;
    allItems = allItems.concat(project.items.nodes);
    
    hasNextPage = project.items.pageInfo.hasNextPage;
    cursor = project.items.pageInfo.endCursor;
    
    logger.info(`Fetched ${allItems.length} items from project "${project.title}"`);
  }
  
  return allItems;
}

// Function to get item status
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

// Main sync function
async function syncProjectToNotion(installationId) {
  try {
    const octokit = await githubApp.getInstallationOctokit(installationId);
    
    logger.info('Fetching project items...');
    const items = await fetchAllProjectItems(octokit, process.env.GITHUB_PROJECT_ID);
    
    logger.info(`Found ${items.length} items to sync`);
    
    for (const item of items) {
      if (!item.content) {
        logger.warn('Skipping item without content');
        continue;
      }
      
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
                content: 'GitHub Project', // Will be updated from the query
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
      
      // Check if item exists
      const existingPages = await notion.databases.query({
        database_id: process.env.NOTION_DATABASE_ID,
        filter: {
          property: 'GitHub ID',
          rich_text: {
            equals: githubId,
          },
        },
      });
      
      if (existingPages.results.length > 0) {
        // Update existing
        await notion.pages.update({
          page_id: existingPages.results[0].id,
          properties: notionData,
        });
        logger.info(`Updated: ${githubId}`);
      } else {
        // Create new
        await notion.pages.create({
          parent: { database_id: process.env.NOTION_DATABASE_ID },
          properties: notionData,
        });
        logger.info(`Created: ${githubId}`);
      }
    }
    
    logger.info('Sync completed!');
  } catch (error) {
    logger.error('Sync failed', { error: error.message, stack: error.stack });
  }
}

// Run sync if called directly
if (process.argv[2]) {
  const installationId = process.argv[2];
  syncProjectToNotion(installationId);
} else {
  logger.error('Usage: node sync-project.js <installation-id>');
}