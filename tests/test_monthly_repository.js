'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const assert=require('assert');

const root=path.resolve(__dirname,'..');
let candidate;
const canonical=file('2026-10.json',JSON.stringify({safe:true}));
const folder={
  createFile(name){candidate=file(name,JSON.stringify({broken:true}));return candidate;},
  getFilesByName(){let available=true;return {hasNext:()=>available,next:()=>{available=false;return canonical;}};},
};
function file(name,content){return {name,content,trashed:false,getName(){return this.name;},setName(value){this.name=value;},getId(){return this.name;},setTrashed(value){this.trashed=value;},getBlob(){return {getDataAsString:()=>this.content};}};}
const context=vm.createContext({
  console,
  Date,
  JSON,
  Object,
  Array,
  MimeType:{PLAIN_TEXT:'text/plain'},
  DriveApp:{getFolderById:()=>folder},
  getMonthlyArchiveFolderId_:()=> 'folder',
  marketReportError_:(code,detail)=>{const error=new Error(code);error.code=code;error.detail=detail;return error;},
  MonthlyArchiveService:{validateArchive:()=>({valid:true})},
});
vm.runInContext(fs.readFileSync(path.join(root,'MonthlyArchiveRepository.gs'),'utf8'),context,{filename:'MonthlyArchiveRepository.gs'});
const repository=vm.runInContext('MonthlyArchiveRepository',context);

assert.throws(()=>repository.saveArchive('2026-10',{safe:true}),/MONTHLY_WRITE_VERIFY_FAILED/);
assert.equal(canonical.getName(),'2026-10.json');
assert.equal(candidate.trashed,true);
console.log('PASS failed persisted verification protects the existing monthly archive\n\n1/1 monthly repository tests passed');
