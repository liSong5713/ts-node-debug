# ts-node-debug

> Base on [ts-node-dev](https://github.com/wclr/ts-node-dev) and optimize child-process without extra file such as ts-node-hook-**.js ***.req

It restarts target node process when any of required files changes (as standard `node-dev`) but shares [Typescript](https://github.com/Microsoft/TypeScript/) compilation process between restarts. This significantly increases speed of restarting comparing to `node-dev -r ts-node/register ...`, `nodemon -x ts-node ...` variations because there is no need to instantiate `ts-node` compilation each time.

## Install

```
yarn add ts-node-debug --dev
```

```
npm i ts-node-debug --save-dev
```

## Usage

```
ts-node-debug [node-dev|ts-node flags] [ts-node-debug flags] [node cli flags] [--] [script] [script arguments]
```

So you just combine [node-dev](https://github.com/fgnass/node-dev) and [ts-node](https://github.com/TypeStrong/ts-node) options (see docs of those packages):

```
ts-node-debug --respawn server.ts
```

There is also short alias `tsd` for running `ts-node-debug`:

```
tsd --respawn server.ts
```

Look up flags and options can be used [in ts-node's docs](https://github.com/TypeStrong/ts-node#cli-and-programmatic-options).

**Also there are additional options specific to `ts-node-debug`:**

* `--deps` - Also watch `node_modules`; by default watching is turned off

* `--debug` - Some additional [DEBUG] output
* `--quiet` - Silent [INFO] messages
* `--debounce` - Debounce file change events (ms, non-polling mode)
* `--clear` (`--cls`) - Will clear screen on restart
* `--watch` - Explicitly add arbitrary files or folders to watch and restart on change (list separated by commas, [chokidar](https://github.com/paulmillr/chokidar) patterns)
* `--watched` -  Enable file changes and restarts
* `--notify` - to display desktop-notifications (Notifications are only displayed if `node-notifier` is installed).
* `--cache-directory` - tmp dir which is used to keep the compiled sources (by default os tmp directory is used)

If you need to detect that you are running with `ts-node-debug`, check if `process.env.TS_NODE_DEV` is set.


**Points of notice:**

- If you want desktop-notifications you should install `node-notifier` package and use `--notify` flag.

- Especially for large code bases always consider running with config `transpileOnly:true` in `tsconfig.json`  which is normal for dev workflow and will speed up things greatly. Note, that `ts-node-debug` will not put watch handlers on TS files that contain only types/interfaces (used only for type checking) - this is current limitation by design [check it]('https://github.com/TypeStrong/ts-node#options').

- Unknown flags (`node` cli flags are considered to be so) are treated like string value flags by default. The right solution to avoid ambiguity is to separate script name from option flags with `--`, for example:

  ```
  ts-node-debug --inspect -- my-script.ts
  ```

- The good thing is that `ts-node-debug` watches used `tsconfig.json` file, and will reinitialize compilation on its change, but you have to restart the process manually when you update used version of `typescript` or make any other changes that may effect compilation results.

## Issues

If you have an issue, please create one. But, before:
- try to check if there exits alike issues.
- try to run your code with just [ts-node](https://github.com/TypeStrong/ts-node)
- try to run your code with `--files` option enabled ([see ts-node docs](https://github.com/TypeStrong/ts-node#help-my-types-are-missing))
- try to run it with `--debug` flag and see the output
- try to make create repro example

## Versioning

Currently versioning is not stable and it is still treated as pre-release. You might expect some options API changes. If you want to avoid unexpected problems it is recommended to fixate the installed version and update only in case of issues, you may consult [CHANGELOG](CHANGELOG.md) for updates.

## License

MIT.
