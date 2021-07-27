"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeHook = void 0;
const vm_1 = __importDefault(require("vm"));
exports.makeHook = function (cfg, wrapper, callback) {
    updateHooks();
    if (cfg.vm) {
        patch(vm_1.default, 'createScript', 1);
        patch(vm_1.default, 'runInThisContext', 1);
        patch(vm_1.default, 'runInNewContext', 2);
        patch(vm_1.default, 'runInContext', 2);
    }
    function patch(obj, method, optionsArgIndex) {
        const orig = obj[method];
        if (!orig)
            return;
        obj[method] = function () {
            const opts = arguments[optionsArgIndex];
            let file = null;
            if (opts) {
                file = typeof opts == 'string' ? opts : opts.filename;
            }
            if (file)
                callback(file);
            return orig.apply(this, arguments);
        };
    }
    function updateHooks() {
        Object.keys(require.extensions).forEach(function (ext) {
            const fn = require.extensions[ext];
            if (typeof fn === 'function' && fn.name !== 'nodeDevHook') {
                require.extensions[ext] = createHook(fn);
            }
        });
    }
    function createHook(handler) {
        return function nodeDevHook(module, filename) {
            if (module.parent === wrapper) {
                module.id = '.';
                module.parent = null;
                process.mainModule = module;
            }
            if (!module.loaded)
                callback(module.filename);
            handler(module, filename);
            updateHooks();
        };
    }
};
