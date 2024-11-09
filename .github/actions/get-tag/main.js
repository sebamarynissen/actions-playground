import github from '@actions/github';
import core from '@actions/core';

// console.log(github.context.payload.);
if (github.context.eventName === 'pull_request') {
	let { labels } = github.context.payload.pull_request;
	console.log(labels);
	// if (labels.includes('major')) {
	// 	core.setOutput('version', 'major');
	// } else if (labels.includes('minor')) {}
}

core.setOutput('version', '1.0.1');
