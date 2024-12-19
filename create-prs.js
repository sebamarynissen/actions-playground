// # create-prs.js
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import ora from 'ora';
import simpleGit from 'simple-git';
import { Octokit } from '@octokit/rest';
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const baseDir = process.cwd();
const git = simpleGit({ baseDir });
const owner = process.env.GITHUB_OWNER;
const repo = process.env.GITHUB_REPO;

import { stdin as input, stdout as output } from 'node:process';
const rl = readline.createInterface({ input, output });

const results = [
	{
		files: ['src/yaml/test.yaml'],
		branch: 'package/smf-16/one',
		title: 'pkg: smf-16:one',
		body: 'Adds the following packages:\n- smf-16:one\n- smf-16:one-resources',
	},
	{
		files: ['src/yaml/date.yaml'],
		branch: 'package/smf-16/date',
		title: 'pkg: smf-16:date',
		body: 'Adds the following packages:\n- smf-16:date',
	},
];

async function handleResult(result) {

	// If a PR already exists for this branch, it's probably a fix deployed by 
	// the creator of the package. This means we have to fetch the branch from 
	// the server.
	let { pr } = result;
	if (pr) {
		let spinner = ora(`Checking out origin/${result.branch}`);
		await git.checkoutBranch(result.branch, `origin/${result.branch}`);
		spinner.succeed();
	} else {
		let spinner = ora(`Creating new branch ${result.branch}`);
		await git.checkoutLocalBranch(result.branch);
		spinner.succeed();
	}

	// Re-apply the changes from this package.
	for (let file of result.files) {
		await fs.promises.writeFile(file.path, file.contents);
	}

	// Add all the modified files & then commit.
	spinner = ora('Committing files').start();
	for (let file of result.files) {
		await git.add(file.name);
	}
	await git.commit(result.title);
	spinner.succeed();
	spinner = ora(`Pushing ${result.branch} to origin`).start();
	await git.push('origin', result.branch);
	spinner.succeed();

	// If no PR existeed yet, then we have to push the branch. Otherwise it will 
	// be handled for us.
	if (!pr) {
		let spinner = ora('Creating new PR on GitHub').start();
		const { data: pr } = await octokit.pulls.create({
			owner,
			repo,
			base: 'main',
			title: result.title,
			head: result.branch,
			body: result.body,
		});
		spinner.succeed();

		spinner = ora('Adding labels').start();
		octokit.issues.addLabels({
			owner,
			repo,
			issue_number: pr.number,
			labels: ['package'],
		});
		spinner.succeed();
	}

	// Cool, now delete the branch again.
	await git.checkout('main');
	await git.deleteLocalBranch(result.branch, true);

}

// Generate some fake file data first.
for (let result of results) {
	for (let file of result.files) {
		await fs.promises.mkdir(path.dirname(file), { recursive: true });
		await fs.promises.writeFile(file, new Date().toISOString());
	}
}

// At this point, we assume that the repository is on the main branch, but not 
// in a clean state, meaning the added files are in the src/yaml file. However, 
// we will need to fetch the branch of existing repos one by one, so we will 
// read in all files in memory and then stash any changes.
console.log(await git.add('.'));

await rl.question('Press any key to continue');

for (let result of results) {
	let files = [];
	for (let name of result.files) {
		let fullPath = path.join(process.env.GITHUB_WORKSPACE, name);
		let contents = await fs.promises.readFile(fullPath);
		files.push({
			name,
			path: fullPath,
			contents,
		});
	}
	result.files = files;
}

// Fetch all open PRs from GitHub so that can figure out which files are updates 
// of existing, open PR's.
let spinner = ora('Fetching open pull requests from GitHub').start();
const { data: prs } = await octokit.pulls.list({
	owner,
	repo,
	state: 'open',
});
spinner.succeed();

// Create PR's and update branches for every result.
for (let result of results) {
	await handleResult({
		pr: prs.find(pr => pr.head.ref === result.branch),
		...result,
	});
}
