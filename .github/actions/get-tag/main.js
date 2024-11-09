import github from '@actions/github';
import core from '@actions/github';

console.log('running from a PR');
console.log(github.context);

core.setOutput('version', '1.0.1');
