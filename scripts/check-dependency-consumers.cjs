const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { once } = require('node:events');
const req = createRequire(path.resolve(process.argv[2] || path.join(__dirname, '../package.json')));
const root = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'wemarket-dependency-consumer-'));
async function main() {
  fs.mkdirSync(path.join(root, 'nested'), { recursive: true });
  fs.writeFileSync(path.join(root, 'a.txt'), 'alpha');
  fs.writeFileSync(path.join(root, 'nested/b.txt'), 'beta');
  fs.writeFileSync(path.join(root, 'nested/skip.log'), 'skip');
  const swagger = req('swagger-jsdoc')({
    definition: { openapi: '3.0.3', info: { title: 'Compatibility', version: '1' } },
    apis: [path.resolve(__dirname, '../routes/*.js').replaceAll('\\', '/'), path.resolve(__dirname, '../controllers/*.js').replaceAll('\\', '/')],
    failOnErrors: true,
  });
  assert(Object.keys(swagger.paths).length > 20);
  console.log('PASS actual route Swagger generation: ' + Object.keys(swagger.paths).length + ' paths');
  const utils = req('archiver-utils');
  assert.deepEqual(utils.file.expand({cwd:root}, ['**/*.txt', '!nested/*']).sort(), ['a.txt']);
  console.log('PASS archiver-utils glob.sync include/exclude');
  const matches = [];
  const reader = req('readdir-glob')(root, { pattern: '**/*.txt', nodir: true });
  reader.on('match', x => matches.push(x.relative.replaceAll('\\', '/')));
  await once(reader, 'end');
  assert.deepEqual(matches.sort(), ['a.txt', 'nested/b.txt']);
  console.log('PASS readdir-glob recursive minimatch filtering');
  const archive = req('archiver')('zip');
  const output = fs.createWriteStream(path.join(root, 'result.zip'));
  archive.on('warning', e => { throw e; });
  archive.on('error', e => output.destroy(e));
  archive.pipe(output);
  archive.glob('**/*.txt', {cwd:root});
  const closed = once(output, 'close');
  await archive.finalize();
  await closed;
  // Parse ZIP central directory names independently of the archive producer.
  const zip = fs.readFileSync(path.join(root, 'result.zip'));
  const names = [];
  for (let i=0;i<zip.length-46;i++) {
    if(zip.readUInt32LE(i) !== 0x02014b50) continue;
    const len=zip.readUInt16LE(i+28);
    names.push(zip.subarray(i+46,i+46+len).toString());
  }
  assert.deepEqual(names.sort(), ['a.txt','nested/b.txt']);
  console.log('PASS archiver ZIP glob output central directory');
  const rimraf = req('rimraf');
  const scratch = path.join(root, 'delete-fixture');
  fs.mkdirSync(scratch, {recursive:true});
  fs.writeFileSync(path.join(scratch,'delete.tmp'),'delete');
  fs.writeFileSync(path.join(scratch,'keep.txt'),'keep');
  const pattern = scratch.replaceAll('\\','/')+'/*.tmp';
  await rimraf.rimraf(pattern, { glob: true });
  assert(!fs.existsSync(path.join(scratch,'delete.tmp')));
  assert(fs.existsSync(path.join(scratch,'keep.txt')));
  console.log('PASS rimraf wildcard deletes only matches');
  const legacyRimraf = req('fstream/node_modules/rimraf');
  fs.writeFileSync(path.join(scratch,'legacy.tmp'),'legacy');
  await new Promise((resolve,reject)=>legacyRimraf(pattern,e=>e?reject(e):resolve()));
  assert(!fs.existsSync(path.join(scratch,'legacy.tmp')));
  console.log('PASS fstream legacy rimraf callback/glob API');
  const xml = new (req('fast-xml-parser').XMLParser)();
  assert.deepEqual(xml.parse('<root><value>42</value></root>'), {root:{value:42}});
  console.log('PASS fast-xml-parser parse');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
