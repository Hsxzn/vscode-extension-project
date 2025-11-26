"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLogger = void 0;
function getLogger() {
    return {
        info(message) {
            console.log(`[INFO] ${new Date().toISOString()}: ${message}`);
        },
        warn(message) {
            console.warn(`[WARNING] ${new Date().toISOString()}: ${message}`);
        },
        error(message, err) {
            if (err) {
                console.error(`[ERROR] ${new Date().toISOString()}: ${message}`, err);
            }
            else {
                console.error(`[ERROR] ${new Date().toISOString()}: ${message}`);
            }
        },
    };
}
exports.getLogger = getLogger;
//# sourceMappingURL=logger.js.map