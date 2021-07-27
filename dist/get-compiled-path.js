"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCompiledPath = void 0;
const crypto_1 = __importDefault(require("crypto"));
const path_1 = __importDefault(require("path"));
const cwd = process.cwd();
exports.getCompiledPath = (code, fileName, compiledDir) => {
    const hash = crypto_1.default
        .createHash('sha256')
        .update(fileName + code, 'utf8')
        .digest('hex');
    fileName = path_1.default.relative(cwd, fileName);
    const hashed = fileName.replace(/[^\w]/g, '_') + '_' + hash + '.js';
    return path_1.default.join(compiledDir, hashed);
};
