import { App } from '@octokit/app';
import dotenv from 'dotenv';

dotenv.config();

const githubApp = new App({
  appId: process.env.GITHUB_APP_ID,
  privateKey: process.env.GITHUB_APP_PRIVATE_KEY,
});

async function findProjects(installationId) {
  const octokit = await githubApp.getInstallationOctokit(installationId);
  
  // Query to find all projects
  const query = `
    query {
      viewer {
        projectsV2(first: 20) {
          nodes {
            id
            title
            number
            url
          }
        }
      }
    }
  `;
  
  try {
    const result = await octokit.graphql(query);
    console.log('Found projects:');
    result.viewer.projectsV2.nodes.forEach(project => {
      console.log(`\nTitle: ${project.title}`);
      console.log(`ID: ${project.id}`);
      console.log(`Number: ${project.number}`);
      console.log(`URL: ${project.url}`);
    });
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run with installation ID as argument
if (process.argv[2]) {
  findProjects(process.argv[2]);
} else {
  console.log('Usage: node find-project-id.js <installation-id>');
}