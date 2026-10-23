const QUESTION_SCHEMA={type:'object',additionalProperties:false,required:['done','question','optionA','optionB'],properties:{done:{type:'boolean'},question:{type:'string'},optionA:{type:'string'},optionB:{type:'string'}}};
const MOVIES_SCHEMA={type:'object',additionalProperties:false,required:['movies'],properties:{movies:{type:'array',items:{type:'object',additionalProperties:false,required:['title','year','reason','palette'],properties:{title:{type:'string'},year:{type:'integer'},reason:{type:'string'},palette:{type:'string',enum:['warm','noir','forest','ocean','violet','sunset','neutral']}}}}}};
const headers={'Content-Type':'application/json','Cache-Control':'no-store'};
const respond=(res,status,obj)=>{res.writeHead(status,headers);res.end(JSON.stringify(obj))};
async function completion(messages,temperature,schema,name){
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),25000);
 try{
  const r=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-4o-mini',temperature,store:false,messages,response_format:{type:'json_schema',json_schema:{name,strict:true,schema}}}),signal:controller.signal});
  const data=await r.json();if(!r.ok)throw new Error(data.error?.message||'OpenAI request failed');if(!data.choices?.[0]?.message?.content)throw new Error('AI returned no content');return JSON.parse(data.choices[0].message.content);
 }finally{clearTimeout(timeout)}
}
function trimHistory(v){if(!Array.isArray(v))return [];return v.slice(0,8).map(x=>({question:String(x?.question||'').slice(0,180),answer:String(x?.answer||'').slice(0,350)})).filter(x=>x.question)}
const questionSystem=`You are movie buddy, an expert cinematic conversational movie recommender. Respond with concise, natural English. Generate one genuinely adaptive either/or question based on entire conversation. Two short distinct mutually exclusive answers, no spoilers and no repeating an already asked theme. Ask for useful preference information (mood, tone, pacing, style, genre, time commitment, willingness to be challenged); prioritize what helps find films tonight. Consider all free-text exactly as expressed, including hard constraints. The temperature setting changes output sampling, not the goal. After 3-7 answered questions, set done=true ONLY if preferences are specific enough for 3 meaningful recommendations. Never stop before 3 answers. Always stop at 8 questions. If done=true put empty strings for question and options. Return only structured response.`;
const recommendSystem=`You are a film curator recommending REAL EXISTING FEATURE FILMS, no invented titles. Recommend exactly 3 DISTINCT plausible film candidates matching this person's stated preferences, ranked strongest first. Consider specific free-form restrictions carefully. Include accurate original or standard English movie title and release year; concise personalised reason <=100 characters with no spoilers. Vary genres, countries and eras when appropriate, but prioritize match. Temperature controls sampling creativity, NOT obscure-film popularity. Avoid duplicating any excluded films supplied. Use only real existing films, with their correct release years. Select a palette for each film representing its cinematic mood and tone: warm, noir, forest, ocean, violet, sunset, or neutral. The colors are illustrative, not official artwork. Never invent titles or claim to have verified them. Return structured response.`;

module.exports=async (req,res)=>{
 if(req.method!=='POST')return respond(res,405,{error:'Method not allowed'});
 if(!process.env.OPENAI_API_KEY)return respond(res,503,{error:'OPENAI_API_KEY is missing in Vercel settings.'});
 const {action,temperature:raw,history:rawHistory,exclude}=req.body||{};
 const temperature=Number(raw);if(!Number.isFinite(temperature)||temperature<0||temperature>2)return respond(res,400,{error:'Invalid temperature'});
 const history=trimHistory(rawHistory);
 try{
  if(action==='question'){
   if(history.length>=8)return respond(res,400,{error:'Maximum of eight questions reached'});
   const value=await completion([{role:'system',content:questionSystem},{role:'user',content:JSON.stringify({history,number:history.length+1})}],temperature,QUESTION_SCHEMA,'next_question');
   if(history.length<3)value.done=false;
   if(value.done)return respond(res,200,{done:true});
   if(!value.question?.trim()||!value.optionA?.trim()||!value.optionB?.trim())throw new Error('Incomplete question');
   return respond(res,200,{done:false,question:value.question,options:[value.optionA,value.optionB]});
  }
  if(action==='recommend'){
   const excluded=Array.isArray(exclude)?exclude.slice(0,30).map(x=>String(x).slice(0,150)):[];
   for(let attempt=0;attempt<2;attempt++){
    const result=await completion([
      {role:'system',content:recommendSystem},
      {role:'user',content:JSON.stringify({history,exclude:excluded,task:'Recommend three different existing films that respect the answers. Avoid all excluded titles.'})}
    ],temperature,MOVIES_SCHEMA,'movie_recommendations');
    const unique=new Map();
    for(const film of (result.movies||[])){
      if(typeof film.title!=='string'||!film.title.trim()||!Number.isInteger(film.year)||film.year<1888||film.year>new Date().getFullYear()+1)continue;
      const key=film.title.trim().toLocaleLowerCase('en');
      if(excluded.some(e=>e.trim().toLocaleLowerCase('en')===key)||unique.has(key))continue;
      unique.set(key,{title:film.title.trim(),year:film.year,reason:String(film.reason||'').slice(0,240),palette:film.palette||'neutral'});
    }
    if(unique.size===3){
      const movies=[...unique.values()];
      return respond(res,200,{movies});
    }
   }
   return respond(res,502,{error:'Could not generate three distinct films. Please try again.'});
  }
  return respond(res,400,{error:'Unknown action'});
 }catch(e){console.error('movie buddy request error',e.message);return respond(res,502,{error:e.name==='AbortError'?'The request timed out. Please retry.': 'The recommendation service is temporarily unavailable. Please try again.'})}
};
