const { spawn } = require('child_process');

// On Windows: use npm.cmd instead of npm command
const npm = /^win/.test(process.platform) ? 'npm.cmd' : 'npm';

// Start backend server
const serveBackend = spawn(npm, ['run', 'serve:backend']);
// Start frontend server
const serveFrontend = spawn(npm, ['run', 'serve:frontend']);

const log = console.log
const logAndExit = e => {
  console.log(e);
  process.exit(1);
}

serveBackend.on('data', log);
serveBackend.on('error', logAndExit);
serveBackend.on('close', log);

serveFrontend.on('data', log);
serveFrontend.on('error', logAndExit);
serveFrontend.on('close', log);