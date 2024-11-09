import github from '@actions/github';
import core from '@actions/core';

console.log(github.context);

core.setOutput('version', '1.0.1');
