"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.relay = exports.on = exports.send = void 0;
function isNodeDevMessage(m) {
    return m.cmd === 'NODE_DEV';
}
exports.send = function (m, dest = process) {
    m.cmd = 'NODE_DEV';
    if (dest.send)
        dest.send(m);
};
exports.on = function (proc, type, cb) {
    function handleMessage(m) {
        if (isNodeDevMessage(m) && type in m)
            cb(m);
    }
    proc.on('internalMessage', handleMessage);
    proc.on('message', handleMessage);
};
exports.relay = function (src, dest = process) {
    function relayMessage(m) {
        if (isNodeDevMessage(m))
            dest.send(m);
    }
    src.on('internalMessage', relayMessage);
    src.on('message', relayMessage);
};
