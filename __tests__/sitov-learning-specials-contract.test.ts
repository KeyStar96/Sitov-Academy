import { sitovSpecialInputSchema,sitovSpecialRunSchema } from '@/lib/learning/sitov-learning-specials-contract'
const uid='00000000-0000-4000-8000-000000000001'
it('requires deliberate revision/request transitions and rejects caller score/account',()=>{
 expect(sitovSpecialInputSchema.safeParse({operation:'start',nodeId:uid,mode:'learning',requestId:uid}).success).toBe(true)
 for(const extra of [{score:10},{studentId:uid},{published:true}])expect(sitovSpecialInputSchema.safeParse({operation:'start',nodeId:uid,mode:'test',requestId:uid,...extra}).success).toBe(false)
 expect(sitovSpecialInputSchema.safeParse({operation:'right',runId:uid,requestId:uid}).success).toBe(false)
 expect(sitovSpecialInputSchema.safeParse({operation:'submit',runId:uid,revision:0,requestId:uid,answers:{[uid]:{index:1,correct:true}}}).success).toBe(false)
})
it('rejects a learner completion represented as test passage and unrevealed solution',()=>{
 const base={runId:uid,nodeId:uid,definitionVersion:'a'.repeat(64),mode:'learning',status:'completed',revision:1,selected:[uid],queue:[],revealed:false,answers:{},tasks:[{id:uid,type:'multiple_choice',content:{question:'Artikel?',options:['den','die']}}],learningSolution:null,result:null}
 expect(sitovSpecialRunSchema.safeParse(base).success).toBe(true)
 expect(sitovSpecialRunSchema.safeParse({...base,learningSolution:{content:{correct_answer:'den'},explanation:null}}).success).toBe(false)
 expect(sitovSpecialRunSchema.safeParse({...base,mode:'test'}).success).toBe(false)
})
