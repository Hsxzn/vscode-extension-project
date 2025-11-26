export interface Logger {
    info(message: string): void;
    warn(message: string): void;
    error(message: string, err?: Error): void;
}

export function getLogger(): Logger {
    return {
        info(message: string) {
            console.log(`[INFO] ${new Date().toISOString()}: ${message}`);
        },
        warn(message: string) {
            console.warn(`[WARNING] ${new Date().toISOString()}: ${message}`);
        },
        error(message: string, err?: Error) {
            if (err) {
                console.error(`[ERROR] ${new Date().toISOString()}: ${message}`, err);
            } else {
                console.error(`[ERROR] ${new Date().toISOString()}: ${message}`);
            }
        },
    };
}
