import * as archiver from 'archiver';

export const archiveDirectory = (sourceDir: string): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        const archive = archiver('zip', { zlib: { level: 9 } });
        const buffers: Buffer[] = [];

        archive.on('warning', (err) => {
            if (err.code === 'ENOENT') {
                console.warn(err);
            } else {
                reject(err);
            }
        });

        archive.on('error', (err) => {
            reject(err);
        });

        archive.on('data', (buf) => {
            buffers.push(buf);
        });

        archive.on('end', () => {
            const outputBuffer = Buffer.concat(buffers);
            resolve(outputBuffer);
        });

        // Add the entire source directory to the root of the archive
        archive.directory(sourceDir, false);

        archive.finalize();
    });
};
