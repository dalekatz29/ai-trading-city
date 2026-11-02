import {runResearch} from './manager-research.mjs';
import {readResearch, writeResearch} from './eth-store.mjs';

const defaults = Object.freeze({budget:1000, maxPosition:25, dailyLoss:10});
const usage = 'אפשר לכתוב ״התחל מסחר בדמו של Bybit״, ״בדוק אסטרטגיות״, ״הצג תוצאות״ או ״עצור״.';
const startVerb = /^(?:התחל|תתחיל|הפעל|תפעיל|תריץ|הרץ|סחור|תסחור|תתחילו|התחילו|תן לסוכנים|start)(?: |$)/u;
// A mutation must be a single instruction with recognized arguments. Conditions,
// amounts, other assets and negated instructions must never turn into an order.
const demoTerms = new Set(('את לי בבקשה להתחיל לסחור מסחר במסחר בדסק דסק הסוכנים סוכנים אתכם לעבוד על של עם ב בחשבון בחשבון-הדמו החשבון דמו בדמו הדמו בדמוי דמוי bybit בbybit בייביט בבייביט בייביטס eth בeth eth/usdt ethusdt אתריום באת׳ריום את׳ריום איתריום אוטומטי אוטונומי אוטומטית אוטונומית עכשיו trading trade in on the bybit demo account agents spot ספוט בספוט').split(' '));
export function managerIntent(input) {
  if (typeof input !== 'string' || !input.trim() || input.length>450) return 'help';
  const text=input.normalize('NFKC').toLowerCase().replace(/[\u0591-\u05c7]/gu,'').replace(/[־–—]/gu,'-')
    .replace(/ב-(?=bybit|eth)/gu,'ב').replace(/\s+/gu,' ').trim().replace(/[!.]+$/u,'').trim()
    .replace(/^(?:(?:היי|מנהל העיר|מנהל|בבקשה|אנא)[ ,]+)+/u,'').replace(/^אני (?:רוצה|מבקש) ש/u,'');
  if (['עצירת חירום','אל תסחור','אל תסחור בדמו'].includes(text) || /^(?:עצור|תעצור|הפסק|תפסיק|stop)(?: (?:את |את כל )?(?:המסחר|הסוכנים|מסחר|לסחור|הדסק|trading))?(?: (?:בדמו|בדמו של bybit|עכשיו|בבקשה))?$/u.test(text)) return 'stop';
  if (/^(?:(?:הצג|תציג|תראה|הראה|תן)(?: לי)?(?: את)? )?(?:(?:ה)?תוצאות|סטטוס|מצב|דוח|דו״ח|סיכום|ביצועים|status|results)(?: (?:של |ה)?(?:הדמו|הסוכנים|המסחר|הדסק|הבדיקה|עד עכשיו))?[?]?$/u.test(text) ||
    /^(?:מה (?:המצב|התוצאות|עשו הסוכנים|הרווח)|כמה (?:הרווחנו|הפסדנו))[?]?$/u.test(text)) return 'status';
  if (/^(?:בדוק|תבדוק|בחן|תבחן|השווה|תשווה|הרץ בדיקת|תריץ בדיקת|הרץ בק.?טסט|תריץ בק.?טסט|בקטסט|backtest)(?: (?:לי|את|בין|של|הסוכנים|האסטרטגיות|אסטרטגיות|סקאלפינג|אסטרטגיות הסקאלפינג|מול|על|eth|bybit|שלוש|שלושת|אסטרטגיה|בדמו|בבקשה|אחורה|ביצועים|עבר|לסוכנים|אסטרטגיות למסחר))*$/u.test(text)) return 'research';
  if (/(?:אמיתי|אמיתית|כסף חי|חשבון חי|מסחר חי|live|mainnet)/u.test(text)) return 'live';
  if (startVerb.test(text)) {
    const terms=text.replace(startVerb,'').trim().split(' ');
    if(terms.every(word=>demoTerms.has(word)) && terms.some(word=>['דמו','בדמו','הדמו','בדמוי','דמוי','demo','בחשבון-הדמו'].includes(word))) return 'start';
  }
  return 'help';
}

const fmt = n => Number.isFinite(n) ? n.toFixed(2) : 'לא זמין';
function researchSummary(result) {
  if(!result?.strategies?.length) return '';
  return ' בתחקיר ההיסטורי האחרון, אחרי עלויות משוערות: '+result.strategies.map(s=>
    s.name+' — '+s.trades+' עסקאות, '+fmt(s.net)+' USDT נטו').join(' · ')+'.';
}
function summary(state) {
  const account = state.running ? 'הדסק פועל' : state.connected ? 'חשבון הדמו מחובר והדסק עצור' : state.configured ? 'הוגדר מפתח דמו והדסק אינו מחובר' : 'טרם חובר מפתח Bybit Demo';
  const pnl=state.position;
  return account+'. '+(state.error ? state.error+' ' : '')+'ביומן הדסק '+state.totals.orders+' הוראות ו־'+state.totals.fills+
    ' ביצועים מאומתים. רווח ממומש אחרי עמלות: '+fmt(pnl.realized)+' USDT. רווח/הפסד פתוח: '+fmt(pnl.unrealized)+' USDT.';
}

export async function createManager({desk,research=runResearch,load=readResearch,save=writeResearch}) {
  let latest=null,activeResearch=null,restorationError='';
  try {latest=await load();if(latest && (!Array.isArray(latest.strategies) || !Number.isFinite(latest.to))) throw Error();}
  catch {latest=null;restorationError='לא ניתן לקרוא את דוח הבדיקה השמור. ניתן לבקש בדיקה חדשה.';}
  function report(message='') {
    return {message:message||restorationError,state:desk.view(),research:latest,defaults};
  }
  async function testStrategies() {
    if (!activeResearch) {
      activeResearch=(async()=>{
        const result=await research();
        await save(result);
        latest=result;restorationError='';
      })().finally(()=>{activeResearch=null;});
    }
    return activeResearch;
  }
  async function command(input) {
    const intent=managerIntent(input);
    if (intent==='stop') {
      try {await desk.act({action:'stop'});}
      catch {return report('הוראות חדשות נחסמו. טרם אומת מצב ההוראות הפתוחות מול Bybit.');}
      return report('הוראות חדשות נחסמו. עבור הוראות פתוחות נרשמה בקשת ביטול. '+summary(desk.view()));
    }
    if (intent==='status') return report(summary(desk.view())+researchSummary(latest));
    if (intent==='live') return report('המנהל מפעיל רק דמו ב־ETH/USDT. '+usage);
    if (intent==='help') return report('לא זיהיתי פקודה נתמכת. '+usage);
    const before=desk.view();
    if(intent==='start' && before.running) return report('הדסק כבר פועל במצב '+(before.config.mode==='auto'?'אוטונומי':'אישור ידני')+'. '+summary(before));
    if (intent==='research' || !before.configured) {
      const missing=intent==='start'?'מסחר הדמו לא הופעל. ב־Bybit יש לחשבון הדמו מפתח נפרד. חבר אותו פעם אחת במחשב. ':'';
      try {await testStrategies();}
      catch(e) {return report(missing+'בדיקת האסטרטגיות לא הושלמה. '+e.message);}
      return report(missing+'הושלמה בדיקת שלוש האסטרטגיות על נרות ETH/USDT מ־Bybit.'+researchSummary(latest));
    }
    const {budget,maxPosition,dailyLoss}=before.config || defaults;
    try {
      const state=await desk.act({action:'manager-start',budget,maxPosition,dailyLoss});
      if (!state.running) return report('הדסק לא הופעל. '+summary(state));
      return report('מסחר הדמו פועל. שלושת סוכני הסקאלפינג בודקים נרות דקה. ניהול הסיכון והביצוע אוטומטיים. תקציב '+budget+' USDT, פוזיציה עד '+maxPosition+' USDT והפסד יומי עד '+dailyLoss+' USDT. '+summary(state));
    } catch(e) {return report('מצב הדסק לאחר ניסיון ההפעלה: '+summary(desk.view())+' '+e.message);}
  }
  return {report,command};
}

