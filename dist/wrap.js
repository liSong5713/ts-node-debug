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
Object.defineProperty(exports, "__esModule", { value: true });
const childProcess = require('child_process');
const child_process_1 = require("child_process");
const resolve = require('resolve').sync;
const hook_1 = require("./hook");
const ipc = __importStar(require("./ipc"));
const resolveMain_1 = require("./resolveMain");
const cfg_1 = require("./cfg");
process.argv.splice(1, 1);
const main = resolveMain_1.resolveMain(process.argv[1]);
const cfg = cfg_1.makeCfg(main, {});
if (process.env.TS_NODE_DEV === undefined) {
    process.env.TS_NODE_DEV = 'true';
}
if (process.env.NODE_DEV_PRELOAD) {
    require(process.env.NODE_DEV_PRELOAD);
}
process.on('SIGTERM', function () {
    if (process.listeners('SIGTERM').length === 1)
        process.exit(0);
});
if (cfg.fork) {
    const oldFork = child_process_1.fork;
    const newFork = function (modulePath, args, options) {
        const child = oldFork(__filename, [modulePath].concat(args), options);
        ipc.relay(child);
        return child;
    };
    childProcess.fork = newFork;
}
let caught = false;
process.on('uncaughtException', function (err) {
    if (caught)
        return;
    caught = true;
    const hasCustomHandler = process.listeners('uncaughtException').length > 1;
    const isTsError = err && err.message && /TypeScript/.test(err.message);
    if (!hasCustomHandler && !isTsError) {
        console.error((err && err.stack) || err);
    }
    ipc.send({
        error: isTsError ? '' : (err && err.name) || 'Error',
        message: err ? err.message : '',
        code: err && err.code,
        willTerminate: hasCustomHandler,
    });
});
hook_1.makeHook(cfg, module, function (file) {
    ipc.send({ required: file });
});
require(main);
