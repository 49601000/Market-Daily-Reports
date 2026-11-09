'use strict';
const fs=require('fs');const path=require('path');const vm=require('vm');const assert=require('assert');
const root=path.resolve(__dirname,'..');let triggers=[];let next=1;
function trigger(handler){return {handler,id:String(next++),getHandlerFunction(){return this.handler},getUniqueId(){return this.id}};}
const ScriptApp={getProjectTriggers:()=>triggers.slice(),deleteTrigger:t=>{triggers=triggers.filter(x=>x!==t)},newTrigger:handler=>({timeBased(){return this},atHour(){return this},nearMinute(){return this},everyDays(){return this},inTimezone(){return this},create(){const t=trigger(handler);triggers.push(t);return t;}})};
const context=vm.createContext({console,ScriptApp,Object,Array,Date,JSON});
['Config.gs','MonthlySyncTriggers.gs'].forEach(file=>vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file}));
const install=vm.runInContext('installMonthlySyncTriggers',context),remove=vm.runInContext('removeMonthlySyncTriggers',context);
triggers=[trigger('unrelatedHandler')];install();assert.equal(triggers.filter(t=>t.handler==='syncMonthlyReports').length,6);assert.equal(triggers.filter(t=>t.handler==='unrelatedHandler').length,1);install();assert.equal(triggers.filter(t=>t.handler==='syncMonthlyReports').length,6);remove();assert.equal(triggers.length,1);assert.equal(triggers[0].handler,'unrelatedHandler');console.log('PASS trigger install is idempotent and removal is scoped\n1/1 trigger tests passed');
