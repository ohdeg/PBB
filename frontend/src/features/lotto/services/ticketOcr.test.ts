// @vitest-environment jsdom
import { expect, it, vi, afterEach } from 'vitest'
import { recognizeTicket } from './ticketOcr'
const terminate=vi.fn(), recognize=vi.fn(), createWorker=vi.fn()
vi.mock('./ticketOcrEngine',()=>({loadTicketOcrEngine:async()=>({createWorker:(...args: unknown[])=>createWorker(...args)})}))
afterEach(()=>{vi.useRealTimers();vi.clearAllMocks();vi.restoreAllMocks()})
it('extracts rows and always terminates the worker', async()=>{
 createWorker.mockResolvedValue({recognize,terminate}); recognize.mockResolvedValue({data:{text:'1200회\nA 자동 01 02 03 04 05 06'}})
 const draft=await recognizeTicket({} as HTMLCanvasElement,{signal:new AbortController().signal,onProgress:()=>{}})
 expect(draft.detectedRound).toBe(1200);expect(draft.rows[0].values).toEqual([1,2,3,4,5,6]);expect(terminate).toHaveBeenCalledTimes(1)
})
it('cancels even while worker initialization is pending and terminates late worker', async()=>{
 let resolve!: (v:unknown)=>void;createWorker.mockReturnValue(new Promise(r=>resolve=r))
 const abort=new AbortController();const p=recognizeTicket({} as HTMLCanvasElement,{signal:abort.signal,onProgress:()=>{}})
 await Promise.resolve();abort.abort();await expect(p).rejects.toThrow()
 resolve({recognize,terminate});await Promise.resolve();await Promise.resolve();expect(terminate).toHaveBeenCalled()
})
it('bounds a hung OCR by a 45 second timeout', async()=>{
 vi.useFakeTimers();createWorker.mockResolvedValue({recognize,terminate});recognize.mockReturnValue(new Promise(()=>{}))
 const p=recognizeTicket({} as HTMLCanvasElement,{signal:new AbortController().signal,onProgress:()=>{}});void p.catch(()=>{})
 await vi.advanceTimersByTimeAsync(45000);await expect(p).rejects.toThrow('시간');expect(terminate).toHaveBeenCalled()
})

it('retries only once and blanks disagreement instead of guessing', async()=>{
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({filter:'',drawImage:vi.fn()} as unknown as CanvasRenderingContext2D)
 createWorker.mockResolvedValue({recognize,terminate})
 recognize.mockResolvedValueOnce({data:{text:'1200회\nA 자동 01 02 03 04 05 06\nB 자동 07 08'}})
  .mockResolvedValueOnce({data:{text:'1200회\nA 자동 01 02 03 04 05 09\nB 자동 07 08 09 10 11 12'}})
 const canvas=document.createElement('canvas')
 const draft=await recognizeTicket(canvas,{signal:new AbortController().signal,onProgress:()=>{}})
 expect(recognize).toHaveBeenCalledTimes(2);expect(draft.rows[0]).toMatchObject({values:Array(6).fill(null),needsReview:true})
 expect(terminate).toHaveBeenCalledTimes(1)
})
