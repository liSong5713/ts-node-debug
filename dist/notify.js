"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeNotify = void 0;
const path_1 = __importDefault(require("path"));
let notifier = null;
try {
    notifier = require('node-notifier');
}
catch (error) {
    notifier = null;
}
function icon(level) {
    return path_1.default.resolve(__dirname, '../icons/node_' + level + '.png');
}
exports.makeNotify = function (cfg, log) {
    return function (title, msg, level) {
        level = level || 'info';
        log([title, msg].filter((_) => _).join(': '), level);
        if (notifier !== null && cfg.notify) {
            notifier.notify({
                title: title || 'node.js',
                icon: icon(level),
                message: msg,
            });
        }
    };
};
