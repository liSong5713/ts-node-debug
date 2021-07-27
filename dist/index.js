"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDev = void 0;
const child_process_1 = require("child_process");
const chokidar_1 = __importDefault(require("chokidar"));
const fs_1 = __importDefault(require("fs"));
const readline_1 = __importDefault(require("readline"));
const glob_1 = __importDefault(require("glob"));
const path_1 = __importDefault(require("path"));
const kill = require('tree-kill');
const ipc = __importStar(require("./ipc"));
const resolveMain_1 = require("./resolveMain");
const compiler_1 = require("./compiler");
const cfg_1 = require("./cfg");
const notify_1 = require("./notify");
const log_1 = require("./log");
const version = require('../package.json').version;
const tsNodeVersion = require('ts-node').VERSION;
const tsVersion = require('typescript').version;
exports.runDev = (script, scriptArgs, nodeArgs, opts) => {
    if (typeof script !== 'string' || script.length === 0) {
        throw new TypeError('`script` must be a string');
    }
    if (!Array.isArray(scriptArgs)) {
        throw new TypeError('`scriptArgs` must be an array');
    }
    if (!Array.isArray(nodeArgs)) {
        throw new TypeError('`nodeArgs` must be an array');
    }
    let child;
    const wrapper = glob_1.default.sync(path_1.default.join(__dirname, 'wrap.{js,ts}'))[0];
    const main = resolveMain_1.resolveMain(script);
    const cfg = cfg_1.makeCfg(main, opts);
    const log = log_1.makeLog(cfg);
    const notify = notify_1.makeNotify(cfg, log);
    if (cfg.dedupe)
        process.env.NODE_DEV_PRELOAD = __dirname + '/dedupe';
    function initWatcher() {
        const watcher = chokidar_1.default.watch([], {
            usePolling: opts.poll,
            interval: parseInt(opts.interval) || undefined,
        });
        watcher.on('change', restart);
        watcher.on('fallback', function (limit) {
            log.warn('node-dev ran out of file handles after watching %s files.', limit);
            log.warn('Falling back to polling which uses more CPU.');
            log.info('Run ulimit -n 10000 to increase the file descriptor limit.');
            if (cfg.deps)
                log.info('... or add `--no-deps` to use less file handles.');
        });
        return watcher;
    }
    let watcher = initWatcher();
    let starting = false;
    if (opts.rs !== false) {
        const rl = readline_1.default.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: false,
        });
        rl.on('line', (line) => {
            if (line.trim() === 'rs') {
                restart('', true);
            }
        });
    }
    log.info('ts-node-dev ver. ' +
        version +
        ' (using ts-node ver. ' +
        tsNodeVersion +
        ', typescript ver. ' +
        tsVersion +
        ')');
    let compileReqWatcher;
    function start() {
        if (cfg.clear)
            process.stdout.write('\u001bc');
        for (const watched of (opts.watch || '').split(',')) {
            if (watched)
                watcher.add(watched);
        }
        const hookArgs = compiler.getHookChildArgs(opts);
        let cmd = nodeArgs.concat(wrapper, script, scriptArgs, ...hookArgs);
        const childHookPath = glob_1.default.sync(path_1.default.join(__dirname, 'child-require-hook.{js,ts}'))[0];
        cmd = (opts.priorNodeArgs || []).concat(['-r', childHookPath]).concat(cmd);
        log.debug('Starting child process %s', cmd.join(' '));
        child = child_process_1.fork(cmd[0], cmd.slice(1), {
            cwd: process.cwd(),
            env: process.env,
        });
        starting = false;
        if (compileReqWatcher) {
            compileReqWatcher.close();
        }
        compileReqWatcher = chokidar_1.default.watch([], {
            usePolling: opts.poll,
            interval: parseInt(opts.interval) || undefined,
        });
        let currentCompilePath;
        fs_1.default.writeFileSync(compiler.getCompileReqFilePath(), '');
        compileReqWatcher.add(compiler.getCompileReqFilePath());
        compileReqWatcher.on('change', function (file) {
            fs_1.default.readFile(file, 'utf-8', function (err, data) {
                if (err) {
                    log.error('Error reading compile request file', err);
                    return;
                }
                const split = data.split('\n');
                const compile = split[0];
                const compiledPath = split[1];
                if (currentCompilePath == compiledPath)
                    return;
                currentCompilePath = compiledPath;
                if (compiledPath) {
                    compiler.compile({
                        compile: compile,
                        compiledPath: compiledPath,
                    });
                }
            });
        });
        child.on('message', function (message) {
            if (!message.compiledPath ||
                currentCompilePath === message.compiledPath) {
                return;
            }
            currentCompilePath = message.compiledPath;
            compiler.compile(message);
        });
        child.on('exit', function (code) {
            log.debug('Child exited with code %s', code);
            if (!child)
                return;
            if (!child.respawn)
                process.exit(code || 0);
            child = undefined;
        });
        if (cfg.respawn) {
            child.respawn = true;
        }
        if (compiler.tsConfigPath) {
            watcher.add(compiler.tsConfigPath);
        }
        ipc.on(child, 'required', function (m) {
            const required = m.required;
            const isIgnored = cfg.ignore.some(isPrefixOf(required)) ||
                cfg.ignore.some(isRegExpMatch(required));
            if (!isIgnored && (cfg.deps === -1 || getLevel(required) <= cfg.deps)) {
                log.debug(required, 'added to watcher');
                watcher.add(required);
            }
        });
        ipc.on(child, 'error', function (m) {
            log.debug('Child error');
            notify(m.error, m.message, 'error');
            stop(m.willTerminate);
        });
        compiler.writeReadyFile();
    }
    const killChild = () => {
        if (!child)
            return;
        log.debug('Sending SIGTERM kill to child pid', child.pid);
        if (opts['tree-kill']) {
            log.debug('Using tree-kill');
            kill(child.pid);
        }
        else {
            child.kill('SIGTERM');
        }
    };
    function stop(willTerminate) {
        if (!child || child.stopping) {
            return;
        }
        child.stopping = true;
        child.respawn = true;
        if (child.connected === undefined || child.connected === true) {
            log.debug('Disconnecting from child');
            child.disconnect();
            if (!willTerminate) {
                killChild();
            }
        }
    }
    function restart(file, isManualRestart) {
        if (file === compiler.tsConfigPath) {
            notify('Reinitializing TS compilation', '');
            compiler.init();
        }
        compiler.clearErrorCompile();
        if (isManualRestart === true) {
            notify('Restarting', 'manual restart from user');
        }
        else {
            notify('Restarting', file + ' has been modified');
        }
        compiler.compileChanged(file);
        if (starting) {
            log.debug('Already starting');
            return;
        }
        log.debug('Removing all watchers from files');
        watcher.close();
        watcher = initWatcher();
        starting = true;
        if (child) {
            log.debug('Child is still running, restart upon exit');
            child.on('exit', start);
            stop();
        }
        else {
            log.debug('Child is already stopped, probably due to a previous error');
            start();
        }
    }
    process.on('SIGTERM', function () {
        log.debug('Process got SIGTERM');
        killChild();
        process.exit(0);
    });
    process.on('SIGINT', function () {
        log.debug('Process got SIGINT');
        killChild();
        process.exit(0);
    });
    const compiler = compiler_1.makeCompiler(opts, {
        restart,
        log: log,
    });
    compiler.init();
    start();
};
function getLevel(mod) {
    const p = getPrefix(mod);
    return p.split('node_modules').length - 1;
}
function getPrefix(mod) {
    const n = 'node_modules';
    const i = mod.lastIndexOf(n);
    return ~i ? mod.slice(0, i + n.length) : '';
}
function isPrefixOf(value) {
    return function (prefix) {
        return value.indexOf(prefix) === 0;
    };
}
function isRegExpMatch(value) {
    return function (regExp) {
        return new RegExp(regExp).test(value);
    };
}
