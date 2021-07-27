"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCwd = void 0;
const path_1 = __importDefault(require("path"));
const hasOwnProperty = (object, property) => {
    return Object.prototype.hasOwnProperty.call(object, property);
};
exports.getCwd = (dir, scriptMode, scriptPath) => {
    if (scriptMode) {
        if (!scriptPath) {
            console.error('Script mode must be used with a script name, e.g. `ts-node-dev -s <script.ts>`');
            process.exit();
        }
        if (dir) {
            console.error('Script mode cannot be combined with `--dir`');
            process.exit();
        }
        const exts = ['.js', '.jsx', '.ts', '.tsx'];
        const extsTemporarilyInstalled = [];
        for (const ext of exts) {
            if (!hasOwnProperty(require.extensions, ext)) {
                extsTemporarilyInstalled.push(ext);
                require.extensions[ext] = function () { };
            }
        }
        try {
            return path_1.default.dirname(require.resolve(scriptPath));
        }
        finally {
            for (const ext of extsTemporarilyInstalled) {
                delete require.extensions[ext];
            }
        }
    }
    return dir;
};
