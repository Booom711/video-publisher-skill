import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PLATFORM_DIR = path.join(DIR, "..", "platforms");

test("Xiaohongshu topics start through the native editor command", () => {
  const source = fs.readFileSync(path.join(PLATFORM_DIR, "xiaohongshu.mjs"), "utf8");
  const start = source.indexOf("async function rebuildXhsTopics");
  const end = source.indexOf("async function ensureXhsOriginal", start);
  assert.ok(start >= 0 && end > start, "topic rebuild function must remain discoverable");
  const topicFlow = source.slice(start, end);
  const lifecycle = topicFlow.indexOf("activateXhsTopicLifecycle()");
  const nativeStart = topicFlow.indexOf("topicButton.click()");
  const startedFlow = topicFlow.slice(topicFlow.lastIndexOf("const started", nativeStart), topicFlow.indexOf("if (!started.ok)", nativeStart));
  const caretAtEnd = startedFlow.indexOf("range.collapse(false)");
  const nativeStartInProbe = startedFlow.indexOf("topicButton.click()");
  const explicitRefocus = startedFlow.indexOf("editor.focus()", nativeStartInProbe);
  const bareQuery = topicFlow.indexOf("await cdp('Input.insertText', { text: queryTag })", nativeStart);
  assert.ok(lifecycle >= 0 && lifecycle < nativeStart, "the hidden post-crash page must be activated before topic input");
  assert.match(source, /Page\.setWebLifecycleState', \{ state: 'active' \}/);
  assert.ok(nativeStart >= 0, "the platform topic command must insert the leading hash");
  assert.ok(caretAtEnd >= 0 && caretAtEnd < nativeStartInProbe, "the real caret must be fixed at the editor end before the native topic command");
  assert.ok(explicitRefocus > nativeStartInProbe, "the editor must be refocused after the native command");
  assert.ok(bareQuery > nativeStart, "only the bare topic query may be inserted after the native command");
  assert.match(startedFlow, /description changed before topic entry/, "the exact description must remain intact before every topic");
  assert.match(startedFlow, /actualTail===expectedTail/, "a hash inserted inside the description must fail closed");
  assert.doesNotMatch(topicFlow, /Input\.insertText', \{ text: `#\$\{queryTag\}` \}/);
  assert.match(topicFlow, /rebuildAttempt<=3/, "candidate failures must retry the whole exact topic set with a finite bound");
  assert.match(topicFlow, /attempt < 12/, "each native suggestion request must get a bounded high-load wait window");
});

test("Douyin preserves committed topic entities while retrying a failed tail query", () => {
  const source = fs.readFileSync(path.join(PLATFORM_DIR, "douyin.mjs"), "utf8");
  const cleanupStart = source.indexOf("async function removeDouyinTrailingTopicQuery");
  const cleanupEnd = source.indexOf("async function addDouyinTopic", cleanupStart);
  const addEnd = source.indexOf("async function recoverDouyinTopicPrefix", cleanupEnd);
  assert.ok(cleanupStart >= 0 && cleanupEnd > cleanupStart && addEnd > cleanupEnd);
  const cleanup = source.slice(cleanupStart, cleanupEnd);
  const add = source.slice(cleanupEnd, addEnd);
  assert.match(cleanup, /expected\.startsWith\(initial\)/, "cleanup must prove the visible tail belongs to the missing topic");
  assert.match(cleanup, /entitiesUnchanged/, "cleanup must verify existing topic entities were preserved");
  assert.match(source, /stripProvenDouyinDescriptionSuffix/, "the first topic query must be isolated from a shared description text node");
  assert.match(add, /attempt<=3/, "suggestion lookup must use a finite retry bound");
  assert.match(add, /removeDouyinTrailingTopicQuery\(queryTag,committedBefore\)/, "a failed lookup must remove only its own plain query");
  assert.match(add, /querySelectorAll\('\[class\*=\"mention-suggest-item-container\"\]'\)/, "current Douyin must click the real suggestion row before falling back to descendants");
  assert.match(add, /direct\.length\?direct:legacy/, "legacy suggestion descendants remain a bounded fallback");
});

test("Douyin mutation prepares covers before metadata", () => {
  const source = fs.readFileSync(path.join(PLATFORM_DIR, "douyin.mjs"), "utf8");
  const start = source.indexOf("async function mutateDouyin");
  const end = source.indexOf("async function runPlatformPhase", start);
  assert.ok(start >= 0 && end > start, "Douyin mutation function must remain discoverable");
  const mutation = source.slice(start, end);
  const cover = mutation.indexOf("repairDelayedDouyinCoverReceipt()");
  const metadata = mutation.indexOf("ensureDouyinMetadata(await inspectDouyin())");
  assert.match(mutation, /if \(!before\.gates\.video\.ok\)/, "metadata and covers require a completed video");
  assert.ok(cover >= 0 && metadata > cover, "both cover slots must finish before title, description, topics, and settings");
});

test("Xiaohongshu mutation prepares the cover before title, description, topics, and rights", () => {
  const source = fs.readFileSync(path.join(PLATFORM_DIR, "xiaohongshu.mjs"), "utf8");
  const start = source.indexOf("async function mutateXiaohongshu");
  const end = source.indexOf("async function runPlatformPhase", start);
  assert.ok(start >= 0 && end > start);
  const mutation = source.slice(start, end);
  const cover = mutation.indexOf("await uploadXhsCover()");
  const metadata = mutation.indexOf("ensureXiaohongshuEarlyMetadata(await inspectXiaohongshu())");
  const rights = mutation.indexOf("ensureXhsOriginal()");
  assert.match(mutation, /if \(!before\.gates\.video\.ok\)/);
  assert.ok(cover >= 0 && metadata > cover && rights > metadata, "cover must precede all text fields and the original declaration");
  assert.match(source, /const xhsDescription = pkg\.description/);
  assert.match(source, /description: state\.descriptionMatches/);
  assert.match(source, /Input\.insertText', \{ text: xhsDescription \}/);
  assert.match(source, /!current\.gates\.description\.ok \|\| !current\.gates\.tags\.ok/);
});

test("Xiaohongshu cover repair resumes by reselecting the requested source asset", () => {
  const source = fs.readFileSync(path.join(PLATFORM_DIR, "xiaohongshu.mjs"), "utf8");
  const start = source.indexOf("async function uploadXhsCover");
  const end = source.indexOf("async function ensureXiaohongshuEarlyMetadata", start);
  assert.ok(start >= 0 && end > start, "cover upload function must remain discoverable");
  const coverFlow = source.slice(start, end);
  assert.match(coverFlow, /\.main-cover-editor-modal/, "the current cover-editor root must be recognized");
  assert.match(coverFlow, /\^\(上传封面\|上传\)\$/, "both old and current upload labels must remain supported");
  assert.match(coverFlow, /\^\(确定\|完成\)\$/, "both old and current confirmation labels must remain supported");
  assert.match(coverFlow, /input\[type=file\]/, "a direct image input must take precedence over tab text");
  assert.match(coverFlow, /openedAfterRealClick/, "the cover opener must verify that the asynchronous editor materialized");
  assert.match(coverFlow, /native fallback/, "a missing asynchronous editor must retry through the page's native click handler");
  assert.match(coverFlow, /resume-uploaded-thumbnail/, "a retry must resume a cover that already reached the editor");
  assert.match(coverFlow, /uploaded-thumbnail-clear/, "a resumed thumbnail must be cleared before selecting the requested source");
  assert.doesNotMatch(coverFlow, /if \(!tab\.alreadyUploaded\)/, "the requested source file must be proven on every repair");
  assert.match(coverFlow, /selectedFile\?\.name!==path\.basename\(xhsCoverPath\)/);
  assert.match(coverFlow, /const cropProof=await js/, "the crop ratio must be re-read from the live editor before confirmation");
  assert.match(coverFlow, /xhsCoverCropMatches\(cropProof\)/, "the selected ratio control must prove the requested 3:4 crop");
  assert.match(coverFlow, /controlVisible/);
  assert.doesNotMatch(coverFlow, /inferredFromUploadedThumbnail|uploadedThumbnail/, "source-image dimensions cannot substitute for crop-control evidence");
});

test("Xiaohongshu original declaration never treats unchecked as checked", () => {
  const source = fs.readFileSync(path.join(PLATFORM_DIR, "xiaohongshu.mjs"), "utf8");
  const inspectStart = source.indexOf("async function inspectXiaohongshu");
  const inspectEnd = source.indexOf("async function waitXiaohongshuUploadCompletion", inspectStart);
  const ensureStart = source.indexOf("async function ensureXhsOriginal");
  const ensureEnd = source.indexOf("async function uploadXhsCover", ensureStart);
  const inspectFlow = source.slice(inspectStart, inspectEnd);
  const ensureFlow = source.slice(ensureStart, ensureEnd);
  assert.match(inspectFlow, /originalInput\?\.checked === true/, "the real checkbox must be authoritative when present");
  assert.match(inspectFlow, /simulatorTokens\.some\(token => \['checked', 'active', 'open', 'enabled'\]\.includes\(token\)\)/, "state classes must be matched as exact tokens");
  assert.doesNotMatch(inspectFlow, /\/checked\|active\|open\|enabled\//, "substring matching would make unchecked a false positive");
  assert.match(ensureFlow, /querySelector\?\.\('\.d-switch-simulator'\)/, "the proven interactive simulator is the preferred click target");
  assert.match(ensureFlow, /accept xhs original declaration agreement/, "the agreement must be a separate real interaction");
  assert.match(ensureFlow, /attempt < 12/, "the Vue confirmation state needs a bounded readiness wait");
  assert.match(ensureFlow, /if \(!confirm\.ok\) return/, "a disabled confirmation must stop mutation instead of being ignored");
  assert.match(ensureFlow, /original declaration dialog did not close/, "success requires an independently closed dialog");
});

test("Xiaohongshu opens the hover-only cover editor through its native handler", () => {
  const source = fs.readFileSync(path.join(PLATFORM_DIR, "xiaohongshu.mjs"), "utf8");
  const start = source.indexOf("async function uploadXhsCover");
  const end = source.indexOf("async function ensureXiaohongshuEarlyMetadata", start);
  const coverFlow = source.slice(start, end);
  assert.match(coverFlow, /target\.matches\('\.cover-edit-entry'\)\)\{target\.click\(\);return \{ok:true,nativeHoverEntry:true/, "the hover entry must fire before pointer movement can remove it");
  assert.match(coverFlow, /if \(!opener\.nativeHoverEntry\)/, "ordinary stable controls should still use the real click path");
  assert.match(coverFlow, /document\.querySelector\('\.cover-plugin-preview \.cover-edit-entry'\)\|\|document\.querySelector\('#vp2-xhs-cover-opener'\)/, "the native fallback must prefer a fresh hover entry over a stale id");
});

test("Bilibili mutation prepares both cover slots before metadata", () => {
  const source = fs.readFileSync(path.join(PLATFORM_DIR, "bilibili.mjs"), "utf8");
  const start = source.indexOf("async function mutateBilibili");
  const end = source.indexOf("async function quarantineBilibili", start);
  assert.ok(start >= 0 && end > start);
  const mutation = source.slice(start, end);
  const cover = mutation.indexOf("uploadBilibiliCoverV2()");
  const title = mutation.indexOf("setNativeInputValue", cover);
  const description = mutation.indexOf("setBilibiliDescriptionV2()", cover);
  assert.match(mutation, /if\(!before\.gates\.video\.ok\)/);
  assert.ok(cover >= 0 && title > cover && description > cover, "both cover slots must precede title and description repair");
});

test("WeChat Channels prefill uses a task-space-bound upload receipt and defers original and covers", () => {
  const source = fs.readFileSync(path.join(PLATFORM_DIR, "wechat-channels.mjs"), "utf8");
  const start = source.indexOf("async function prefillWechatChannels");
  const end = source.indexOf("async function mutateWechatChannels", start);
  assert.ok(start >= 0 && end > start);
  const prefill = source.slice(start, end);
  assert.match(source, /正在处理文件\|处理中\|生成中/, "processing and generated-cover text must keep the upload incomplete");
  assert.match(source, /uploadStartReceipt\?\.fingerprint===jobFingerprint/);
  assert.match(source, /completeWechatUploadStartObservation\(current,mode,'editable_uploading'/);
  assert.match(prefill, /ensureWechatEarlyMetadata\(before\)/);
  assert.doesNotMatch(prefill, /ensureWechatOriginal|uploadWechatCover/);
});

test("WeChat Channels cover flow supports both slot-specific and generic editors", () => {
  const source = fs.readFileSync(path.join(PLATFORM_DIR, "wechat-channels.mjs"), "utf8");
  const start = source.indexOf("async function dismissWechatCoverEditor");
  const end = source.indexOf("async function ensureWechatEarlyMetadata", start);
  const coverFlow = source.slice(start, end);
  const helperStart = source.indexOf("function wechatCoverEditorExpression");
  const helperEnd = source.indexOf("async function probeWechatCoverEditor", helperStart);
  assert.ok(helperStart >= 0 && helperEnd > helperStart, "the shared editor probe must remain discoverable");
  const editorProbe = source.slice(helperStart, helperEnd);
  assert.match(coverFlow, /编辑个人主页卡片\|编辑分享卡片\|编辑封面\|裁剪封面图/, "recovery must recognize every live cover-dialog title");
  assert.match(coverFlow, /querySelectorAll\('\.weui-desktop-dialog__wrp'\)/, "cover lookup must not depend on the removed edit-cover-dialog ancestor");
  assert.match(editorProbe, /heading\(d\)===title/, "the exact slot title remains preferred");
  assert.match(editorProbe, /heading\(d\)==='编辑封面'/, "the current generic editor title remains a fallback");
  assert.match(editorProbe, /candidates=exact\.length\?exact:dialogs\.filter/);
  assert.match(editorProbe, /owned=\(dialog,selector\)=>/, "child controls must be scoped to the matched editor");
  assert.match(coverFlow, /owned\(editor,'input\[type=file\]'\)/, "file injection requires an input owned by the matched editor");
});

test("Ego task-space selection rejects a recycled id with another name", () => {
  const source = fs.readFileSync(path.join(DIR, "..", "ego", "core.mjs"), "utf8");
  const start = source.indexOf("async function selectTaskSpace");
  const end = source.indexOf("async function selectPlatformTab", start);
  assert.ok(start >= 0 && end > start, "task-space selector must remain discoverable");
  const selection = source.slice(start, end);
  assert.match(selection, /activeTaskSpace\.name !== taskName/);
  assert.match(selection, /reason: 'task_space_identity_mismatch'/);
  assert.match(selection, /activeTaskSpace = await useOrCreateTaskSpace\(taskName\)/);
});

test("Bilibili upload waits for a real input and performs one bounded route recovery", () => {
  const source = fs.readFileSync(path.join(PLATFORM_DIR, "bilibili.mjs"), "utf8");
  const start = source.indexOf("async function waitForBilibiliUploadEntry");
  const end = source.indexOf("async function waitBilibiliUploadCompletion", start);
  assert.ok(start >= 0 && end > start, "upload-entry recovery must remain discoverable");
  const recovery = source.slice(start, end);
  assert.match(recovery, /attempt<=24/, "entry discovery needs a finite wait bound");
  assert.match(recovery, /attempt===6&&navigationAttempts===0/, "only one delayed route recovery may be attempted");
  assert.match(recovery, /videoEvidence\.anyUploaded!==true/, "route recovery must not navigate away from an uploaded draft");
  assert.match(recovery, /gotoAndWait\(PLATFORM_URLS\.bilibili/, "the recovery must use the exact maintained upload URL");
  assert.match(recovery, /const guard=await armFinalPublishGuard\(\)/, "route recovery must re-arm the final-publish guard after navigation");
  assert.match(recovery, /B站定向恢复后无法重新挂载最终发布保护/, "a missing post-navigation guard must fail closed");
  assert.match(recovery, /await activateBilibiliUploadLifecycle\(\);\s*await wait\(2\)/, "the newly navigated upload page must be activated before its input is accepted");
  assert.match(recovery, /resumeBilibiliLocalDraftIfPresent/, "a restore banner must be resolved inside the same readiness loop");
  assert.match(recovery, /exposeBilibiliVideoInput/, "success still requires the platform's real file input");
  assert.doesNotMatch(recovery, /createElement\(['"]input['"]\)/, "the adapter must never create a fake upload input");
  assert.match(source, /\.bcc-upload-wrapper input\[type=file\]/, "the active uploader input must be scoped away from Bilibili's detached file inputs");
  assert.match(source, /async function waitForBilibiliUploadStart/, "file injection must have a bounded upload-start verifier");
  assert.match(source, /attempt<=20/, "a silent injection failure must stop quickly instead of consuming the full upload window");
});

test("Bilibili cover repair completes before a rejected tag and preserves the blocker", () => {
  const source = fs.readFileSync(path.join(PLATFORM_DIR, "bilibili.mjs"), "utf8");
  const start = source.indexOf("async function mutateBilibili");
  const end = source.indexOf("async function quarantineBilibili", start);
  assert.ok(start >= 0 && end > start, "Bilibili mutation function must remain discoverable");
  const mutation = source.slice(start, end);
  const coverRepair = mutation.indexOf("actions.cover=await uploadBilibiliCoverV2()");
  const tagFailure = mutation.indexOf("mutationBlockers.push(typedBlocker('PLATFORM_REJECTED_METADATA'");
  const finalReturn = mutation.indexOf("blocker:mutationBlockers[0]||null");
  assert.ok(coverRepair >= 0 && tagFailure > coverRepair, "cover repair must finish before tag mutation starts");
  assert.ok(finalReturn > tagFailure, "the typed tag blocker must survive after cover completion");
});

test("Bilibili keeps homepage and personal-space cover verification independent", () => {
  const source = fs.readFileSync(path.join(PLATFORM_DIR, "bilibili.mjs"), "utf8");
  assert.match(source, /const bilibiliCoverAssets = \[/);
  assert.match(source, /slot:'homepage-master',ratio:'4:3'/);
  assert.match(source, /slot:'personal-space',ratio:'16:9'/);
  assert.match(source, /editor:'#editor_4_3',key:'extra'/);
  assert.match(source, /editor:'#editor_16_9',key:'main'/);
  assert.match(source, /bilibiliCoverReceiptMatches\(asset,receipt\?\.slots\?\.\[asset\.slot\]/);
  assert.match(source, /bilibiliCoverAssets\.every\(asset=>bilibiliCoverReceiptMatches\(asset,receipt\?\.slots\?\.\[asset\.slot\],imagesBySlot\[asset\.slot\]\)\)/, "READY requires current live proof for both slots");
  assert.doesNotMatch(source, /slots:\['homepage-4:3','space-16:9'\]/, "one 4:3 upload cannot claim both slots");

  assert.match(source, /sync-checkbox input\[type=checkbox\]/);
  assert.match(source, /inputs\.every\(i=>!i\.checked\)/, "both sync controls must stay unchecked");
  assert.match(source, /previewProof\?\.changed&&previewProof\.active&&previewProof\.loaded/, "upload completion requires a new loaded preview in the active slot");
  assert.match(source, /image\.source==='upload'/, "accepted images must come from the upload flow");
  assert.match(source, /image\.origin===receipt\.previewProof\.url/, "the accepted image must originate from the selected preview");
  assert.match(source, /receipt\.slots\[asset\.slot\]=result\.receipt/);
  assert.match(source, /checkpointReceipts\(\{\.\.\.expectedReceipts,cover:receipt\}\)/, "each successful slot must be checkpointed for recovery");
  assert.match(source, /if\(bilibiliCoverReceiptMatches\(asset,receipt\.slots\[asset\.slot\],images\[asset\.slot\]\)\)continue/, "a verified earlier slot must survive a retry without another upload");
  assert.match(source, /const accepted=bilibiliCoverAssets\.every\(asset=>bilibiliCoverReceiptMatches/);
  assert.match(source, /if\(closed&&accepted\)/, "final confirmation requires both live slot proofs and a closed editor");
  assert.match(source, /不同步，手动编辑/, "the sync warning must be recovered through the manual-edit path");
  assert.doesNotMatch(source, /确认同步/, "the adapter must never merge the two cover slots");
  assert.match(source, /label:'首页推荐封面'/, "the 4:3 slot must have a semantic fallback when Bilibili replaces its generated id");
  assert.match(source, /label:'个人空间封面'/, "the 16:9 slot must have a semantic fallback when Bilibili replaces its generated id");
  assert.match(source, /resolvedBy:target===direct\?'selector':target===idFallback\?'ratio-id':'label'/, "slot selection must resolve the live control immediately before clicking");
  assert.match(source, /bilibili cover slot click failed/, "a disappearing slot must become a structured repair failure instead of crashing the job");

  assert.match(source, /item\.extra\?\.edited===cardUrl/, "the visible primary card URL must bind to one cover-list item");
  assert.match(source, /matches\.length===1\?matches\[0\]:null/, "ambiguous ownership must fail closed");
  assert.match(source, /personal-space':image\(item\?\.main\)/, "the 16:9 slot is checked against the main URL, not a PK cover");
});

test("Bilibili inserts the full multi-paragraph description through the active editor", () => {
  const source = fs.readFileSync(path.join(PLATFORM_DIR, "bilibili.mjs"), "utf8");
  const start = source.indexOf("async function setBilibiliDescriptionV2");
  const end = source.indexOf("async function ensureBilibiliDeclarationV2", start);
  assert.ok(start >= 0 && end > start, "Bilibili description repair must remain discoverable");
  const repair = source.slice(start, end);
  assert.match(repair, /cdp\('Input\.insertText',\{text:bilibiliDescription\}\)/, "newlines must be inserted as real text into Quill");
  assert.doesNotMatch(repair, /execCommand\('insertText'/, "execCommand must not truncate a multi-paragraph description at its first line");
  assert.match(repair, /replace\(\/\\s\+\/g,' '\)\.trim\(\)===String\(value\)\.replace/, "the persisted editor value must be verified after insertion");
});

test("Bilibili runtime cover-slot probe is valid JavaScript", () => {
  const source = fs.readFileSync(path.join(PLATFORM_DIR, "bilibili.mjs"), "utf8");
  const marker = "for(let i=0;i<12;i+=1){active=await js(String.raw`";
  const start = source.indexOf(marker);
  const end = source.indexOf("`);if(active)", start + marker.length);
  assert.ok(start >= 0 && end > start, "the live cover-slot probe must remain discoverable");
  const template = source.slice(start + marker.length, end);
  const expression = Function("asset", `return String.raw\`${template}\`;`)({editor:"#editor_4_3",label:"首页推荐封面"});
  assert.doesNotThrow(() => new vm.Script(expression), "the expression sent to Ego must compile before any real page work");
});

test("WeChat Channels refuses an unproven uploaded draft with an empty description", () => {
  const source = fs.readFileSync(path.join(PLATFORM_DIR, "wechat-channels.mjs"), "utf8");
  assert.match(source, /identityAmbiguous=uploaded&&!description&&!trustedVideoReceipt/);
  assert.match(source, /expectedVideoReceipt\?\.fingerprint===jobFingerprint/);
  assert.match(source, /current\.gates\.draftIdentity=okGate\(\{trustedUploadAction:true,mode,uploadStartReceipt:/);
  assert.match(source, /if\(!before\.gates\.draftIdentity\.ok\)return/);
});

test("YouTube prefill repairs full details but defers thumbnail, visibility, and final save", () => {
  const source = fs.readFileSync(path.join(PLATFORM_DIR, "youtube.mjs"), "utf8");
  const start = source.indexOf("async function prefillYoutube");
  const end = source.indexOf("async function mutateYoutube", start);
  assert.ok(start >= 0 && end > start, "YouTube prefill function must remain discoverable");
  const prefill = source.slice(start, end);
  assert.match(source, /stage: 'editable_uploading'/);
  assert.match(source, /controls: \{ title: visible\(titleEditor\), description: visible\(descriptionEditor\) \}/);
  assert.match(prefill, /ensureYoutubeMetadata\(before\)/);
  assert.doesNotMatch(prefill, /uploadYoutubeThumbnail|advanceYoutubeToVisibility|ensureYoutubeVisibility/);
  assert.doesNotMatch(source, /click\([^)]*done-button|click\([^)]*final/i, "the adapter must never click YouTube's final action");
});

test("YouTube final guard covers localized Save, Publish, and Schedule labels only on YouTube", () => {
  const source = fs.readFileSync(path.join(DIR, "..", "ego", "core.mjs"), "utf8");
  assert.match(source, /YOUTUBE_FINAL_TEXT = \/\^\(保存\|发布\|安排时间\|Save\|Publish\|Schedule\)\$\//);
  assert.match(source, /platform === 'youtube' \? YOUTUBE_FINAL_TEXT : FINAL_TEXT/);
});

test("YouTube corrections can clear all tags and replace a stale details receipt", () => {
  const source = fs.readFileSync(path.join(PLATFORM_DIR, "youtube.mjs"), "utf8");
  assert.match(source, /for \(const tag of youtubeTags\)/, "an empty requested list must skip additions after removing old chips");
  assert.match(source, /const detailsGatesReady = \['title', 'description', 'tags', 'audience', 'settings'\]/);
  assert.match(source, /currentDetailsComparable/);
  assert.match(source, /expectedReceipts\.details = receipts\.details/);
});
