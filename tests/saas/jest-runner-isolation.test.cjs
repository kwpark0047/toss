const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
test('release gates cannot hide resource leaks with forceExit',()=>{
 assert.equal(fs.readFileSync('.github/workflows/ci.yml','utf8').includes('--forceExit'),false);
 const scripts=JSON.parse(fs.readFileSync('package.json','utf8')).scripts;
 for(const name of ['test','test:unit','test:regression','test:coverage'])assert.equal(scripts[name].includes('--forceExit'),false,name);
});
test('Jest owns all test transforms without a native tsx preload bypassing mocks',()=>{
 let invocation,exitCode;
 const sandbox={__dirname:path.resolve('scripts'),console,process:{env:{},execPath:'node',argv:['node','runner','tests/unit'],exit:code=>{exitCode=code;}},
 require:name=>name==='node:path'?path:{spawnSync:(exe,args,options)=>{invocation={exe,args,options};return {status:0};}}};
 vm.runInNewContext(fs.readFileSync('scripts/run-jest.cjs','utf8'),sandbox);
 assert.equal(invocation.args.includes('--import'),false);
 assert.equal(invocation.args.includes('tsx'),false);
 assert.ok(invocation.options.env.NODE_OPTIONS.includes('--experimental-vm-modules'));
 assert.equal(invocation.options.env.NODE_ENV,'test');assert.equal(exitCode,0);
});
