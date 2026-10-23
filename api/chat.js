const QUESTION_SCHEMA={type:'object',additionalProperties:false,required:['done','question','optionA','optionB'],properties:{done:{type:'boolean'},question:{type:'string'},optionA:{type:'string'},optionB:{type:'string'}}};
const MOVIES_SCHEMA={type:'object',additionalProperties:false,required:['movies'],properties:{movies:{type:'array',items:{type:'object',additionalProperties:false,required:['title','year','reason'],properties:{title:{type:'string'},year:{type:'integer'},reason:{type:'string'}}}}}};
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
const recommendSystem=`You are a film curator recommending REAL EXISTING FEATURE FILMS, no invented titles. Recommend exactly 9 DISTINCT plausible film candidates matching this person's stated preferences, ranked strongest first. Consider specific free-form restrictions carefully. Include accurate original or standard English movie title and release year; concise personalised reason <=100 characters with no spoilers. Vary genres, countries and eras when appropriate, but prioritize match. Temperature controls sampling creativity, NOT obscure-film popularity. Avoid duplicating any excluded films supplied. Movies must exist in TMDB. Return structured response.`;
async function tmdb(path,params={}){
 const url=new URL('https://api.themoviedb.org/3'+path);for(const [k,v] of Object.entries(params))url.searchParams.set(k,String(v));
 const r=await fetch(url,{headers:{Authorization:`Bearer ${process.env.TMDB_API_READ_ACCESS_TOKEN}`,'accept':'application/json'}});if(!r.ok)throw new Error(`TMDB returned ${r.status}`);return r.json();
}
async function verifiedMovie(candidate){
 const results=await tmdb('/search/movie',{query:candidate.title,year:candidate.year,include_adult:false});let match=results.results?.find(m=>m.release_date?.startsWith(String(candidate.year)) && (m.title.toLowerCase()===candidate.title.toLowerCase()||m.original_title.toLowerCase()===candidate.title.toLowerCase()));
 if(!match)match=results.results?.find(m=>m.release_date?.startsWith(String(candidate.year)));
 if(!match)return null;
 const detail=await tmdb(`/movie/${match.id}`,{language:'en-US'});
 return {id:detail.id,title:detail.title,year:(detail.release_date||'').slice(0,4),poster:detail.poster_path?`https://image.tmdb.org/t/p/w500${detail.poster_path}`:null,overview:detail.overview,runtime:detail.runtime,genres:(detail.genres||[]).map(g=>g.name).slice(0,2),reason:candidate.reason,tmdb:`https://www.themoviedb.org/movie/${detail.id}`};
}
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
   if(!process.env.TMDB_API_READ_ACCESS_TOKEN)return respond(res,503,{error:'TMDB_API_READ_ACCESS_TOKEN is missing in Vercel settings.'});
   const excluded=Array.isArray(exclude)?exclude.slice(0,30).map(x=>String(x).slice(0,150)):[];
   const result=await completion([{role:'system',content:recommendSystem},{role:'user',content:JSON.stringify({history,exclude:excluded})}],temperature,MOVIES_SCHEMA,'movie_recommendations');
   const candidates=(result.movies||[]).slice(0,12).filter(x=>!excluded.some(e=>e.toLowerCase()===x.title.toLowerCase()));
   const verified=await Promise.allSettled(candidates.map(verifiedMovie));let movies=verified.filter(x=>x.status==='fulfilled'&&x.value).map(x=>x.value);
   movies=[...new Map(movies.map(x=>[x.id,x])).values()].slice(0,3);
   if(movies.length<3)return respond(res,502,{error:'Could not verify three matching films. Please try again.'});
   return respond(res,200,{movies});
  }
  return respond(res,400,{error:'Unknown action'});
 }catch(e){console.error('movie buddy request error',e.message);return respond(res,502,{error:e.name==='AbortError'?'The request timed out. Please retry.': 'The recommendation service is temporarily unavailable. Please try again.'})}
};
