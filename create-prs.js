// # create-prs.js
import fs from 'node:fs';
import path from 'node:path';
import ora from 'ora';
import simpleGit from 'simple-git';
import { Octokit } from '@octokit/rest';
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const baseDir = process.cwd();
const git = simpleGit({ baseDir });

const wait = ms => new Promise(cb => setTimeout(cb, ms));
const randomHex = () => Math.random().toString(16).slice(2);

const results = [
	{
		files: ['src/yaml/test.yaml'],
		branch: 'package/smf-16/one',
		title: 'pkg: smf-16:one',
		body: 'Adds the following packages:\n- smf-16:one\n- smf-16:one-resources',
	},
];

async function handleResult(result) {

	// We will first list all PR's
	const owner = process.env.GITHUB_OWNER;
	const repo = process.env.GITHUB_REPO;
	let spinner = ora('Getting open pull requests').start();
	const { data: prs } = await octokit.pulls.list({
		owner,
		repo,
		state: 'open',
		head: `${process.env.GH_OWNER}/${result.branch}`,
	});
	spinner.succeed();

	// If a PR already exists for this branch, it's probably a fix deployed by 
	// the creator of the package. This means we have to fetch the branch from 
	// the server.
	if (prs.length > 0) {

		// If a PR already exists, we'll commit the changes to a local "staging" 
		// branch so that we can check them out later on.
		let staging = `staging-${randomHex()}`;
		await git.checkoutLocalBranch(staging);
		await git.add('.');
		await git.commit('Staging');
		let spinner = ora(`Pulling ${result.branch}`);
		await git.fetch();
		await git.checkoutBranch(result.branch, `origin/${result.branch}`);
		spinner.succeed();

		// Reapply staging now.
		spinner = ora('Reapplying stash');
		await git.checkout(staging, '--', ...result.files);
		// await git.checkout('stash@{0}', '--', '.');
		// await git.stash('drop');
		// spinner.succeed();

	} else {
		let spinner = ora(`Creating new branch ${result.branch}`);
		await git.checkoutLocalBranch(result.branch);
		spinner.succeed();
	}

	// Add all the modified files & then commit.
	// spinner = ora('Committing files').start();
	// for (let file of result.files) {
	// 	await git.add(file);
	// }
	// await git.commit(result.title);
	// spinner.succeed();
	// spinner = ora(`Pushing ${result.branch} to origin`).start();
	// await git.push('origin', result.branch);
	// spinner.succeed();

	// // If no PR existeed yet, then we have to push the branch. Otherwise it will 
	// // be handled for us.
	// if (prs.length === 0) {
	// 	let spinner = ora('Creating new PR on GitHub').start();
	// 	const { data: pr } = await octokit.pulls.create({
	// 		owner,
	// 		repo,
	// 		base: 'main',
	// 		title: result.title,
	// 		head: result.branch,
	// 		body: result.body,
	// 	});
	// 	spinner.succeed();

	// 	spinner = ora('Adding labels').start();
	// 	octokit.issues.addLabels({
	// 		owner,
	// 		repo,
	// 		issue_number: pr.number,
	// 		labels: ['package'],
	// 	});
	// 	spinner.succeed();

	// }

	// Cool, now delete the branch again.
	// await git.checkout('main');
	// await git.deleteLocalBranch(result.branch, true);

}

// Generate some fake file data first.
for (let result of results) {
	for (let file of result.files) {
		await fs.promises.mkdir(path.dirname(file), { recursive: true });
		await fs.promises.writeFile(file, String(Math.random()));
	}
}

for (let result of results) {
	await handleResult(result);
}
