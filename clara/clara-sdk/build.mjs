import esbuild from 'esbuild';

esbuild
    .build({
        entryPoints: ['src/index.mjs'],
        bundle: true,
        outfile: 'dist/index.mjs',
        format: 'esm',
        platform: 'node',
        target: 'node20', // Ensures compatibility with Node.js 20
        sourcemap: true,
    })
    .then(() => console.log('Build successful!'))
    .catch((error) => {
        console.error('Build failed:', error);
        process.exit(1);
    });
