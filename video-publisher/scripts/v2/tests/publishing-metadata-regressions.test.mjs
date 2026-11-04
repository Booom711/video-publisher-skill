import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {requiredGates} from '../lib/model.mjs';

const DIR=path.dirname(fileURLToPath(import.meta.url));
const douyinSource=readFileSync(path.join(DIR,'..','platforms','douyin.mjs'),'utf8');

function extractedDouyinTailStripper(){
  const start=douyinSource.indexOf('function stripProvenDouyinDescriptionSuffix');
  const end=douyinSource.indexOf('async function inspectDouyin()',start);
  assert.ok(start>=0&&end>start,'Douyin tail-strip helper must remain discoverable');
  return vm.runInNewContext(`(${douyinSource.slice(start,end).trim()})`);
}

function extractedDouyinSyncHandler(context){
  const start=douyinSource.indexOf('async function turnOffDouyinSync');
  const end=douyinSource.indexOf('async function uploadDouyinCoverSlot',start);
  assert.ok(start>=0&&end>start,'Douyin sync handler must remain discoverable');
  const sandbox=vm.createContext(context);
  vm.runInContext(douyinSource.slice(start,end),sandbox);
  return ()=>vm.runInContext('turnOffDouyinSync()',sandbox);
}

test('Douyin isolates a failed topic query when it shares the last description text node',()=>{
  const strip=extractedDouyinTailStripper();
  const description='如何更有野心的使用AI\n1.速度：让AI做执行\n4.广度：帮你搭建专家团';
  const editorText='如何更有野心的使用AI\u200b\n1.速度：让AI做执行\u200b\n4.广度：帮你搭建专家团 #AI\u200b';
  const result=strip('4.广度：帮你搭建专家团 #AI\u200b',description,editorText);
  assert.equal(result.value.trim(),'#AI');
  assert.equal(result.descriptionPrefixProven,true);
});

test('Douyin never treats an existing description hashtag as a new failed query',()=>{
  const strip=extractedDouyinTailStripper();
  const description='正文结尾 #AI';
  const result=strip('正文结尾 #AI',description,description);
  assert.equal(result.value.trim(),'');
  assert.equal(result.descriptionPrefixProven,true);
});

test('Douyin fails closed when the editor no longer proves the expected description',()=>{
  const strip=extractedDouyinTailStripper();
  const result=strip('意外正文 #AI','预期正文','意外正文 #AI');
  assert.equal(result.value.trim(),'意外正文 #AI');
  assert.equal(result.descriptionPrefixProven,false);
});

test('Douyin compares multiline prose after the same whitespace normalization used by the page',()=>{
  assert.match(douyinSource,/const expectedProse = compact\(expectedDescription\)/);
  assert.match(douyinSource,/descriptionMatches:prose===expectedProse/);
  assert.match(douyinSource,/description: state\.descriptionMatches/);
});

test('Douyin accepts a freshly proven not-offered sync setting without looking for a removed radio',async()=>{
  let selectorCalls=0;
  const run=extractedDouyinSyncHandler({
    inspectDouyin:async()=>({gates:{settings:{ok:true,evidence:{mode:'not_offered',visibleRadioLabels:['公开','立即发布']}}}}),
    js:async()=>{selectorCalls+=1;return {ok:false,reason:'must not run'}},
    click:async()=>{},
    wait:async()=>{},
  });
  const result=await run();
  assert.equal(result.ok,true);
  assert.equal(result.mode,'not_offered');
  assert.equal(result.already,true);
  assert.equal(selectorCalls,0);
});

test('Xiaohongshu READY requires the exact body description in addition to topics',()=>{
  assert.ok(requiredGates('xiaohongshu').includes('description'));
});
