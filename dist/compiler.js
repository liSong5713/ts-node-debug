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
exports.makeCompiler = void 0;
const tsNode = __importStar(require("ts-node"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const mkdirp_1 = __importDefault(require("mkdirp"));
const glob_1 = __importDefault(require("glob"));
const tsconfig_1 = require("tsconfig");
const get_compiled_path_1 = require("./get-compiled-path");
const get_cwd_1 = require("./get-cwd");
const fixPath = (p) => p.replace(/\\/g, '/').replace(/\$/g, '$$$$');
const sourceMapSupportPath = require.resolve('source-map-support');
const compileExtensions = ['.ts', '.tsx'];
const cwd = process.cwd();
const compilationInstanceStamp = Math.random().toString().slice(2);
const originalJsHandler = require.extensions['.js'];
exports.makeCompiler = (options, { log, restart, }) => {
    let _errorCompileTimeout;
    let allowJs = false;
    const project = options['project'];
    const tsConfigPath = tsconfig_1.resolveSync(cwd, typeof project === 'string' ? project : undefined) || '';
    const compiledPathsHash = {};
    const tmpDir = options['cache-directory']
        ? path_1.default.resolve(options['cache-directory'])
        : fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), '.ts-node'));
    const writeChildHookFile = (options) => {
        const compileTimeout = parseInt(options['compile-timeout']);
        const getIgnoreVal = (ignore) => {
            const ignoreVal = !ignore || ignore === 'false'
                ? 'false'
                : '[' +
                    ignore
                        .split(/,/)
                        .map((i) => i.trim())
                        .map((ignore) => 'new RegExp("' + ignore + '")')
                        .join(', ') +
                    ']';
            return ignoreVal;
        };
        const varDecl = (name, value) => `const ${name} = '${value}'`;
        const replacements = [
            compileTimeout ? ['10000', compileTimeout.toString()] : null,
            allowJs ? ['allowJs = false', 'allowJs = true'] : null,
            options['prefer-ts-exts']
                ? ['preferTs = false', 'preferTs = true']
                : null,
            options['exec-check'] ? ['execCheck = false', 'execCheck = true'] : null,
            options['exit-child'] ? ['exitChild = false', 'exitChild = true'] : null,
            options['ignore'] !== undefined
                ? [
                    'const ignore = [/node_modules/]',
                    'const ignore = ' + getIgnoreVal(options['ignore']),
                ]
                : null,
            [
                varDecl('compilationId', ''),
                varDecl('compilationId', getCompilationId()),
            ],
            [varDecl('compiledDir', ''), varDecl('compiledDir', getCompiledDir())],
            [
                './get-compiled-path',
                fixPath(path_1.default.join(__dirname, 'get-compiled-path')),
            ],
            [
                varDecl('readyFile', ''),
                varDecl('readyFile', getCompilerReadyFilePath()),
            ],
            [
                varDecl('sourceMapSupportPath', ''),
                varDecl('sourceMapSupportPath', fixPath(sourceMapSupportPath)),
            ],
            [
                varDecl('libPath', ''),
                varDecl('libPath', __dirname.replace(/\\/g, '\\\\')),
            ],
            ['__dirname', '"' + fixPath(__dirname) + '"'],
        ]
            .filter((_) => !!_)
            .map((_) => _);
        const hookPath = glob_1.default.sync(path_1.default.join(__dirname, 'child-require-hook.{js,ts}'))[0];
        const fileText = fs_1.default.readFileSync(hookPath, 'utf-8');
        const fileData = replacements.reduce((text, [what, to]) => {
            return text.replace(what, to);
        }, fileText);
        fs_1.default.writeFileSync(getChildHookPath(), fileData);
    };
    const init = () => {
        registerTsNode();
        createCompiledDir();
        allowJs = require.extensions['.js'] !== originalJsHandler;
        if (allowJs) {
            compileExtensions.push('.js', '.jsx');
        }
        writeChildHookFile(options);
    };
    const getCompilationId = () => {
        return compilationInstanceStamp;
    };
    const createCompiledDir = () => {
        const compiledDir = getCompiledDir();
        if (!fs_1.default.existsSync(compiledDir)) {
            mkdirp_1.default.sync(getCompiledDir());
        }
    };
    const getCompiledDir = () => {
        return path_1.default.join(tmpDir, 'compiled').replace(/\\/g, '/');
    };
    const getCompileReqFilePath = () => {
        return path_1.default.join(getCompiledDir(), getCompilationId() + '.req');
    };
    const getCompilerReadyFilePath = () => {
        return path_1.default
            .join(os_1.default.tmpdir(), 'ts-node-dev-ready-' + compilationInstanceStamp)
            .replace(/\\/g, '/');
    };
    const getChildHookPath = () => {
        return path_1.default
            .join(os_1.default.tmpdir(), 'ts-node-dev-hook-' + compilationInstanceStamp + '.js')
            .replace(/\\/g, '/');
    };
    const writeReadyFile = () => {
        fs_1.default.writeFileSync(getCompilerReadyFilePath(), '');
    };
    const clearErrorCompile = () => {
        clearTimeout(_errorCompileTimeout);
    };
    const registerTsNode = () => {
        Object.keys(compiledPathsHash).forEach((key) => {
            delete compiledPathsHash[key];
        });
        ['.js', '.jsx', '.ts', '.tsx'].forEach(function (ext) {
            require.extensions[ext] = originalJsHandler;
        });
        const scriptPath = options._.length
            ? path_1.default.resolve(cwd, options._[0])
            : undefined;
        const DEFAULTS = tsNode.DEFAULTS;
        tsNode.register({
            dir: get_cwd_1.getCwd(options['dir'], options['script-mode'], scriptPath),
            scope: options['scope'] || DEFAULTS.scope,
            emit: options['emit'] || DEFAULTS.emit,
            files: options['files'] || DEFAULTS.files,
            pretty: options['pretty'] || DEFAULTS.pretty,
            transpileOnly: options['transpile-only'] || DEFAULTS.transpileOnly,
            ignore: options['ignore']
                ? tsNode.split(options['ignore'])
                : DEFAULTS.ignore,
            preferTsExts: options['prefer-ts-exts'] || DEFAULTS.preferTsExts,
            logError: options['log-error'] || DEFAULTS.logError,
            project: options['project'],
            skipProject: options['skip-project'],
            skipIgnore: options['skip-ignore'],
            compiler: options['compiler'] || DEFAULTS.compiler,
            compilerHost: options['compiler-host'] || DEFAULTS.compilerHost,
            ignoreDiagnostics: options['ignore-diagnostics']
                ? tsNode.split(options['ignore-diagnostics'])
                : DEFAULTS.ignoreDiagnostics,
            compilerOptions: tsNode.parse(options['compiler-options']),
        });
    };
    const compiler = {
        tsConfigPath,
        init,
        getCompileReqFilePath,
        getChildHookPath,
        writeReadyFile,
        clearErrorCompile,
        compileChanged: function (fileName) {
            const ext = path_1.default.extname(fileName);
            if (compileExtensions.indexOf(ext) < 0)
                return;
            try {
                const code = fs_1.default.readFileSync(fileName, 'utf-8');
                compiler.compile({
                    code: code,
                    compile: fileName,
                    compiledPath: get_compiled_path_1.getCompiledPath(code, fileName, getCompiledDir()),
                });
            }
            catch (e) {
                console.error(e);
            }
        },
        compile: function (params) {
            const fileName = params.compile;
            const code = fs_1.default.readFileSync(fileName, 'utf-8');
            const compiledPath = params.compiledPath;
            if (compiledPathsHash[compiledPath]) {
                return;
            }
            compiledPathsHash[compiledPath] = true;
            function writeCompiled(code, fileName) {
                fs_1.default.writeFile(compiledPath, code, (err) => {
                    err && log.error(err);
                    fs_1.default.writeFile(compiledPath + '.done', '', (err) => {
                        err && log.error(err);
                    });
                });
            }
            if (fs_1.default.existsSync(compiledPath)) {
                return;
            }
            const starTime = new Date().getTime();
            const m = {
                _compile: writeCompiled,
            };
            const _compile = () => {
                const ext = path_1.default.extname(fileName);
                const extHandler = require.extensions[ext];
                extHandler(m, fileName);
                log.debug(fileName, 'compiled in', new Date().getTime() - starTime, 'ms');
            };
            try {
                _compile();
            }
            catch (e) {
                console.error('Compilation error in', fileName);
                const errorCode = 'throw ' + 'new Error(' + JSON.stringify(e.message) + ')' + ';';
                writeCompiled(errorCode);
                setTimeout(() => {
                    registerTsNode();
                }, 0);
                if (!options['error-recompile']) {
                    return;
                }
                const timeoutMs = parseInt(process.env.TS_NODE_DEV_ERROR_RECOMPILE_TIMEOUT || '0') ||
                    5000;
                const errorHandler = () => {
                    clearTimeout(_errorCompileTimeout);
                    _errorCompileTimeout = setTimeout(() => {
                        try {
                            _compile();
                            restart(fileName);
                        }
                        catch (e) {
                            registerTsNode();
                            errorHandler();
                        }
                    }, timeoutMs);
                };
                errorHandler();
            }
        },
    };
    return compiler;
};
