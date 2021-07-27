"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveMain = void 0;
const resolve = require('resolve');
function resolveRequest(req) {
    if (process.versions.pnp) {
        const { resolveRequest } = require(`pnpapi`);
        return resolveRequest(req, process.cwd() + '/');
    }
    else {
        const opts = {
            basedir: process.cwd(),
            paths: [process.cwd()],
        };
        return resolve.sync(req, opts);
    }
}
exports.resolveMain = function (main) {
    try {
        return resolveRequest(main + '.ts');
    }
    catch (e) {
        try {
            return resolveRequest(main + '/index.ts');
        }
        catch (e) {
            return resolveRequest(main);
        }
    }
};
