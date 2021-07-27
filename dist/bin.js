#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const _1 = require(".");
const minimist_1 = __importDefault(require("minimist"));
const nodeArgs = [];
const unknown = [];
const devArgs = process.argv.slice(2, 100);
const tsNodeFlags = {
    boolean: [
        'scope',
        'emit',
        'files',
        'pretty',
        'transpile-only',
        'prefer-ts-exts',
        'prefer-ts',
        'log-error',
        'skip-project',
        'skip-ignore',
        'compiler-host',
        'script-mode',
    ],
    string: [
        'compiler',
        'project',
        'ignore',
        'ignore-diagnostics',
        'compiler-options',
    ],
};
const tsNodeAlias = {
    'transpile-only': 'T',
    'compiler-host': 'H',
    ignore: 'I',
    'ignore-diagnostics': 'D',
    'compiler-options': 'O',
    compiler: 'C',
    project: 'P',
    'script-mode': 's',
};
const devFlags = {
    boolean: [
        'deps',
        'all-deps',
        'dedupe',
        'fork',
        'exec-check',
        'debug',
        'poll',
        'respawn',
        'notify',
        'tree-kill',
        'clear',
        'cls',
        'exit-child',
        'error-recompile',
        'quiet',
        'rs',
    ],
    string: [
        'dir',
        'deps-level',
        'compile-timeout',
        'ignore-watch',
        'interval',
        'debounce',
        'watch',
        'cache-directory',
    ],
};
const opts = minimist_1.default(devArgs, {
    stopEarly: true,
    boolean: [...devFlags.boolean, ...tsNodeFlags.boolean],
    string: [...devFlags.string, ...tsNodeFlags.string],
    alias: {
        ...tsNodeAlias,
        'prefer-ts-exts': 'prefer-ts',
    },
    default: {
        fork: true,
    },
    unknown: function (arg) {
        unknown.push(arg);
        return true;
    },
});
const script = opts._[0];
const scriptArgs = opts._.slice(1);
opts.priorNodeArgs = [];
unknown.forEach(function (arg) {
    if (arg === script || nodeArgs.indexOf(arg) >= 0)
        return;
    const argName = arg.replace(/^-+/, '');
    const argOpts = opts[argName];
    const argValues = Array.isArray(argOpts) ? argOpts : [argOpts];
    argValues.forEach(function (argValue) {
        if ((arg === '-r' || arg === '--require') && argValue === 'esm') {
            opts.priorNodeArgs.push(arg, argValue);
            return false;
        }
        nodeArgs.push(arg);
        if (typeof argValue === 'string') {
            nodeArgs.push(argValue);
        }
    });
});
if (!script) {
    console.log('ts-node-dev: no script to run provided');
    console.log('Usage: ts-node-dev [options] script [arguments]\n');
    process.exit(1);
}
_1.runDev(script, scriptArgs, nodeArgs, opts);
