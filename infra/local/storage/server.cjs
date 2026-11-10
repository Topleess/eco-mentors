const S3rver = require('s3rver')
const server = new S3rver({
  address: '0.0.0.0',
  port: 9000,
  serviceEndpoint: 'storage',
  vhostBuckets: false,
  directory: '/data',
  silent: true,
  configureBuckets: [{ name: 'research-media' }],
})
server.run().then(() => console.log('Development object storage listening on internal port 9000')).catch(() => { console.error('Development object storage startup failed'); process.exit(1) })
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close().finally(() => process.exit(0)))
