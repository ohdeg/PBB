// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LottoTicketImportDialog } from './LottoTicketImportDialog'
afterEach(cleanup)
const props={owner:null,draws:[],latestRound:1200,drawsReady:true,ready:true,history:[],onSave:vi.fn().mockResolvedValue('local'),onClose:vi.fn(),onComplete:vi.fn()}
function manual() {
 fireEvent.click(screen.getByRole('button',{name:'직접 입력'}))
 fireEvent.change(screen.getByLabelText('회차'),{target:{value:'1201'}})
 for(let i=0;i<6;i++)fireEvent.change(screen.getByLabelText(`A줄 ${i+1}번째 번호`),{target:{value:String(i+1)}})
}
it('requires explicit confirmation and stores only a confirmed selection',async()=>{
 render(<LottoTicketImportDialog {...props}/>);manual()
 expect(screen.getByRole('button',{name:'확인한 번호 저장'})).toBeDisabled()
 fireEvent.click(screen.getByLabelText('A줄 확인 완료'))
 fireEvent.click(screen.getByRole('button',{name:'확인한 번호 저장'}))
 await waitFor(()=>expect(props.onComplete).toHaveBeenCalledWith('pending'))
 expect(props.onSave.mock.calls.at(-1)?.[0][0]).toMatchObject({targetRound:1201,numbers:[1,2,3,4,5,6],source:'ticket-photo'})
 expect(screen.getByText(/새로고침하면 사라집니다/)).toBeInTheDocument()
})
it('clears confirmation after editing the round or a number',()=>{
 render(<LottoTicketImportDialog {...props}/>);manual();fireEvent.click(screen.getByLabelText('A줄 확인 완료'))
 fireEvent.change(screen.getByLabelText('A줄 1번째 번호'),{target:{value:'9'}})
 expect(screen.getByLabelText('A줄 확인 완료')).not.toBeChecked()
})
it('does not save already published losing rows and explains it in advance',()=>{
 const save=vi.fn();render(<LottoTicketImportDialog {...props} onSave={save} draws={[{round:1201,mainNumbers:[10,11,12,13,14,15],bonusNumber:16}]}/>);manual()
 expect(screen.getByText(/미당첨 번호는 저장되지 않습니다/)).toBeInTheDocument()
 expect(screen.getByText(/선택한 번호는 미당첨/)).toBeInTheDocument()
 expect(screen.getByRole('button',{name:'확인한 번호 저장'})).toBeDisabled();expect(save).not.toHaveBeenCalled()
})
it('keeps retry bound to the same operation and frozen payload after a failure',async()=>{
 const save=vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue('saved')
 render(<LottoTicketImportDialog {...props} owner="id:A" onSave={save}/>);manual();fireEvent.click(screen.getByLabelText('A줄 확인 완료'))
 fireEvent.click(screen.getByRole('button',{name:'확인한 번호 저장'}))
 await waitFor(()=>expect(screen.getByRole('button',{name:'저장 다시 시도'})).toBeInTheDocument())
 expect(screen.getByLabelText('회차')).toBeDisabled()
 fireEvent.click(screen.getByRole('button',{name:'저장 다시 시도'}))
 await waitFor(()=>expect(save).toHaveBeenCalledTimes(2))
 expect(save.mock.calls[1][0]).toEqual(save.mock.calls[0][0]);expect(save.mock.calls[1][1]).toEqual(save.mock.calls[0][1])
})

it('requires fresh confirmation when published results change during review',async()=>{
 const save=vi.fn();const view=render(<LottoTicketImportDialog {...props} onSave={save}/>);manual()
 fireEvent.click(screen.getByLabelText('A줄 확인 완료'))
 view.rerender(<LottoTicketImportDialog {...props} onSave={save} draws={[{round:1201,mainNumbers:[1,2,3,4,5,6],bonusNumber:7}]}/>)
 fireEvent.click(screen.getByRole('button',{name:'확인한 번호 저장'}))
 expect(save).not.toHaveBeenCalled();expect(screen.getByLabelText('A줄 확인 완료')).not.toBeChecked()
 expect(screen.getByText(/추첨 결과가 갱신/)).toBeInTheDocument()
})
it('permits normal selected rows while excluding invalid unselected rows',async()=>{
 const save=vi.fn().mockResolvedValue('local');render(<LottoTicketImportDialog {...props} onSave={save}/>);manual()
 fireEvent.click(screen.getByRole('button',{name:'번호 줄 추가'}))
 fireEvent.click(screen.getByLabelText('B줄 저장'));fireEvent.click(screen.getByLabelText('A줄 확인 완료'))
 fireEvent.click(screen.getByRole('button',{name:'확인한 번호 저장'}))
 await waitFor(()=>expect(save).toHaveBeenCalledTimes(1));expect(save.mock.calls[0][0]).toHaveLength(1)
})
