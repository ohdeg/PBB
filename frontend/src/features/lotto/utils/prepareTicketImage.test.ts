import { expect, it } from 'vitest'
import { validateTicketImage, ticketImageSize } from './prepareTicketImage'
it('rejects oversized, unsupported and empty images before decoding', () => {
 expect(()=>validateTicketImage({size:16*1024*1024,type:'image/jpeg'})).toThrow()
 expect(()=>validateTicketImage({size:100,type:'image/heic'})).toThrow()
 expect(()=>validateTicketImage({size:0,type:'image/png'})).toThrow()
 expect(()=>validateTicketImage({size:100,type:'image/png'})).not.toThrow()
})
it('bounds pixels, rotation and crop then caps canvas dimensions', () => {
 expect(()=>ticketImageSize(6000,5000,0,{left:0,top:0,right:100,bottom:100})).toThrow()
 expect(()=>ticketImageSize(100,100,0,{left:80,top:0,right:50,bottom:100})).toThrow()
 expect(ticketImageSize(4000,3000,90,{left:0,top:0,right:100,bottom:100})).toMatchObject({width:1536,height:2048})
})
