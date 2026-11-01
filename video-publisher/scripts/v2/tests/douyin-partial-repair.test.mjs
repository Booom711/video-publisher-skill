import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const candidate=new URL('./douyin.patched.mjs',import.meta.url);
const installed=new URL('../platforms/douyin.mjs',import.meta.url);
let source;try{source=readFileSync(candidate,'utf8')}catch{source=readFileSync(installed,'utf8')}
const mutation=source.slice(source.indexOf('async function mutateDouyin()'),source.indexOf('async function runPlatformPhase()',source.indexOf('async function mutateDouyin()')));

function fixture(metadata){
 const uploads=[],checkpoints=[];let inspections=0;
 const before={gates:{video:{ok:true},settings:{ok:false},cover:{ok:false,evidence:{urls:{portrait:['default'],landscape:['default']}}}}};
 const after={gates:{video:{ok:true},settings:{ok:false},cover:{ok:true,evidence:{urls:{portrait:['portrait-uploaded'],landscape:['landscape-uploaded']}}}}};
 const context=vm.createContext({
  inspectDouyin:async()=>++inspections===1?before:after,
  ensureDouyinMetadata:async()=>metadata,
  douyinCustomCover:true,
  expectedReceipts:{},
  douyinCoverAssets:[{slot:'portrait',ratio:'3:4',path:'D:/confirmed/portrait.png'},{slot:'landscape',ratio:'4:3',path:'D:/confirmed/landscape.png'}],
  repairDelayedDouyinCoverReceipt:async()=>({ok:false}),
  uploadDouyinCoverSlot:async asset=>{uploads.push(asset.path);return {ok:true}},
  checkpointReceipts:receipts=>{checkpoints.push(receipts);return {ok:true}},
  typedBlocker:(code,message)=>({code,message}),wait:async()=>{}
 });
 vm.runInContext(mutation,context);
 return {run:()=>vm.runInContext('mutateDouyin()',context),uploads,checkpoints};
}

test('missing sync selector preserves its blocker while both exact cover assets are prepared',async()=>{
 const blocker={code:'SELECTOR_DRIFT',message:'douyin no-sync radio missing'};
 const item=fixture({ok:false,actions:{settings:{ok:false}},blocker});
 const result=await item.run();
 assert.deepEqual(item.uploads,['D:/confirmed/portrait.png','D:/confirmed/landscape.png']);
 assert.equal(result.blocker,blocker);assert.equal(result.gates.settings.ok,false);
 assert.equal(result.receipts.cover.slots.portrait.assetPath,item.uploads[0]);
 assert.equal(result.receipts.cover.slots.landscape.assetPath,item.uploads[1]);
 assert.notEqual(result.receipts.cover.slots.portrait.afterUrl,result.receipts.cover.slots.landscape.afterUrl);
 assert.equal(item.checkpoints.length,1);
});

test('unrelated metadata and ownership blockers still prevent cover mutation',async()=>{
 for(const code of ['FOREIGN_DRAFT','USER_CONTROL','INPUT_CHANNEL_BROKEN','ACTION_FAILED']){
  const blocker={code,message:'stop'};const item=fixture({ok:false,actions:{},blocker});
  assert.equal((await item.run()).blocker,blocker);assert.equal(item.uploads.length,0);assert.equal(item.checkpoints.length,0);
 }
});
